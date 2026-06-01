import { LightningElement, api, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";

export default class TriggerActionSourceView extends NavigationMixin(
  LightningElement
) {
  @api className;
  @api showModal = false;
  @api recordId;

  @api
  get manualBody() {
    return this._manualBody;
  }
  set manualBody(value) {
    this._manualBody = value;
    if (value) {
      this.classBody = value;
      this.isLoading = false;
      this.error = undefined;
    }
  }

  _manualBody;
  classBody;
  isLoading = false;
  error;

  @wire(getApexClassBody, { className: "$className" })
  wiredClassBody({ error, data }) {
    if (this._manualBody) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    if (data) {
      this.classBody = data;
      this.error = undefined;
      this.isLoading = false;
    } else if (error) {
      this.error = error.body?.message || error.message;
      this.classBody = undefined;
      this.isLoading = false;
    }
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }

  handleOpenTrigger() {
    if (this.recordId) {
      this[NavigationMixin.Navigate]({
        type: "standard__recordPage",
        attributes: {
          recordId: this.recordId,
          objectApiName: "ApexTrigger",
          actionName: "view"
        }
      });
    }
  }
}
