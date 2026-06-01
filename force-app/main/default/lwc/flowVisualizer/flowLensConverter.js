// SkinColor values
export const SkinColor = {
  NONE: "NONE",
  PINK: "PINK",
  ORANGE: "ORANGE",
  NAVY: "NAVY",
  BLUE: "BLUE"
};

// Icon values
export const Icon = {
  ASSIGNMENT: "📝",
  CODE: "⚡",
  CREATE_RECORD: "➕",
  DECISION: "🔹",
  DELETE: "🗑️",
  LOOKUP: "🔍",
  LOOP: "🔄",
  RIGHT: "➡️",
  SCREEN: "💻",
  STAGE_STEP: "📍",
  UPDATE: "✏️",
  WAIT: "⏳",
  NONE: "",
  ERROR: "🚫"
};

// Mapping from SkinColor to Mermaid class names
const COLOR_TO_STYLE_CLASS = {
  [SkinColor.PINK]: "pink",
  [SkinColor.ORANGE]: "orange",
  [SkinColor.NAVY]: "navy",
  [SkinColor.BLUE]: "blue",
  [SkinColor.NONE]: ""
};

// Mapping from Icon to emoji
const ICON_TO_EMOJI = {
  [Icon.ASSIGNMENT]: "📝",
  [Icon.CODE]: "⚡",
  [Icon.CREATE_RECORD]: "➕",
  [Icon.DECISION]: "🔹",
  [Icon.DELETE]: "🗑️",
  [Icon.LOOKUP]: "🔍",
  [Icon.LOOP]: "🔄",
  [Icon.RIGHT]: "➡️",
  [Icon.SCREEN]: "💻",
  [Icon.STAGE_STEP]: "📍",
  [Icon.UPDATE]: "✏️",
  [Icon.WAIT]: "⏳",
  [Icon.NONE]: "",
  [Icon.ERROR]: "🚫"
};

/**
 * Formats a Flow element value reference or string value.
 */
function toString(element) {
  if (!element) {
    return "";
  }
  if (
    element.stringValue !== undefined ||
    element.sobjectValue !== undefined ||
    element.apexValue !== undefined ||
    element.elementReference !== undefined ||
    element.formulaExpression !== undefined ||
    element.setupReference !== undefined ||
    element.transformValueReference !== undefined ||
    element.formulaDataType !== undefined
  ) {
    return (
      element.stringValue ??
      element.sobjectValue ??
      element.apexValue ??
      element.elementReference ??
      element.formulaExpression ??
      element.setupReference ??
      element.transformValueReference ??
      element.formulaDataType ??
      ""
    );
  }
  if (element.dateTimeValue) {
    return new Date(element.dateTimeValue).toLocaleDateString();
  }
  if (element.dateValue) {
    return new Date(element.dateValue).toLocaleDateString();
  }
  if (element.numberValue !== undefined) {
    return String(element.numberValue);
  }
  if (element.booleanValue !== undefined) {
    return String(element.booleanValue);
  }
  return "";
}

function sanitizeId(id) {
  return id ? id.replace(/[^a-zA-Z0-9]/g, "_") : "";
}

