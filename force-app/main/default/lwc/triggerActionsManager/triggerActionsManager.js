import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import { NavigationMixin } from "lightning/navigation";
import getAllTriggerActions from "@salesforce/apex/TriggerActionService.getAllTriggerActions";
import getTriggerActionById from "@salesforce/apex/TriggerActionService.getTriggerActionById";
import getAvailableSObjects from "@salesforce/apex/TriggerActionService.getAvailableSObjects";
import getFlowIdByName from "@salesforce/apex/TriggerActionService.getFlowIdByName";
import getNativeAutomations from "@salesforce/apex/TriggerActionService.getNativeAutomations";
import getDiscoveredObjects from "@salesforce/apex/TriggerActionService.getDiscoveredObjects";
import createTriggerSetting from "@salesforce/apex/TriggerActionService.createTriggerSetting";
import getGlobalStats from "@salesforce/apex/TriggerActionService.getGlobalStats";

const CONTEXT_LABELS = [
  { field: "Before_Insert__c", label: "Before Insert" },
  { field: "After_Insert__c", label: "After Insert" },
  { field: "Before_Update__c", label: "Before Update" },
  { field: "After_Update__c", label: "After Update" },
  { field: "Before_Delete__c", label: "Before Delete" },
  { field: "After_Delete__c", label: "After Delete" },
  { field: "After_Undelete__c", label: "After Undelete" }
];

