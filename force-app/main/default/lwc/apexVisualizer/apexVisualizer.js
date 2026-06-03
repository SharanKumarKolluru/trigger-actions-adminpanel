import { LightningElement, api, track } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import MERMAID_RESOURCE from "@salesforce/resourceUrl/mermaid";
import APEX_PARSER_RESOURCE from "@salesforce/resourceUrl/apexParser";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertApexToMermaid } from "./apexLensConverter";

// Styles injected dynamically to bypass Shadow DOM constraints on SVG elements
const DIAGRAM_STYLES = `
  .diagram-canvas svg .pink rect,
  .diagram-canvas svg .pink polygon,
  .diagram-canvas svg .pink circle,
  .diagram-canvas svg .pink ellipse,
  .diagram-canvas svg .pink path,
  .diagram-canvas svg .state.pink rect {
    fill: #F43F5E !important;
    stroke: #BE185D !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .orange rect,
  .diagram-canvas svg .orange polygon,
  .diagram-canvas svg .orange circle,
  .diagram-canvas svg .orange ellipse,
  .diagram-canvas svg .orange path,
  .diagram-canvas svg .state.orange rect {
    fill: #F97316 !important;
    stroke: #C2410C !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .navy rect,
  .diagram-canvas svg .navy polygon,
  .diagram-canvas svg .navy circle,
  .diagram-canvas svg .navy ellipse,
  .diagram-canvas svg .navy path,
  .diagram-canvas svg .state.navy rect {
    fill: #475569 !important;
    stroke: #1E293B !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .blue rect,
  .diagram-canvas svg .blue polygon,
  .diagram-canvas svg .blue circle,
  .diagram-canvas svg .blue ellipse,
  .diagram-canvas svg .blue path,
  .diagram-canvas svg .state.blue rect {
    fill: #0284C7 !important;
    stroke: #0369A1 !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg text,
  .diagram-canvas svg tspan,
  .diagram-canvas svg span {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  }
  .diagram-canvas svg .pink text,
  .diagram-canvas svg .pink span,
  .diagram-canvas svg .pink tspan,
  .diagram-canvas svg .orange text,
  .diagram-canvas svg .orange span,
  .diagram-canvas svg .orange tspan,
  .diagram-canvas svg .navy text,
  .diagram-canvas svg .navy span,
  .diagram-canvas svg .navy tspan,
  .diagram-canvas svg .blue text,
  .diagram-canvas svg .blue span,
  .diagram-canvas svg .blue tspan {
    color: #ffffff !important;
    fill: #ffffff !important;
    stroke: none !important;
  }
  .diagram-canvas svg .state rect,
  .diagram-canvas svg .node rect {
    rx: 8px !important;
    ry: 8px !important;
  }

  /* --- Typography Hierarchy for Code/Details --- */
  
  /* Default node headers (first line in nodes) */
  .diagram-canvas svg text tspan:first-child,
  .diagram-canvas svg text tspan.line:first-child {
    font-weight: 800 !important;
    font-size: 13.5px !important;
    letter-spacing: 0.5px !important;
  }

  /* Code/Logic Nodes (override to be sans-serif and normal weight) */
  .diagram-canvas svg [id*="action_"] text,
  .diagram-canvas svg [id*="action_"] span,
  .diagram-canvas svg [id*="action_"] tspan,
  .diagram-canvas svg [id*="return_"] text,
  .diagram-canvas svg [id*="return_"] span,
  .diagram-canvas svg [id*="return_"] tspan,
  .diagram-canvas svg [id*="_Logic"] text,
  .diagram-canvas svg [id*="_Logic"] span,
  .diagram-canvas svg [id*="_Logic"] tspan {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 11.5px !important;
    letter-spacing: -0.1px !important;
  }

  /* DML Nodes (Line 1: Header, Lines 2+: Code) */
  .diagram-canvas svg [id*="dml_"] text tspan:first-child,
  .diagram-canvas svg [id*="dml_"] text tspan.line:first-child {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 800 !important;
    font-size: 13.5px !important;
    letter-spacing: 0.5px !important;
  }
  .diagram-canvas svg [id*="dml_"] text tspan:nth-child(n+2),
  .diagram-canvas svg [id*="dml_"] text tspan.line:nth-child(n+2) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 11.5px !important;
    letter-spacing: -0.1px !important;
  }
`;