function sanitizeLabel(label) {
  return label ? label.replace(/"/g, "'") : "";
}

function getNodeLabel(node) {
  const emoji = ICON_TO_EMOJI[node.icon] || "";
  const sanitizedLabel = sanitizeLabel(node.label || node.name);

  const typeWithEmoji = `${node.type || ""} ${emoji}`.trim();
  if (!sanitizedLabel || sanitizedLabel === node.type) {
    return typeWithEmoji;
  }

  return `${typeWithEmoji}\\n${sanitizedLabel}`;
}

function formatInnerNodeLabel(innerNode) {
  const sanitizedLabel = sanitizeLabel(innerNode.label);
  const sanitizedContent = (innerNode.content || []).map((item) =>
    sanitizeLabel(item)
  );

  const nodeType = innerNode.type ? `${innerNode.type}\\n` : "";
  const nodeLabel =
    innerNode.label && innerNode.label !== innerNode.type
      ? `${sanitizedLabel}\\n`
      : "";
  const nodeContent = sanitizedContent.join("\\n");

  return `${nodeType}${nodeLabel}${nodeContent}`;
}

function toUmlString(node) {
  const nodeId = sanitizeId(node.id);
  const nodeLabel = getNodeLabel(node);
  const styleClass = COLOR_TO_STYLE_CLASS[node.color];
  const lines = [];

  if (node.innerNodes && node.innerNodes.length > 0) {
    const content = [nodeLabel];
    node.innerNodes.forEach((inner) => {
      content.push(formatInnerNodeLabel(inner));
    });
    lines.push(`  state "${content.join("\\n---\\n")}" as ${nodeId}`);
  } else {
    lines.push(`  state "${nodeLabel}" as ${nodeId}`);
  }

  if (styleClass) {
    lines.push(`  class ${nodeId} ${styleClass}`);
  }

  return lines.join("\n");
}

function getFlowStart(start, processType) {
  const entryCriteria = [];

  if (processType) {
    entryCriteria.push(`Process Type: ${processType}`);
  }
  if (start.triggerType) {
    entryCriteria.push(`Trigger Type: ${start.triggerType}`);
  }
  if (start.object) {
    entryCriteria.push(`Object: ${start.object}`);
  }
  if (start.recordTriggerType) {
    entryCriteria.push(`Record Trigger: ${start.recordTriggerType}`);
  }
  if (start.entryType) {
    entryCriteria.push(`Entry Type: ${start.entryType}`);
  }

  const filters = start.filters
    ? Array.isArray(start.filters)
      ? start.filters
      : [start.filters]
    : [];
  if (start.filterLogic && filters.length > 0) {
    entryCriteria.push(`Filter Logic: ${start.filterLogic}`);
    filters.forEach((filter, index) => {
      entryCriteria.push(
        `${index + 1}. ${filter.field} ${filter.operator} ${toString(filter.value)}`
      );
    });
  }

  if (start.filterFormula) {
    entryCriteria.push(`Filter Formula: ${start.filterFormula}`);
  }
  if (start.schedule) {
    entryCriteria.push(
      `Schedule: ${start.schedule.frequency} starting ${start.schedule.startDate} at ${start.schedule.startTime}`
    );
  }

  const capabilities = start.capabilityTypes
    ? Array.isArray(start.capabilityTypes)
      ? start.capabilityTypes
      : [start.capabilityTypes]
    : [];
  if (capabilities.length > 0) {
    capabilities.forEach((capability, index) => {
      entryCriteria.push(
        `Capability ${index + 1}: ${capability.capabilityName}`
      );
    });
  }

  if (start.form) {
    entryCriteria.push(`Form: ${start.form}`);
  }
  if (start.segment) {
    entryCriteria.push(`Segment: ${start.segment}`);
  }
  if (start.flowRunAsUser) {
    entryCriteria.push(`Run As: ${start.flowRunAsUser}`);
  }

  if (entryCriteria.length === 0) {
    entryCriteria.push("No specific entry criteria defined");
  }

  return toUmlString({
    id: "FLOW_START",
    label: "Flow Start",
    type: "Flow Start",
    color: SkinColor.NONE,
    icon: Icon.NONE,
    innerNodes: [
      {
        id: "FlowStart__EntryCriteria",
        type: "Flow Details",
        label: "",
        content: entryCriteria
      }
    ]
  });
}

function getFlowAssignment(node) {
  const innerNodes = [];
  const items = node.assignmentItems
    ? Array.isArray(node.assignmentItems)
      ? node.assignmentItems
      : [node.assignmentItems]
    : [];
  if (items.length > 0) {
    const assignments = items.map((item) => {
      const operator = item.operator === "Assign" ? "=" : item.operator;
      return `${item.assignToReference} ${operator} ${toString(item.value)}`;
    });
    innerNodes.push({
      id: `${node.name}__Assignments`,
      type: "",
      label: "",
      content: assignments
    });
  }

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Assignment",
    color: SkinColor.ORANGE,
    icon: Icon.ASSIGNMENT,
    innerNodes
  });
}

function getFlowDecision(node) {
  const innerNodes = [];
  const rules = node.rules
    ? Array.isArray(node.rules)
      ? node.rules
      : [node.rules]
    : [];
  rules.forEach((rule) => {
    let conditionCounter = 1;
    const conditionsList = rule.conditions
      ? Array.isArray(rule.conditions)
        ? rule.conditions
        : [rule.conditions]
      : [];
    const conditions = conditionsList.map(
      (cond) =>
        `${conditionCounter++}. ${cond.leftValueReference} ${cond.operator} ${toString(cond.rightValue)}`
    );
    if (conditions.length > 1) {
      conditions.push(`Logic: ${rule.conditionLogic}`);
    }
    innerNodes.push({
      id: rule.name,
      type: "Rule",
      label: rule.label,
      content: conditions
    });
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Decision",
    color: SkinColor.ORANGE,
    icon: Icon.DECISION,
    innerNodes
  });
}

