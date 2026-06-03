import { LightningElement, api, track } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import MERMAID_RESOURCE from "@salesforce/resourceUrl/mermaid";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertFlowToMermaid } from "./flowLensConverter";
export { convertFlowToMermaid };

// Salesforce ID format: 15 or 18 alphanumeric characters
const SFDC_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;

// Dynamic CSS injected into the shadow DOM to style Mermaid-generated SVG nodes.
// LWC CSS encapsulation prevents scoped styles from matching dynamic innerHTML elements,
// so we inject this as a raw <style> tag into the component's shadow root.
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
  /* Node Header (e.g. Assignment 📝) */
  .diagram-canvas svg text tspan.line:first-child,
  .diagram-canvas svg text tspan:first-child {
    font-weight: 800 !important;
    font-size: 13.5px !important;
    letter-spacing: 0.5px !important;
  }
  /* Node Name (e.g. Build Single Var - Quote) */
  .diagram-canvas svg text tspan.line:nth-child(2),
  .diagram-canvas svg text tspan:nth-child(2) {
    font-weight: 600 !important;
    font-size: 12.5px !important;
  }
  /* Logic details & code lines (e.g. SingleVar.Id = Record.Id) */
  .diagram-canvas svg text tspan.line:nth-child(n+4),
  .diagram-canvas svg text tspan:nth-child(n+4) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 11.5px !important;
    font-weight: 400 !important;
    letter-spacing: -0.1px !important;
  }
  .diagram-canvas svg .pink text tspan.line:nth-child(n+4),
  .diagram-canvas svg .pink text tspan:nth-child(n+4),
  .diagram-canvas svg .orange text tspan.line:nth-child(n+4),
  .diagram-canvas svg .orange text tspan:nth-child(n+4),
  .diagram-canvas svg .navy text tspan.line:nth-child(n+4),
  .diagram-canvas svg .navy text tspan:nth-child(n+4),
  .diagram-canvas svg .blue text tspan.line:nth-child(n+4),
  .diagram-canvas svg .blue text tspan:nth-child(n+4) {
    fill: rgba(255, 255, 255, 0.85) !important;
  }
`;

export default class FlowVisualizer extends LightningElement {
  @api flowId;
  @api flowName;
  @api highlightNodeId;

  @track error;
  @track isReady = false;
  @track loadingMessage = "Loading visualization libraries...";

  @track zoomLevel = 1.0;
  naturalWidth;
  naturalHeight;

  sessionId;
  orgDomainUrl;
  mermaidCode;
  copiedMermaidCode;
  isLibraryLoaded = false;
  _isDestroyed = false;

  // Drag scroll state
  isMouseDown = false;
  startX = 0;
  startY = 0;
  scrollLeft = 0;
  scrollTop = 0;

  get zoomPercentage() {
    return `${Math.round(this.zoomLevel * 100)}%`;
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
      // Load Mermaid JS Static Resource
      if (!this.isLibraryLoaded) {
        await loadScript(this, MERMAID_RESOURCE);
        this.isLibraryLoaded = true;
      }

      this.loadingMessage = "Authenticating session...";
      // Fetch session info
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

      // Fetch flow metadata
      await this.fetchFlowMetadata();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isReady = false;
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

      this.loadingMessage = "Generating flowchart diagram...";

      // Translate the Metadata JSON using our flow-lens port
      // We pass includeTitle = false for rendering inside LWC to avoid duplicate title blocks,
      // but keep includeTitle = true for copied/portable Mermaid code.
      this.mermaidCode = convertFlowToMermaid(
        data.Metadata,
        this.flowName,
        false
      );
      if (this.highlightNodeId) {
        this.mermaidCode += `\n  style ${this.highlightNodeId} stroke:#FF5D5D,stroke-width:5px,stroke-dasharray:5;`;
      }
      this.copiedMermaidCode = convertFlowToMermaid(
        data.Metadata,
        this.flowName,
        true
      );

      // Render the diagram
      this.renderDiagram();
    } catch (err) {
      this.error = `REST callout failed: ${err.message}. Please verify if CORS allows requests from this Lightning origin to your Salesforce API domain.`;
      this.isReady = false;
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

  async renderDiagram() {
    try {
      // Initialize Mermaid configuration
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        htmlLabels: false,
        themeVariables: {
          fontFamily:
            "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        },
        state: {
          htmlLabels: false
        },
        stateDiagram: {
          htmlLabels: false
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: false
        }
      });

      // SVG generation id
      const chartId = `mermaid_chart_${this.flowId}`;

      // Render to SVG
      const { svg: svgCode } = await window.mermaid.render(
        chartId,
        this.mermaidCode
      );
      this.isReady = true;

      // Use a short delay to ensure DOM element is rendered after isReady triggers re-render
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        if (this._isDestroyed) return;

        const canvas = this.template.querySelector(".diagram-canvas");
        if (canvas) {
          // lwc:dom="manual" container — innerHTML is the only way to inject Mermaid SVG output
          // eslint-disable-next-line @lwc/lwc/no-inner-html
          canvas.innerHTML = svgCode;

          // Inject custom CSS styling to the generated SVG nodes
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

          // Left-align text inside rectangle nodes (excluding start/end headers)
          const nodeGroups = canvas.querySelectorAll("g.node");
          nodeGroups.forEach((nodeGroup) => {
            const nodeId = nodeGroup.getAttribute("id");
            if (
              nodeId &&
              !nodeId.includes("_Logic") &&
              (nodeId.includes("FLOW_START") ||
                nodeId.includes("FLOW_END") ||
                nodeId.includes("METHOD_START") ||
                nodeId.includes("METHOD_END"))
            ) {
              return;
            }
            const rect = nodeGroup.querySelector("rect");
            const text = nodeGroup.querySelector("text");
            if (rect && text) {
              const width = parseFloat(rect.getAttribute("width"));
              if (!isNaN(width)) {
                text.style.textAnchor = "start";
                const padding = 16;
                const shiftX = -(width / 2) + padding;
                text.setAttribute("transform", `translate(${shiftX}, 0)`);
              }
            }
          });

          // Inject extracted style constant to bypass LWC shadow DOM scoping
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
      const wrapperWidth = wrapper.clientWidth - 48; // padding
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
    this.loadingMessage = "Retrying loading visualization...";
    this.loadLibraries();
  }

  async handleCopyCode() {
    const codeToCopy = this.copiedMermaidCode || this.mermaidCode;
    const text = `\`\`\`mermaid\n${codeToCopy}\n\`\`\``;
    try {
      // Prefer modern Clipboard API, fall back to deprecated execCommand
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

  handleOpenFlowBuilder() {
    // Flow Builder requires the flowDefId parameter when passing the FlowDefinition (300) ID.
    // Using flowId with a 300 ID results in an error.
    const url = `${this.orgDomainUrl}/builder_platform_interaction/flowBuilder.app?flowDefId=${this.flowId}`;
    window.open(url, "_blank");
  }

  // --- Drag-Scroll Event Handlers ---
  handleMouseDown(event) {
    // Only drag with primary mouse button
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
    const walkX = (x - this.startX) * 1.5; // Scroll speed factor
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