export default class TriggerActionsManager extends NavigationMixin(
  LightningElement
) {
  @api title;
  actions = [];
  selectedAction = null;
  selectedObjectName = "";
  isLoading = false;
  showFormModal = false;
  showSettingFormModal = false;
  showDiscoveryModal = false;
  showSourceModal = false;
  sourceCode = "";
  sourceClassName = "";
  searchTerm = "";
  isCreating = false;
  availableSObjects = [];
  discoveredObjects = [];
  globalStats = {};
  nativeAutomations = { triggers: [], flows: [] };
  activeTab = "actions";
  _wiredActionsResult;
  _wiredSObjectsResult;
  _wiredNativeResult;
  _wiredStatsResult;

  @wire(getGlobalStats)
  wiredStats(result) {
    this._wiredStatsResult = result;
    if (result.data) {
      this.globalStats = result.data;
    }
  }

  @wire(getNativeAutomations, { objectName: "$selectedObjectName" })
  wiredNative(result) {
    this._wiredNativeResult = result;
    if (result.data) {
      this.nativeAutomations = result.data;
    }
  }

  @wire(getAllTriggerActions)
  wiredActions(result) {
    this._wiredActionsResult = result;
    if (result.data) {
      this.actions = result.data;
    } else if (result.error) {
      this.showError(
        "Error loading trigger actions",
        result.error.body.message
      );
    }
  }

  @wire(getAvailableSObjects)
  wiredSObjects(result) {
    this._wiredSObjectsResult = result;
    if (result.data) {
      this.availableSObjects = result.data;
    }
  }

  // --- Computed properties ---

  get objectList() {
    if (!this.availableSObjects) return [];

    const actionCounts = {};
    if (this.actions) {
      this.actions.forEach((action) => {
        const obj = action.Object_API_Name__c;
        actionCounts[obj] = (actionCounts[obj] || 0) + 1;
      });
    }

    return this.availableSObjects
      .filter(
        (obj) =>
          !this.searchTerm ||
          obj.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      )
      .map((obj) => ({
        name: obj.name,
        actionCount: actionCounts[obj.name] || 0,
        cssClass:
          "object-item" +
          (this.selectedObjectName === obj.name ? " selected" : "")
      }));
  }

  get objectActions() {
    if (!this.selectedObjectName) return [];

    const filtered = this.actions.filter(
      (a) => a.Object_API_Name__c === this.selectedObjectName
    );

    const sections = [];
    for (const ctx of CONTEXT_LABELS) {
      const contextActions = filtered
        .filter((a) => a[ctx.field])
        .sort((a, b) => (a.Order__c || 0) - (b.Order__c || 0))
        .map((action) => ({
          ...action,
          compositeId: `${ctx.field}-${action.Id}`,
          cssClass:
            "action-item" +
            (this.selectedAction && this.selectedAction.Id === action.Id
              ? " selected"
              : "")
        }));

      if (contextActions.length > 0) {
        sections.push({
          key: ctx.field,
          label: ctx.label,
          actions: contextActions
        });
      }
    }
    return sections;
  }

  get hasObjectActions() {
    return this.objectActions.length > 0;
  }

  get noActionSelected() {
    return !this.selectedAction;
  }

  get activeContextLabels() {
    if (!this.selectedAction) return [];
    return CONTEXT_LABELS.filter((ctx) => this.selectedAction[ctx.field]).map(
      (ctx) => ({ label: ctx.label, key: ctx.field })
    );
  }

  get bypassIcon() {
    return this.selectedAction?.Bypass_Execution__c
      ? "utility:warning"
      : "utility:success";
  }

  get bypassLabel() {
    return this.selectedAction?.Bypass_Execution__c ? "Yes" : "No";
  }

  get flowRecursionIcon() {
    return this.selectedAction?.Allow_Flow_Recursion__c
      ? "utility:warning"
      : "utility:success";
  }

  get flowRecursionLabel() {
    return this.selectedAction?.Allow_Flow_Recursion__c ? "Yes" : "No";
  }

  get auditGroups() {
    if (!this.nativeAutomations) return [];

    return CONTEXT_LABELS.map((ctx) => {
      const items = [];

      // Add Triggers
      (this.nativeAutomations.triggers || []).forEach((t) => {
        const field = ctx.field.replace("__c", "").replace("_", ""); // BeforeInsert, AfterUpdate, etc
        if (t[`Usage${field}`]) {
          items.push({
            id: t.Id,
            name: t.Name,
            type: "Apex Trigger",
            icon: "utility:apex",
            status: t.Status,
            variant: t.Status === "Active" ? "success" : "lightest",
            isTrigger: true,
            isFlow: false,
            isManaged: !!t.NamespacePrefix,
            body: t.Body,
            buttonTitle: t.NamespacePrefix
              ? "Managed Package Trigger (View Restricted)"
              : "Open Trigger"
          });
        }
      });

      // Add Flows & Process Builders
      (this.nativeAutomations.flows || []).forEach((f) => {
        const isBefore = f.TriggerType === "RecordBeforeSave";
        const isAfter =
          f.TriggerType === "RecordAfterSave" || f.ProcessType === "Workflow";
        const triggerType = f.RecordTriggerType; // Create, Update, CreateAndUpdate, Delete

        const isInsert = !triggerType || triggerType.includes("Create");
        const isUpdate = !triggerType || triggerType.includes("Update");
        const isDelete = triggerType === "Delete";

        // Map Flow triggers to our contexts precisely
        let isRelevantContext = false;
        if (isBefore) {
          isRelevantContext =
            (isInsert && ctx.field === "Before_Insert__c") ||
            (isUpdate && ctx.field === "Before_Update__c");
        } else if (isAfter) {
          isRelevantContext =
            (isInsert && ctx.field === "After_Insert__c") ||
            (isUpdate && ctx.field === "After_Update__c") ||
            (isDelete && ctx.field === "Before_Delete__c");
        }

        if (isRelevantContext) {
          const isFlow =
            f.ProcessType === "AutoLaunchedFlow" || f.ProcessType === "Flow";
          const isManaged = !f.DurableId.startsWith("300");
          items.push({
            id: f.DurableId,
            name: f.Label,
            type: f.ProcessType === "Workflow" ? "Process Builder" : "Flow",
            icon:
              f.ProcessType === "Workflow" ? "utility:retire" : "utility:flow",
            status: f.IsActive ? "Active" : "Inactive",
            variant: f.IsActive ? "success" : "lightest",
            isTrigger: false,
            isFlow: isFlow,
            isManaged: isManaged,
            buttonTitle: isManaged
              ? "Managed Package Flow (Builder Restricted)"
              : "Open in Flow Builder"
          });
        }
      });

      return {
        ...ctx,
        items,
        hasItems: items.length > 0
      };
    }).filter((group) => group.hasItems);
  }

  // --- Event handlers ---

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
  }

  handleObjectClick(event) {
    const objectName = event.currentTarget.dataset.objectName;
    this.selectedObjectName = objectName;
    this.selectedAction = null;
  }

  async handleActionClick(event) {
    const actionId = event.currentTarget.dataset.actionId;
    this.isLoading = true;
    try {
      this.selectedAction = await getTriggerActionById({ actionId });
    } catch (error) {
      this.showError("Error", error.body?.message || error.message);
    } finally {
      this.isLoading = false;
    }
  }

  handleCreateNew() {
    if (!this.selectedObjectName) {
      this.showWarning("Please select an SObject first");
      return;
    }
    this.isCreating = true;
    this.selectedAction = null;
    this.showFormModal = true;
  }

  handleEdit() {
    if (!this.selectedAction) {
      this.showWarning("Please select an action to edit");
      return;
    }
    this.isCreating = false;
    this.showFormModal = true;
  }

  handleViewSource() {
    if (this.selectedAction?.Apex_Class_Name__c) {
      this.sourceClassName = this.selectedAction.Apex_Class_Name__c;
      this.sourceCode = "";
      this.showSourceModal = true;
    }
  }

  handleSourceClose() {
    this.showSourceModal = false;
    this.sourceCode = "";
    this.sourceClassName = "";
  }

  async handleOpenFlowBuilder() {
    const flowName = this.selectedAction?.Flow_Name__c;
    this.isLoading = true;
    try {
      const flowId = await getFlowIdByName({ flowName });
      if (flowId && flowId.startsWith("300")) {
        this.navigateToFlowBuilder(flowId);
      } else {
        this.showError(
          "Notice",
          "This is a managed package flow and cannot be opened directly in the Flow Builder."
        );
      }
    } catch (error) {
      this.showError(
        "Error opening Flow Builder",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleOpenNativeFlow(event) {
    const durableId = event.currentTarget.dataset.id;
    this.navigateToFlowBuilder(durableId);
  }

  handleViewTriggerSource(event) {
    const id = event.currentTarget.dataset.id;
    const trigger = (this.nativeAutomations.triggers || []).find(
      (t) => t.Id === id
    );
    if (trigger && trigger.Body) {
      this.sourceClassName = trigger.Name;
      this.sourceCode = trigger.Body;
      this.showSourceModal = true;
    }
  }

  handleOpenNativeTrigger(event) {
    const triggerId = event.currentTarget.dataset.id;
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: triggerId,
        objectApiName: "ApexTrigger",
        actionName: "view"
      }
    });
  }

  navigateToFlowBuilder(durableId) {
    this[NavigationMixin.Navigate]({
      type: "standard__webPage",
      attributes: {
        url: `/builder_platform_interaction/flowBuilder.app?flowDefId=${durableId}`
      }
    });
  }

  handleTabChange(event) {
    this.activeTab = event.target.value;
  }

  async handleOpenDiscovery() {
    this.isLoading = true;
    try {
      this.discoveredObjects = await getDiscoveredObjects();
      this.showDiscoveryModal = true;
    } catch (error) {
      this.showError(
        "Error discovering objects",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleCloseDiscovery() {
    this.showDiscoveryModal = false;
  }

  async handleInitializeObject(event) {
    const objectName = event.currentTarget.dataset.name;
    this.isLoading = true;
    try {
      await createTriggerSetting({
        objectName,
        bypassPermission: null,
        requiredPermission: null
      });
      this.showSuccess(
        `Initialization of ${objectName} enqueued. This may take a few seconds.`
      );
      this.handleCloseDiscovery();
      // Refresh will happen via the auto-refresh logic we already have
    } catch (error) {
      this.showError(
        "Error initializing object",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleFormClose() {
    this.showFormModal = false;
  }

  handleSaveSuccess() {
    this.showFormModal = false;
    this.selectedAction = null;
    this.showSuccess(
      "Trigger Action deployment started. The list will refresh shortly."
    );
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      this.refreshList().catch(() => {});
    }, 8000);
  }

  handleAddSObject() {
    this.showSettingFormModal = true;
  }

  handleSettingFormClose() {
    this.showSettingFormModal = false;
  }

  handleSettingSaveSuccess() {
    this.showSettingFormModal = false;
    this.showSuccess(
      "Trigger Setting deployment started. The SObject list will refresh shortly."
    );
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      this.refreshList().catch(() => {});
    }, 8000);
  }

  handleRefresh() {
    this.selectedAction = null;
    this.refreshList();
  }

  refreshList() {
    const promises = [];
    if (this._wiredActionsResult) {
      promises.push(refreshApex(this._wiredActionsResult));
    }
    if (this._wiredSObjectsResult) {
      promises.push(refreshApex(this._wiredSObjectsResult));
    }
    if (this._wiredNativeResult) {
      promises.push(refreshApex(this._wiredNativeResult));
    }
    if (this._wiredStatsResult) {
      promises.push(refreshApex(this._wiredStatsResult));
    }
    if (promises.length === 0) {
      return Promise.reject(new Error("Wire results not available"));
    }
    return Promise.all(promises)
      .then(() => {
        this.showSuccess("Data refreshed successfully.");
      })
      .catch((error) => {
        this.showError("Refresh Error", "Failed to refresh: " + error.message);
      });
  }

  showSuccess(message) {
    this.dispatchEvent(
      new ShowToastEvent({ title: "Success", message, variant: "success" })
    );
  }

  showWarning(message) {
    this.dispatchEvent(
      new ShowToastEvent({ title: "Warning", message, variant: "warning" })
    );
  }

  showError(title, message) {
    this.dispatchEvent(
      new ShowToastEvent({ title, message, variant: "error" })
    );
  }
}