function getFlowOrchestratedStage(node) {
  const innerNodes = [];
  const steps = node.stageSteps
    ? Array.isArray(node.stageSteps)
      ? node.stageSteps
      : [node.stageSteps]
    : [];
  let counter = 1;
  steps.forEach((step) => {
    innerNodes.push({
      id: `${node.name}.${step.actionName}`,
      type: "Step",
      label: `${counter++}. ${step.label}`,
      content: []
    });
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Orchestrated Stage",
    color: SkinColor.NAVY,
    icon: Icon.RIGHT,
    innerNodes
  });
}

function getFlowRecordLookup(node) {
  const innerNodeContent = [];

  const queried = node.queriedFields
    ? Array.isArray(node.queriedFields)
      ? node.queriedFields
      : [node.queriedFields]
    : [];
  if (queried.length > 0) {
    innerNodeContent.push("Fields Queried:", queried.join(", "));
  } else {
    innerNodeContent.push("Fields Queried: all");
  }

  innerNodeContent.push(
    `Filter Logic: ${node.filterLogic ? node.filterLogic : "None"}`
  );
  const filters = node.filters
    ? Array.isArray(node.filters)
      ? node.filters
      : [node.filters]
    : [];
  filters.forEach((filter, index) => {
    innerNodeContent.push(
      `${index + 1}. ${filter.field} ${filter.operator} ${toString(filter.value)}`
    );
  });

  if (node.getFirstRecordOnly) {
    innerNodeContent.push("Limit: First Record Only");
  } else if (node.limit) {
    innerNodeContent.push(`Limit: ${node.limit}`);
  } else {
    innerNodeContent.push("Limit: All Records");
  }

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Record Lookup",
    color: SkinColor.PINK,
    icon: Icon.LOOKUP,
    innerNodes: [
      {
        id: `${node.name}__LookupDetails`,
        type: `sObject: ${node.object}`,
        label: "",
        content: innerNodeContent
      }
    ]
  });
}

function getFlowRecordUpdate(node) {
  const innerNodeContent = [];
  const filters = node.filters
    ? Array.isArray(node.filters)
      ? node.filters
      : [node.filters]
    : [];
  if (filters.length > 0) {
    innerNodeContent.push("Filter Criteria:");
    filters.forEach((filter, index) => {
      innerNodeContent.push(
        `${index + 1}. ${filter.field} ${filter.operator} ${toString(filter.value)}`
      );
    });
  }

  const assignments = node.inputAssignments
    ? Array.isArray(node.inputAssignments)
      ? node.inputAssignments
      : [node.inputAssignments]
    : [];
  if (assignments.length > 0) {
    innerNodeContent.push("Field Updates:");
    assignments.forEach((assign) => {
      innerNodeContent.push(`${assign.field} = ${toString(assign.value)}`);
    });
  }

  const type = node.inputReference ? "Reference Update" : "Direct Update";
  const label = node.inputReference
    ? node.inputReference
    : `sObject: ${node.object}`;

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Record Update",
    color: SkinColor.PINK,
    icon: Icon.UPDATE,
    innerNodes: [
      {
        id: `${node.name}__UpdateDetails`,
        type,
        label,
        content: innerNodeContent
      }
    ]
  });
}

function getFlowCustomError(node) {
  const innerNodeContent = [];
  const messages = node.customErrorMessages
    ? Array.isArray(node.customErrorMessages)
      ? node.customErrorMessages
      : [node.customErrorMessages]
    : [];
  messages.forEach((msg, index) => {
    const fieldInfo = msg.fieldSelection
      ? ` (Field: ${msg.fieldSelection})`
      : "";
    innerNodeContent.push(`${index + 1}. ${msg.errorMessage}${fieldInfo}`);
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Custom Error",
    color: SkinColor.NAVY,
    icon: Icon.ERROR,
    innerNodes: [
      {
        id: `${node.name}__ErrorDetails`,
        type: node.description || "Custom Error Details",
        label: "Error Messages:",
        content: innerNodeContent
      }
    ]
  });
}

function createTransition(
  from,
  connection,
  isFault,
  transitionLabel,
  nameToNode
) {
  const targetRef = connection.targetReference;
  const connectedNode = nameToNode.get(targetRef);
  const toName = connectedNode ? connectedNode.name : "END";
  return {
    from: from.name,
    to: toName,
    fault: isFault,
    label: transitionLabel
  };
}

