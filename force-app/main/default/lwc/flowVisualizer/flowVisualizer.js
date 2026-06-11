import { LightningElement, api } from "lwc";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertFlowToMermaid } from "./flowLensConverter";
import { resolveFlowRecordReferences } from "./relationshipResolver";
export { convertFlowToMermaid };

// Salesforce ID format: 15 or 18 alphanumeric characters
const SFDC_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;

export default class FlowVisualizer extends LightningElement {
  @api flowId;
  @api flowName;
  @api highlightNodeId;
  @api apiVersion = "v66.0";

  error;
  isLoading = true;
  loadingMessage = "Authenticating session...";
  resources;

  sessionId;
  orgDomainUrl;
  mermaidCode;
  copiedMermaidCode;
  _isDestroyed = false;

  get builderUrl() {
    if (!this.orgDomainUrl || !this.flowId) return "";
    // Flow Builder requires the flowDefId parameter when passing the FlowDefinition (300) ID.
    return `${this.orgDomainUrl}/builder_platform_interaction/flowBuilder.app?flowDefId=${this.flowId}`;
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadSessionAndMetadata();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  async loadSessionAndMetadata() {
    try {
      this.isLoading = true;
      this.error = null;

      if (!this.sessionId || !this.orgDomainUrl) {
        this.loadingMessage = "Authenticating session...";
        const [session, domain] = await Promise.all([
          getSessionId(),
          getOrgDomainUrl()
        ]);

        this.sessionId = session;
        this.orgDomainUrl = domain;
      }

      if (!this.sessionId) {
        throw new Error(
          "Failed to retrieve an active API session token. Please ensure your user has appropriate administrative rights."
        );
      }

      await this.fetchFlowMetadata();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isLoading = false;
    }
  }

  async fetchFlowMetadata() {
    this.loadingMessage =
      "Fetching Flow metadata from Salesforce Tooling API...";

    try {
      // First try to fetch the active version of the flow
      let data = await this.queryFlow(true);

      // If no active version found, fetch the latest version (e.g. draft/obsolete)
      if (!data) {
        data = await this.queryFlow(false);
      }

      if (!data || !data.Metadata) {
        throw new Error(
          `No Flow version metadata found for ID ${this.flowId}.`
        );
      }

      this.loadingMessage = "Resolving record references...";

      // Resolve $Record paths to concrete sObject names (e.g. $Record.Owner → Account.Owner)
      const resolvedMetadata = await resolveFlowRecordReferences(
        data.Metadata,
        this.sessionId,
        this.orgDomainUrl,
        this.apiVersion
      );

      this.loadingMessage = "Generating flowchart diagram...";

      // Translate the Metadata JSON using our flow-lens port
      this.mermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        this.flowName,
        false
      );
      if (this.highlightNodeId) {
        this.mermaidCode += `\n  style ${this.highlightNodeId} stroke:#FF5D5D,stroke-width:5px,stroke-dasharray:5;`;
      }
      this.copiedMermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        this.flowName,
        true
      );
      this.resources = this.parseFlowResources(resolvedMetadata);

      this.isLoading = false;
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `REST callout failed: ${err.message}. Please verify if CORS allows requests from this Lightning origin to your Salesforce API domain.`;
        this.isLoading = false;
      }
    }
  }

  async queryFlow(activeOnly) {
    // Validate flowId to prevent SOQL injection via Tooling API query string
    if (!this.flowId || !SFDC_ID_PATTERN.test(this.flowId)) {
      throw new Error(
        `Invalid Flow ID format: "${this.flowId}". Expected a 15 or 18-character Salesforce ID.`
      );
    }

    let query = `SELECT Id, Metadata FROM Flow WHERE DefinitionId = '${this.flowId}'`;
    if (activeOnly) {
      query += ` AND Status = 'Active'`;
    } else {
      query += ` ORDER BY VersionNumber DESC LIMIT 1`;
    }

    const url = `${this.orgDomainUrl}/services/data/${this.apiVersion}/tooling/query?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.sessionId}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Tooling API query failed with status ${response.status}: ${errText}`
      );
    }

    const resData = await response.json();
    if (resData.records && resData.records.length > 0) {
      return resData.records[0];
    }
    return null;
  }

  handleRetry() {
    this.error = null;
    this.isLoading = true;
    this.loadSessionAndMetadata();
  }

  parseFlowResources(metadata) {
    if (!metadata) return null;

    const resources = {
      variables: [],
      formulas: [],
      constants: [],
      textTemplates: []
    };

    const getArray = (val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    };

    // 1. Variables
    getArray(metadata.variables).forEach((v) => {
      let dataTypeText = v.dataType || "";
      if (dataTypeText === "SObject" && v.objectType) {
        dataTypeText = `Record (${v.objectType})`;
      }

      let accessText = "Private";
      if (v.isInput && v.isOutput) {
        accessText = "Input & Output";
      } else if (v.isInput) {
        accessText = "Input Only";
      } else if (v.isOutput) {
        accessText = "Output Only";
      }

      resources.variables.push({
        name: v.name,
        dataType: dataTypeText,
        isCollection: v.isCollection === true || v.isCollection === "true",
        access: accessText
      });
    });

    // 2. Formulas
    getArray(metadata.formulas).forEach((f) => {
      resources.formulas.push({
        name: f.name,
        dataType: f.dataType || "",
        expression: f.expression || ""
      });
    });

    // 3. Constants
    getArray(metadata.constants).forEach((c) => {
      let constValue = "";
      if (c.value) {
        if (typeof c.value === "object") {
          constValue =
            c.value.stringValue ||
            c.value.numberValue ||
            c.value.booleanValue ||
            JSON.stringify(c.value);
        } else {
          constValue = String(c.value);
        }
      }
      resources.constants.push({
        name: c.name,
        dataType: c.dataType || "",
        value: constValue
      });
    });

    // 4. Text Templates
    getArray(metadata.textTemplates).forEach((t) => {
      resources.textTemplates.push({
        name: t.name,
        text: t.text || ""
      });
    });

    // Sort alphabetically by name
    Object.keys(resources).forEach((key) => {
      resources[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return resources;
  }
}