export default class ApexVisualizer extends LightningElement {
  @api className;

  @track error;
  @track isReady = false;
  @track loadingMessage = "Loading parsing libraries...";

  @track selectedMethod = "";
  @track methodsList = [];

  @track zoomLevel = 1.0;
  naturalWidth;
  naturalHeight;

  classId;
  classBody;
  symbolTable;
  sessionId;
  orgDomainUrl;
  mermaidCode;
  isLibraryLoaded = false;
  _isDestroyed = false;

  // Drag scroll panning state
  isMouseDown = false;
  startX = 0;
  startY = 0;
  scrollLeft = 0;
  scrollTop = 0;

  get workspaceClass() {
    return this.isReady ? "workspace-active visualizer-content" : "slds-hide";
  }

  get zoomPercentage() {
    return `${Math.round(this.zoomLevel * 100)}%`;
  }

  get methodOptions() {
    return (this.methodsList || []).map((methodName) => {
      return { label: methodName, value: methodName };
    });
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadLibraries();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  async loadLibraries() {
    try {
      if (!this.isLibraryLoaded) {
        // Load both Mermaid and Certinia's Apex Parser script
        await Promise.all([
          loadScript(this, MERMAID_RESOURCE),
          loadScript(this, APEX_PARSER_RESOURCE)
        ]);
        this.isLibraryLoaded = true;
      }

      this.loadingMessage = "Authenticating session...";
      const [session, domain] = await Promise.all([
        getSessionId(),
        getOrgDomainUrl()
      ]);

      this.sessionId = session;
      this.orgDomainUrl = domain;

      if (!this.sessionId) {
        throw new Error(
          "Failed to retrieve an active API session token. Please ensure your user has appropriate administrative rights."
        );
      }

      await this.fetchApexClass();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isReady = false;
    }
  }

  async fetchApexClass() {
    this.loadingMessage = "Fetching Apex class code and symbol table...";
    try {
      const query = `SELECT Id, Body, SymbolTable FROM ApexClass WHERE Name = '${this.className}'`;
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
        throw new Error(`Tooling API query failed: ${errText}`);
      }

      const data = await response.json();
      if (!data.records || data.records.length === 0) {
        throw new Error(
          `Apex class "${this.className}" was not found in the org.`
        );
      }

      const record = data.records[0];
      this.classId = record.Id;
      this.classBody = record.Body;
      this.symbolTable = record.SymbolTable;

      this.generateFlowchart();
    } catch (err) {
      this.error = `Tooling API fetch failed: ${err.message || err}`;
      this.isReady = false;
    }
  }

  generateFlowchart() {
    this.loadingMessage = "Generating flowchart diagram...";
    try {
      const result = convertApexToMermaid(this.classBody, this.selectedMethod);
      this.mermaidCode = result.mermaidCode;
      this.selectedMethod = result.selectedMethod;
      this.methodsList = result.methods;

      this.renderDiagram();
    } catch (err) {
      this.error = `Flowchart generation failed: ${err.message || err}`;
      this.isReady = false;
    }
  }