function getTransitionsForNode(node, nameToNode) {
  const transitions = [];
  const type = node._type;

  if (type === "start") {
    if (node.connector) {
      transitions.push(
        createTransition(node, node.connector, false, undefined, nameToNode)
      );
    }
    const paths = node.scheduledPaths
      ? Array.isArray(node.scheduledPaths)
        ? node.scheduledPaths
        : [node.scheduledPaths]
      : [];
    paths.forEach((path) => {
      if (path.connector) {
        transitions.push(
          createTransition(
            node,
            path.connector,
            false,
            path.pathType || path.label,
            nameToNode
          )
        );
      }
    });
  } else if (
    type === "recordCreate" ||
    type === "recordDelete" ||
    type === "recordLookup" ||
    type === "recordUpdate" ||
    type === "apexPluginCall" ||
    type === "actionCall" ||
    type === "wait"
  ) {
    if (node.connector) {
      transitions.push(
        createTransition(node, node.connector, false, undefined, nameToNode)
      );
    }
    if (node.defaultConnector) {
      transitions.push(
        createTransition(
          node,
          node.defaultConnector,
          false,
          node.defaultConnectorLabel,
          nameToNode
        )
      );
    }
    if (node.faultConnector) {
      transitions.push(
        createTransition(node, node.faultConnector, true, "Fault", nameToNode)
      );
    }
  } else if (type === "step") {
    const connectors = node.connectors
      ? Array.isArray(node.connectors)
        ? node.connectors
        : [node.connectors]
      : [];
    connectors.forEach((conn) => {
      transitions.push(
        createTransition(node, conn, false, undefined, nameToNode)
      );
    });
  } else if (type === "decision") {
    if (node.defaultConnector) {
      transitions.push(
        createTransition(
          node,
          node.defaultConnector,
          false,
          node.defaultConnectorLabel || "Default",
          nameToNode
        )
      );
    }
    const rules = node.rules
      ? Array.isArray(node.rules)
        ? node.rules
        : [node.rules]
      : [];
    rules.forEach((rule) => {
      if (rule.connector) {
        transitions.push(
          createTransition(node, rule.connector, false, rule.label, nameToNode)
        );
      }
    });
  } else if (type === "loop") {
    if (node.nextValueConnector) {
      transitions.push(
        createTransition(
          node,
          node.nextValueConnector,
          false,
          "for each",
          nameToNode
        )
      );
    }
    if (node.noMoreValuesConnector) {
      transitions.push(
        createTransition(
          node,
          node.noMoreValuesConnector,
          false,
          "after all",
          nameToNode
        )
      );
    }
  } else if (
    type === "assignment" ||
    type === "collectionProcessor" ||
    type === "screen" ||
    type === "subflow" ||
    type === "transform" ||
    type === "recordRollback" ||
    type === "customError" ||
    type === "orchestratedStage"
  ) {
    if (node.connector) {
      const connectors = Array.isArray(node.connector)
        ? node.connector
        : [node.connector];
      connectors.forEach((conn) => {
        transitions.push(
          createTransition(node, conn, false, undefined, nameToNode)
        );
      });
    }
  }

  return transitions;
}

function populateTransitions(flow, nameToNode) {
  const result = [];
  const start = flow.start;
  if (!start) return result;

  const queue = [start];
  const visitedNodes = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visitedNodes.has(node.name)) {
      continue;
    }
    visitedNodes.add(node.name);

    const transitions = getTransitionsForNode(node, nameToNode);
    for (const trans of transitions) {
      const toNode = nameToNode.get(trans.to);
      if (toNode) {
        queue.push(toNode);
      }
    }
    result.push(...transitions);
  }
  return result;
}

