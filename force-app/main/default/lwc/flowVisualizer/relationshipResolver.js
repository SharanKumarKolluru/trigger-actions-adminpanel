/**
 * Port of sf-lineage's RelationshipResolver for LWC.
 * Resolves $Record reference paths in Flow metadata to concrete sObject-qualified paths
 * by walking describe() field relationships via the REST API.
 *
 * Examples:
 *   $Record              → Account
 *   $Record.Name         → Account.Name
 *   $Record.Parent.Name  → Account.Parent.Name  (with describe validation)
 *   $Record.Owner.Email  → Account.Owner.Email
 */

const describeCache = new Map();

/**
 * Fetch and cache sObject describe metadata via REST API.
 * Returns null on failure (graceful degradation).
 */
async function fetchDescribe(sobjectName, sessionId, orgDomainUrl, apiVersion) {
  const key = sobjectName.toLowerCase();
  if (describeCache.has(key)) {
    return describeCache.get(key);
  }

  try {
    const url = `${orgDomainUrl}/services/data/${apiVersion}/sobjects/${encodeURIComponent(sobjectName)}/describe`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionId}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      describeCache.set(key, null);
      return null;
    }

    const data = await response.json();
    const result = {
      fields: (data.fields || []).map((f) => ({
        name: f.name,
        relationshipName: f.relationshipName || null,
        referenceTo: f.referenceTo || []
      })),
      childRelationships: (data.childRelationships || []).map((cr) => ({
        childSObject: cr.childSObject,
        relationshipName: cr.relationshipName || null
      }))
    };

    describeCache.set(key, result);
    return result;
  } catch {
    describeCache.set(key, null);
    return null;
  }
}

/**
 * Resolve a $Record reference path to a concrete sObject-qualified path.
 * For multi-hop paths (3+ segments), walks describe() field relationships
 * to validate intermediate relationship segments.
 *
 * Falls back to simple $Record → sObject prefix replacement if describe fails.
 */
async function resolveRecordPath(
  path,
  rootSobject,
  sessionId,
  orgDomainUrl,
  apiVersion
) {
  if (!path) return path;

  const parts = path.split(".");
  const prefix = parts[0];

  if (prefix !== "$Record" && prefix !== "$Record__c") {
    return path;
  }

  // $Record alone → sObject name
  if (parts.length === 1) {
    return rootSobject;
  }

  // Replace $Record prefix with sObject name
  parts[0] = rootSobject;

  // For 2-part paths ($Record.Field), no describe needed
  if (parts.length <= 2) {
    return parts.join(".");
  }

  // Multi-hop: walk intermediate relationship segments via describe
  // to validate them. Even if describe fails, the prefix is already replaced.
  let currentSobject = rootSobject;

  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    // eslint-disable-next-line no-await-in-loop -- sequential: each hop depends on prior describe result
    const desc = await fetchDescribe(
      currentSobject,
      sessionId,
      orgDomainUrl,
      apiVersion
    );

    if (!desc) break;

    const field = desc.fields.find(
      (f) => f.relationshipName === part || f.name === part
    );

    if (field?.referenceTo?.length > 0) {
      currentSobject = field.referenceTo[0];
    } else {
      const childRel = desc.childRelationships?.find(
        (cr) => cr.relationshipName === part
      );
      if (childRel) {
        currentSobject = childRel.childSObject;
      } else if (part.endsWith("__r")) {
        currentSobject = part.slice(0, -3) + "__c";
      } else {
        break;
      }
    }
  }

  return parts.join(".");
}

/**
 * Collect all unique $Record paths from a flow metadata object.
 */
function collectRecordPaths(obj) {
  const paths = new Set();
  const regex = /\$Record(?:__c)?(?:\.[a-zA-Z0-9_]+)*/g;

  function scan(val) {
    if (typeof val === "string") {
      const matches = val.match(regex);
      if (matches) {
        for (const m of matches) {
          paths.add(m);
        }
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        scan(item);
      }
    } else if (val && typeof val === "object") {
      for (const v of Object.values(val)) {
        scan(v);
      }
    }
  }

  scan(obj);
  return [...paths];
}

/**
 * Deep-replace all occurrences of source strings with their resolved values.
 * Returns a new object; does not mutate the input.
 */
function deepReplace(obj, replacements) {
  if (typeof obj === "string") {
    let result = obj;
    for (const [from, to] of replacements) {
      result = result.split(from).join(to);
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepReplace(item, replacements));
  }
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplace(value, replacements);
    }
    return result;
  }
  return obj;
}

/**
 * Resolve all $Record references in flow metadata to concrete sObject-qualified paths.
 * Returns a new metadata object with all $Record references replaced.
 * The input metadata is not mutated.
 *
 * Requires the flow to be record-triggered (metadata.start.object must exist).
 * For non-record-triggered flows, returns the metadata unchanged.
 *
 * @param {Object} metadata - Flow metadata from Tooling API
 * @param {string} sessionId - Salesforce session ID for describe API calls
 * @param {string} orgDomainUrl - Org domain URL
 * @param {string} apiVersion - API version (e.g., 'v66.0')
 * @returns {Promise<Object>} Resolved metadata (new object, input not mutated)
 */
export async function resolveFlowRecordReferences(
  metadata,
  sessionId,
  orgDomainUrl,
  apiVersion
) {
  const sobjectName = metadata?.start?.object;
  if (!sobjectName) {
    return metadata;
  }

  const paths = collectRecordPaths(metadata);
  if (paths.length === 0) {
    return metadata;
  }

  // Resolve each unique path
  const resolvedMap = new Map();
  for (const path of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop -- paths resolved sequentially to avoid API rate issues
      const resolved = await resolveRecordPath(
        path,
        sobjectName,
        sessionId,
        orgDomainUrl,
        apiVersion
      );
      if (resolved !== path) {
        resolvedMap.set(path, resolved);
      }
    } catch {
      // Fall back to simple prefix replacement
      const simple = path.replace(/^\$Record(?:__c)?/, sobjectName);
      if (simple !== path) {
        resolvedMap.set(path, simple);
      }
    }
  }

  if (resolvedMap.size === 0) {
    return metadata;
  }

  // Sort by path length descending to avoid substring collisions
  const sortedReplacements = [...resolvedMap.entries()].sort(
    ([a], [b]) => b.length - a.length
  );

  return deepReplace(metadata, sortedReplacements);
}

/**
 * Clear the describe cache. Useful when the session is refreshed
 * or for testing.
 */
export function clearDescribeCache() {
  describeCache.clear();
}

// Exported for testing
export { collectRecordPaths, deepReplace };