  async renderDiagram() {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        htmlLabels: false,
        themeVariables: {
          fontFamily:
            "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: false
        }
      });

      const chartId = `mermaid_chart_${this.classId}`;

      const { svg: svgCode } = await window.mermaid.render(
        chartId,
        this.mermaidCode
      );
      this.isReady = true;

      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        if (this._isDestroyed) return;

        const canvas = this.template.querySelector(".diagram-canvas");
        if (canvas) {
          // eslint-disable-next-line @lwc/lwc/no-inner-html
          canvas.innerHTML = svgCode;

          const svgElement = canvas.querySelector("svg");
          if (svgElement) {
            const viewBox = svgElement.getAttribute("viewBox");
            if (viewBox) {
              const parts = viewBox.split(/\s+/);
              if (parts.length >= 4) {
                this.naturalWidth = parseFloat(parts[2]);
                this.naturalHeight = parseFloat(parts[3]);
              }
            }

            if (!this.naturalWidth) {
              this.naturalWidth =
                parseFloat(svgElement.getAttribute("width")) || 800;
            }
            if (!this.naturalHeight) {
              this.naturalHeight =
                parseFloat(svgElement.getAttribute("height")) || 600;
            }

            this.applyZoom();
          }

          const styleTag = document.createElement("style");
          styleTag.textContent = DIAGRAM_STYLES;
          canvas.appendChild(styleTag);
        }
      }, 50);
    } catch (err) {
      this.error = `Mermaid.js rendering failed: ${err.message}`;
      this.isReady = false;
    }
  }

  handleMethodChange(event) {
    this.selectedMethod = event.detail.value;
    this.generateFlowchart();
  }

  handleZoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.15, 3.0);
    this.applyZoom();
  }

  handleZoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.15, 0.3);
    this.applyZoom();
  }

  handleZoomReset() {
    this.zoomLevel = 1.0;
    this.applyZoom();
  }

  handleZoomFit() {
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper && this.naturalWidth) {
      const wrapperWidth = wrapper.clientWidth - 48;
      this.zoomLevel = Math.min(wrapperWidth / this.naturalWidth, 1.0);
      this.applyZoom();
    }
  }

  applyZoom() {
    const canvas = this.template.querySelector(".diagram-canvas");
    if (canvas) {
      const svgElement = canvas.querySelector("svg");
      if (svgElement && this.naturalWidth && this.naturalHeight) {
        svgElement.style.width = `${this.naturalWidth * this.zoomLevel}px`;
        svgElement.style.height = `${this.naturalHeight * this.zoomLevel}px`;
      }
    }
  }

  handleRetry() {
    this.error = null;
    this.isReady = false;
    this.loadingMessage = "Retrying loading libraries...";
    this.loadLibraries();
  }

  async handleCopyCode() {
    const text = `\`\`\`mermaid\n${this.mermaidCode}\n\`\`\``;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      this.dispatchEvent(
        new ShowToastEvent({
          title: "Copied!",
          message: "Mermaid flowchart code copied to clipboard.",
          variant: "success"
        })
      );
    } catch (err) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Copy Failed",
          message: err.message,
          variant: "error"
        })
      );
    }
  }

  handleOpenApexClass() {
    const url = `${this.orgDomainUrl}/lightning/setup/ApexClasses/page?address=%2F${this.classId}`;
    window.open(url, "_blank");
  }

  // --- Drag-Scroll Event Handlers ---
  handleMouseDown(event) {
    if (event.button !== 0) return;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (!wrapper) return;

    this.isMouseDown = true;
    wrapper.classList.add("grabbing");

    this.startX = event.pageX - wrapper.offsetLeft;
    this.startY = event.pageY - wrapper.offsetTop;
    this.scrollLeft = wrapper.scrollLeft;
    this.scrollTop = wrapper.scrollTop;
  }

  handleMouseMove(event) {
    if (!this.isMouseDown) return;
    event.preventDefault();
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (!wrapper) return;

    const x = event.pageX - wrapper.offsetLeft;
    const y = event.pageY - wrapper.offsetTop;
    const walkX = (x - this.startX) * 1.5;
    const walkY = (y - this.startY) * 1.5;

    wrapper.scrollLeft = this.scrollLeft - walkX;
    wrapper.scrollTop = this.scrollTop - walkY;
  }

  handleMouseUp() {
    this.isMouseDown = false;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper) {
      wrapper.classList.remove("grabbing");
    }
  }

  handleMouseLeave() {
    this.isMouseDown = false;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper) {
      wrapper.classList.remove("grabbing");
    }
  }
}