export function convertFlowToMermaid(flow, flowLabel, includeTitle = true) {
  const nameToNode = new Map();
  nameToNode.set("END", { name: "END", label: "End", _type: "end" });

  if (flow.start) {
    flow.start.name = "FLOW_START";
    flow.start._type = "start";
    nameToNode.set("FLOW_START", flow.start);
  }

  const arrayTypes = [
    { array: flow.apexPluginCalls, type: "apexPluginCall" },
    { array: flow.assignments, type: "assignment" },
    { array: flow.collectionProcessors, type: "collectionProcessor" },
    { array: flow.customErrors, type: "customError" },
    { array: flow.decisions, type: "decision" },
    { array: flow.loops, type: "loop" },
    { array: flow.orchestratedStages, type: "orchestratedStage" },
    { array: flow.recordCreates, type: "recordCreate" },
    { array: flow.recordDeletes, type: "recordDelete" },
    { array: flow.recordLookups, type: "recordLookup" },
    { array: flow.recordRollbacks, type: "recordRollback" },
    { array: flow.recordUpdates, type: "recordUpdate" },
    { array: flow.screens, type: "screen" },
    { array: flow.steps, type: "step" },
    { array: flow.subflows, type: "subflow" },
    { array: flow.transforms, type: "transform" },
    { array: flow.waits, type: "wait" },
    { array: flow.actionCalls, type: "actionCall" }
  ];

  arrayTypes.forEach((entry) => {
    if (entry.array) {
      const arr = Array.isArray(entry.array) ? entry.array : [entry.array];
      arr.forEach((node) => {
        node._type = entry.type;
        nameToNode.set(node.name, node);
      });
    }
  });

  const transitions = populateTransitions(flow, nameToNode);

  // Build the Mermaid syntax output
  const lines = [];
  if (includeTitle) {
    lines.push("---");
    lines.push(
      `title: "${sanitizeLabel(flowLabel || flow.label || "Flow Diagram")}"`
    );
    lines.push("---");
  }
  lines.push(
    "stateDiagram-v2",
    "",
    "  classDef pink fill:#F9548A, color:white",
    "  classDef orange fill:#DD7A00, color:white",
    "  classDef navy fill:#344568, color:white",
    "  classDef blue fill:#1B96FF, color:white",
    ""
  );

  // Emit node state definitions
  nameToNode.forEach((node) => {
    if (node.name === "END") {
      lines.push(`  state "END" as END`);
      return;
    }

    if (node._type === "start") {
      lines.push(getFlowStart(node, flow.processType));
      return;
    }

    switch (node._type) {
      case "apexPluginCall":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Apex Plugin Call",
            color: SkinColor.NONE,
            icon: Icon.CODE
          })
        );
        break;
      case "assignment":
        lines.push(getFlowAssignment(node));
        break;
      case "collectionProcessor":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Collection Processor",
            color: SkinColor.NONE,
            icon: Icon.LOOP
          })
        );
        break;
      case "decision":
        lines.push(getFlowDecision(node));
        break;
      case "loop":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Loop",
            color: SkinColor.ORANGE,
            icon: Icon.LOOP
          })
        );
        break;
      case "orchestratedStage":
        lines.push(getFlowOrchestratedStage(node));
        break;
      case "recordCreate":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Record Create",
            color: SkinColor.PINK,
            icon: Icon.CREATE_RECORD
          })
        );
        break;
      case "recordDelete":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Record Delete",
            color: SkinColor.PINK,
            icon: Icon.DELETE
          })
        );
        break;
      case "recordLookup":
        lines.push(getFlowRecordLookup(node));
        break;
      case "recordRollback":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Record Rollback",
            color: SkinColor.PINK,
            icon: Icon.NONE
          })
        );
        break;
      case "recordUpdate":
        lines.push(getFlowRecordUpdate(node));
        break;
      case "screen":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Screen",
            color: SkinColor.BLUE,
            icon: Icon.SCREEN
          })
        );
        break;
      case "step":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Step",
            color: SkinColor.NONE,
            icon: Icon.STAGE_STEP
          })
        );
        break;
      case "subflow":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Subflow",
            color: SkinColor.NAVY,
            icon: Icon.RIGHT
          })
        );
        break;
      case "transform":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Transform",
            color: SkinColor.NONE,
            icon: Icon.CODE
          })
        );
        break;
      case "wait":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Wait",
            color: SkinColor.NONE,
            icon: Icon.WAIT
          })
        );
        break;
      case "actionCall":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Action Call",
            color: SkinColor.NAVY,
            icon: Icon.CODE
          })
        );
        break;
      case "customError":
        lines.push(getFlowCustomError(node));
        break;
      default:
        // Unrecognized node types are silently skipped
        break;
    }
  });

  lines.push("");

  // Emit transitions
  transitions.forEach((trans) => {
    const fromId = sanitizeId(trans.from);
    const toId = sanitizeId(trans.to);
    const faultIndicator = trans.fault ? "❌" : "";
    const label = trans.label
      ? ` : ${faultIndicator} ${trans.label} ${faultIndicator}`
      : "";
    lines.push(`  ${fromId} --> ${toId}${label}`);
  });

  return lines.join("\n");
}
