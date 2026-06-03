import { LightningElement, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getAllFlowDefinitions from "@salesforce/apex/TriggerActionService.getAllFlowDefinitions";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertFlowToMermaid } from "c/flowVisualizer";

// Module-level cache to persist indexed flows across component navigation lifecycle
let cachedIndexedFlows = null;
let cachedIndexedCount = 0;
let cachedTotalFlows = 0;

export default class MermaidFlowBrowser extends LightningElement {
  @track flows = []; // Flow definitions list from Apex
  @track indexedFlows = []; // Flows metadata and node indices
  @track displayedResults = []; // Filtered results

  // State
  @track isIndexing = false;
  @track indexedCount = 0;
  @track totalFlows = 0;
  @track searchQuery = "";
  @track flowTypeFilter = "All";
  @track statusFilter = "All";
  @track isModalOpen = false;

  // Selected Flow for Modal
  @track selectedFlowId;
  @track selectedFlowApiName;
  @track selectedFlowLabel;
  @track selectedNodeId;

  // Session
  sessionId;
  orgDomainUrl;

  // Search Debounce timer
  searchTimer;

  get progressPercentage() {
    if (!this.totalFlows) return 0;
    return Math.round((this.indexedCount / this.totalFlows) * 100);
  }

  get progressStyle() {
    return `width: ${this.progressPercentage}%`;
  }

  get hasResults() {
    return this.displayedResults.length > 0;
  }

  get showLoadingSkeleton() {
    return this.isIndexing && this.indexedCount === 0;
  }

  get showEmptyState() {
    return !this.isIndexing && this.displayedResults.length === 0;
  }

  get filterPills() {
    return [
      {
        label: "All Types",
        value: "All",
        cssClass:
          this.flowTypeFilter === "All" ? "filter-pill active" : "filter-pill"
      },
      {
        label: "Record-Triggered",
        value: "RecordTrigger",
        cssClass:
          this.flowTypeFilter === "RecordTrigger"
            ? "filter-pill active"
            : "filter-pill"
      },
      {
        label: "Screen Flow",
        value: "ScreenFlow",
        cssClass:
          this.flowTypeFilter === "ScreenFlow"
            ? "filter-pill active"
            : "filter-pill"
      },
      {
        label: "Autolaunched",
        value: "AutoLaunchedFlow",
        cssClass:
          this.flowTypeFilter === "AutoLaunchedFlow"
            ? "filter-pill active"
            : "filter-pill"
      }
    ];
  }

  get statusPills() {
    return [
      {
        label: "All Statuses",
        value: "All",
        cssClass:
          this.statusFilter === "All" ? "filter-pill active" : "filter-pill"
      },
      {
        label: "Active Only",
        value: "Active",
        cssClass:
          this.statusFilter === "Active" ? "filter-pill active" : "filter-pill"
      },
      {
        label: "Inactive Only",
        value: "Inactive",
        cssClass:
          this.statusFilter === "Inactive"
            ? "filter-pill active"
            : "filter-pill"
      }
    ];
  }

  @wire(getAllFlowDefinitions)
  wiredFlowDefinitions({ error, data }) {
    if (data) {
      // Filter out standard/packaged flows whose DurableId is not a valid 300 prefix ID
      const sfdcIdPattern = /^300[a-zA-Z0-9]{12,15}$/i;
      this.flows = data.filter(
        (f) => f.DurableId && sfdcIdPattern.test(f.DurableId)
      );
      this.totalFlows = this.flows.length;

      // Check if we have cached results
      if (cachedIndexedFlows && cachedIndexedFlows.length > 0) {
        this.indexedFlows = [...cachedIndexedFlows];
        this.indexedCount = cachedIndexedCount;
        this.totalFlows = cachedTotalFlows;
        this.runSearch();

        // If the cache matches our target flow count, we are fully loaded!
        if (this.indexedFlows.length >= this.totalFlows) {
          this.isIndexing = false;
          return;
        }
      }
      this.startBackgroundIndexing();
    } else if (error) {
      this.showToast(
        "Error Fetching Flows",
        error.body?.message || error.message,
        "error"
      );
    }
  }

  async startBackgroundIndexing() {
    if (this.isIndexing || this.flows.length === 0) return;
    this.isIndexing = true;

    try {
      this.sessionId = await getSessionId();
      this.orgDomainUrl = await getOrgDomainUrl();

      if (!this.sessionId || !this.orgDomainUrl) {
        throw new Error("Unable to obtain Salesforce session credentials.");
      }

      const CONCURRENCY = 5;

      // Resume indexing by filtering out already-cached flows
      const alreadyIndexedIds = new Set(
        this.indexedFlows.map((f) => f.durableId)
      );
      const queue = this.flows.filter(
        (f) => !alreadyIndexedIds.has(f.DurableId)
      );

      if (queue.length === 0) {
        this.isIndexing = false;
        return;
      }

      const workers = Array(CONCURRENCY)
        .fill(null)
        .map(async () => {
          while (queue.length > 0 && this.isIndexing) {
            const flowDef = queue.shift();
            if (flowDef) {
              // eslint-disable-next-line no-await-in-loop
              await this.indexFlow(flowDef);
            }
            // eslint-disable-next-line @lwc/lwc/no-async-operation, no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        });

      await Promise.all(workers);
    } catch (err) {
      this.showToast("Indexing Failed", err.message || err, "error");
    } finally {
      this.isIndexing = false;
    }
  }

  async indexFlow(flowDef) {
    try {
      // First try to fetch the active version
      let record = await this.querySingleFlow(flowDef.DurableId, true);
      if (!record) {
        // Fall back to latest version
        record = await this.querySingleFlow(flowDef.DurableId, false);
      }

      if (record && record.Metadata) {
        let category = flowDef.ProcessType;
        if (flowDef.ProcessType === "Flow") {
          category = "ScreenFlow";
        } else if (flowDef.ProcessType === "AutoLaunchedFlow") {
          const isRecordTrigger =
            record.Metadata.start &&
            (record.Metadata.start.triggerType === "RecordBeforeSave" ||
              record.Metadata.start.triggerType === "RecordAfterSave");
          if (isRecordTrigger) {
            category = "RecordTrigger";
          }
        }

        // Attach processType to metadata for rendering descriptive start logic
        record.Metadata.processType = flowDef.ProcessType;

        const mermaidCode = convertFlowToMermaid(
          record.Metadata,
          flowDef.Label,
          false
        );

        const nodes = this.extractNodesFromMermaid(mermaidCode);

        const newFlow = {
          durableId: flowDef.DurableId,
          apiName: flowDef.ApiName,
          label: flowDef.Label,
          processType: category,
          isActive: flowDef.IsActive,
          statusClass: flowDef.IsActive
            ? "status-badge active"
            : "status-badge inactive",
          statusLabel: flowDef.IsActive ? "Active" : "Inactive",
          mermaidCode: mermaidCode,
          nodes: nodes
        };

        this.indexedFlows = [...this.indexedFlows, newFlow];
        cachedIndexedFlows = this.indexedFlows;
        cachedTotalFlows = this.totalFlows;
        this.runSearch(); // Refresh results in real-time
      }
    } catch (err) {
      console.error(`Error indexing flow ${flowDef.ApiName}: `, err);
    } finally {
      this.indexedCount++;
      cachedIndexedCount = this.indexedCount;
    }
  }

  async querySingleFlow(durableId, activeOnly) {
    let query = `SELECT DefinitionId, VersionNumber, Status, Metadata FROM Flow WHERE DefinitionId = '${durableId}'`;
    if (activeOnly) {
      query += " AND Status = 'Active'";
    } else {
      query += " ORDER BY VersionNumber DESC LIMIT 1";
    }

    const url = `${this.orgDomainUrl}/services/data/v60.0/tooling/query?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.sessionId}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Tooling query error ${response.status}: ${errText}`);
    }

    const resData = await response.json();
    if (resData.records && resData.records.length > 0) {
      return resData.records[0];
    }
    return null;
  }

  extractNodesFromMermaid(mermaidCode) {
    const nodesMap = new Map();
    const nodeRegex =
      /(\w+)(?:\["|{"|\(\["|\[\()((?:[^"]|\\")*?)(?:"\]|"\}(?:_Logic)?|"\)\]|\)\])/gs;

    let match;
    while ((match = nodeRegex.exec(mermaidCode)) !== null) {
      const id = match[1];
      const label = match[2].trim();

      if (
        id === "FLOW_START" ||
        id === "FLOW_END" ||
        id === "METHOD_START" ||
        id === "METHOD_END"
      ) {
        continue;
      }

      if (id.endsWith("_Logic")) {
        const parentId = id.substring(0, id.length - 6);
        if (nodesMap.has(parentId)) {
          const parentNode = nodesMap.get(parentId);
          parentNode.logicLabel = label;
          parentNode.searchableText += "\n" + label;
        }
        continue;
      }

      // Classify type
      let type = "Action";
      let icon = "⚡";
      if (id.startsWith("Dec_") || id.startsWith("choice_")) {
        type = "Decision";
        icon = "🔹";
      } else if (id.startsWith("Assign_") || id.startsWith("action_")) {
        type = "Assignment";
        icon = "📝";
      } else if (id.startsWith("Loop_") || id.startsWith("loop_cond_")) {
        type = "Loop";
        icon = "🔄";
      } else if (id.startsWith("RecCreate_") || id.startsWith("dml_")) {
        type = "Create Record";
        icon = "➕";
      } else if (id.startsWith("RecUpdate_")) {
        type = "Update Record";
        icon = "✏️";
      } else if (id.startsWith("RecLookup_")) {
        type = "Get Records";
        icon = "🔍";
      } else if (id.startsWith("RecDelete_")) {
        type = "Delete Records";
        icon = "🗑️";
      } else if (id.startsWith("Subflow_")) {
        type = "Subflow";
        icon = "🔗";
      } else if (id.startsWith("Action_")) {
        type = "Apex Action";
        icon = "⚡";
      } else if (id.startsWith("Screen_")) {
        type = "Screen";
        icon = "💻";
      }

      nodesMap.set(id, {
        id: id,
        label: label,
        type: type,
        icon: icon,
        logicLabel: "",
        searchableText: label
      });
    }

    return Array.from(nodesMap.values());
  }

  handleSearchChange(event) {
    this.searchQuery = event.target.value;
    clearTimeout(this.searchTimer);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchTimer = setTimeout(() => {
      this.runSearch();
    }, 300);
  }

  handleTypeFilter(event) {
    this.flowTypeFilter = event.target.dataset.value;
    this.runSearch();
  }

  handleStatusFilter(event) {
    this.statusFilter = event.target.dataset.value;
    this.runSearch();
  }

  runSearch() {
    const query = this.searchQuery.trim().toLowerCase();
    const typeFilter = this.flowTypeFilter;
    const statusFilter = this.statusFilter;

    let filtered = this.indexedFlows;

    // Apply type filter
    if (typeFilter !== "All") {
      filtered = filtered.filter((f) => f.processType === typeFilter);
    }

    // Apply status filter
    if (statusFilter !== "All") {
      const wantActive = statusFilter === "Active";
      filtered = filtered.filter((f) => f.isActive === wantActive);
    }

    // Apply text search
    if (query.length > 0) {
      const results = [];

      for (const flow of filtered) {
        const isNameMatch =
          flow.label.toLowerCase().includes(query) ||
          flow.apiName.toLowerCase().includes(query);

        const matchingNodes = [];
        for (const node of flow.nodes) {
          if (node.searchableText.toLowerCase().includes(query)) {
            // Find highlights for the node label
            const labelParts = this.highlightText(node.label, query);
            const logicParts = node.logicLabel
              ? this.highlightText(node.logicLabel, query)
              : [];

            matchingNodes.push({
              ...node,
              highlightedLabel: labelParts,
              highlightedLogic: logicParts,
              hasLogic: node.logicLabel.length > 0
            });
          }
        }

        if (isNameMatch || matchingNodes.length > 0) {
          results.push({
            durableId: flow.durableId,
            apiName: flow.apiName,
            label: flow.label,
            processType: flow.processType,
            processTypeLabel: this.getProcessTypeLabel(flow.processType),
            isActive: flow.isActive,
            statusClass: flow.isActive
              ? "status-badge active"
              : "status-badge inactive",
            statusLabel: flow.isActive ? "Active" : "Inactive",
            matchingNodes: matchingNodes,
            nodeCount: matchingNodes.length,
            isNameMatchOnly: isNameMatch && matchingNodes.length === 0
          });
        }
      }

      this.displayedResults = results;
    } else {
      // If search is empty, just list all matching filter criteria
      this.displayedResults = filtered.map((flow) => ({
        durableId: flow.durableId,
        apiName: flow.apiName,
        label: flow.label,
        processType: flow.processType,
        processTypeLabel: this.getProcessTypeLabel(flow.processType),
        isActive: flow.isActive,
        statusClass: flow.isActive
          ? "status-badge active"
          : "status-badge inactive",
        statusLabel: flow.isActive ? "Active" : "Inactive",
        matchingNodes: [],
        nodeCount: 0,
        isNameMatchOnly: true
      }));
    }
  }

  highlightText(text, query) {
    if (!query || !text) {
      return [{ text: text, match: false, class: "" }];
    }
    const parts = [];
    // eslint-disable-next-line no-useless-escape
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
          match: false,
          class: ""
        });
      }
      parts.push({
        text: match[1],
        match: true,
        class: "highlighted-token"
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        match: false,
        class: ""
      });
    }

    return parts;
  }

  getProcessTypeLabel(type) {
    switch (type) {
      case "RecordTrigger":
        return "Record-Triggered Flow";
      case "ScreenFlow":
        return "Screen Flow";
      case "AutoLaunchedFlow":
        return "Autolaunched Flow";
      default:
        return type;
    }
  }

  openVisualizer(event) {
    const flowId = event.currentTarget.dataset.flowId;
    const nodeId = event.currentTarget.dataset.nodeId;
    const flow = this.indexedFlows.find((f) => f.durableId === flowId);

    if (flow) {
      this.selectedFlowId = flow.durableId;
      this.selectedFlowApiName = flow.apiName;
      this.selectedFlowLabel = flow.label;
      this.selectedNodeId = nodeId || null;
      this.isModalOpen = true;
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedFlowId = null;
    this.selectedFlowApiName = null;
    this.selectedFlowLabel = null;
    this.selectedNodeId = null;
  }

  handleBackClick() {
    // Fire event to close flow browser and return to main Command Center
    this.dispatchEvent(new CustomEvent("close"));
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: title,
        message: message,
        variant: variant
      })
    );
  }

  disconnectedCallback() {
    this.isIndexing = false;
  }

  handleRefreshIndex() {
    // Clear the module-level cache
    cachedIndexedFlows = null;
    cachedIndexedCount = 0;
    cachedTotalFlows = 0;

    // Reset component state
    this.indexedFlows = [];
    this.indexedCount = 0;

    this.showToast(
      "Refreshing Index",
      "Started scanning and indexing flows in background.",
      "info"
    );

    // Restart indexing
    this.startBackgroundIndexing();
  }
}
