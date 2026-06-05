import { LightningElement, api, track } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import MERMAID_RESOURCE from "@salesforce/resourceUrl/mermaid";

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

  /* --- Flow-specific Typography Hierarchy --- */
  .flow-diagram svg text tspan.line:first-child,
  .flow-diagram svg text tspan:first-child {
    font-weight: 800 !important;
    font-size: 13px !important;
    letter-spacing: 0.5px !important;
  }
  .flow-diagram svg text tspan.line:nth-child(2),
  .flow-diagram svg text tspan:nth-child(2) {
    font-weight: 600 !important;
    font-size: 12px !important;
  }
  .flow-diagram svg text tspan.line:nth-child(n+4),
  .flow-diagram svg text tspan:nth-child(n+4) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 11.5px !important;
    font-weight: 400 !important;
    letter-spacing: -0.1px !important;
  }
  .flow-diagram svg .pink text tspan.line:nth-child(n+4),
  .flow-diagram svg .pink text tspan:nth-child(n+4),
  .flow-diagram svg .orange text tspan.line:nth-child(n+4),
  .flow-diagram svg .orange text tspan:nth-child(n+4),
  .flow-diagram svg .navy text tspan.line:nth-child(n+4),
  .flow-diagram svg .navy text tspan:nth-child(n+4),
  .flow-diagram svg .blue text tspan.line:nth-child(n+4),
  .flow-diagram svg .blue text tspan:nth-child(n+4) {
    fill: rgba(255, 255, 255, 0.85) !important;
  }

  /* --- Apex-specific Typography Overrides --- */
  .apex-diagram svg [id*="choice_"]:not([id*="_Logic"]) text tspan,
  .apex-diagram svg [id*="choice_"]:not([id*="_Logic"]) text tspan.line,
  .apex-diagram svg [id*="loop_cond_"]:not([id*="_Logic"]) text tspan,
  .apex-diagram svg [id*="loop_cond_"]:not([id*="_Logic"]) text tspan.line,
  .apex-diagram svg [id*="METHOD_START"] text tspan,
  .apex-diagram svg [id*="METHOD_START"] text tspan.line,
  .apex-diagram svg [id*="METHOD_END"] text tspan,
  .apex-diagram svg [id*="METHOD_END"] text tspan.line,
  .apex-diagram svg [id*="dml_"] text tspan:first-child,
  .apex-diagram svg [id*="dml_"] text tspan.line:first-child {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 800 !important;
    font-size: 13.5px !important;
    letter-spacing: 0.5px !important;
  }
  .apex-diagram svg [id*="action_"] text,
  .apex-diagram svg [id*="action_"] span,
  .apex-diagram svg [id*="action_"] tspan,
  .apex-diagram svg [id*="return_"] text,
  .apex-diagram svg [id*="return_"] span,
  .apex-diagram svg [id*="return_"] tspan,
  .apex-diagram svg [id*="_Logic"] text,
  .apex-diagram svg [id*="_Logic"] span,
  .apex-diagram svg [id*="_Logic"] tspan {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 11.5px !important;
    letter-spacing: -0.1px !important;
  }
  .apex-diagram svg [id*="dml_"] text tspan:nth-child(n+2),
  .apex-diagram svg [id*="dml_"] text tspan.line:nth-child(n+2) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 11.5px !important;
    letter-spacing: -0.1px !important;
  }
`;

export default class DiagramViewer extends LightningElement {
  @api title = "";
  @api diagramId = "";
  @api builderUrl = "";
  @api builderButtonLabel = "";
  @api isLoading = false;
  @api loadingMessage = "";
  @api error = "";
  @api type = "flow"; // 'flow' or 'apex'
  @api resources;

  @track isDrawerOpen = false;

  _mermaidCode = "";
  _copiedMermaidCode = "";

  get canvasClass() {
    return `diagram-canvas slds-align_absolute-center ${this.type}-diagram`;
  }

  @api
  get mermaidCode() {
    return this._mermaidCode;
  }
  set mermaidCode(value) {
    this._mermaidCode = value;
    if (this.isLibraryLoaded && value) {
      this.renderDiagram();
    }
  }

  @api
  get copiedMermaidCode() {
    return this._copiedMermaidCode;
  }
  set copiedMermaidCode(value) {
    this._copiedMermaidCode = value;
  }

  @track zoomLevel = 1.0;
  naturalWidth;
  naturalHeight;

  isLibraryLoaded = false;
  _isDestroyed = false;

  // Drag scroll panning state
  isMouseDown = false;
  startX = 0;
  startY = 0;
  scrollLeft = 0;
  scrollTop = 0;

  get zoomPercentage() {
    return `${Math.round(this.zoomLevel * 100)}%`;
  }

  get effectiveBuilderButtonLabel() {
    return this.builderButtonLabel || "Open Builder";
  }

  get showLoading() {
    return this.isLoading && !this.error;
  }

  get workspaceClass() {
    return !this.isLoading && !this.error && this.mermaidCode
      ? "workspace-active"
      : "slds-hide";
  }

  get hasResources() {
    if (!this.resources) return false;
    const { variables, formulas, constants, textTemplates } = this.resources;
    return (
      (variables && variables.length > 0) ||
      (formulas && formulas.length > 0) ||
      (constants && constants.length > 0) ||
      (textTemplates && textTemplates.length > 0)
    );
  }

  get drawerClass() {
    return `diagram-drawer ${this.isDrawerOpen ? "open" : ""}`;
  }

  get drawerTitle() {
    return this.type === "flow" ? "Flow Resources" : "Apex Resources";
  }

  get hasVariables() {
    return (
      this.resources &&
      this.resources.variables &&
      this.resources.variables.length > 0
    );
  }
  get variablesCount() {
    return this.hasVariables ? this.resources.variables.length : 0;
  }
  get hasFormulas() {
    return (
      this.resources &&
      this.resources.formulas &&
      this.resources.formulas.length > 0
    );
  }
  get formulasCount() {
    return this.hasFormulas ? this.resources.formulas.length : 0;
  }
  get hasConstants() {
    return (
      this.resources &&
      this.resources.constants &&
      this.resources.constants.length > 0
    );
  }
  get constantsCount() {
    return this.hasConstants ? this.resources.constants.length : 0;
  }
  get hasTextTemplates() {
    return (
      this.resources &&
      this.resources.textTemplates &&
      this.resources.textTemplates.length > 0
    );
  }
  get textTemplatesCount() {
    return this.hasTextTemplates ? this.resources.textTemplates.length : 0;
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadLibrary();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  async loadLibrary() {
    try {
      if (!this.isLibraryLoaded) {
        await loadScript(this, MERMAID_RESOURCE);
        this.isLibraryLoaded = true;
      }
      if (this.mermaidCode) {
        this.renderDiagram();
      }
    } catch (err) {
      if (!this._isDestroyed) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Error loading visualization libraries",
            message: err.message || err,
            variant: "error"
          })
        );
      }
    }
  }

  async renderDiagram() {
    if (!this.mermaidCode) return;

    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        htmlLabels: false,
        themeVariables: {
          fontFamily:
            "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "15px"
        },
        state: {
          htmlLabels: false
        },
        stateDiagram: {
          htmlLabels: false
        },
        flowchart: {
          useMaxWidth: false,
          htmlLabels: false,
          padding: 18
        }
      });

      const chartUniqueId = `mermaid_chart_${this.diagramId || "default"}`;

      // Render to SVG
      const { svg: svgCode } = await window.mermaid.render(
        chartUniqueId,
        this.mermaidCode
      );

      // lwc:dom="manual" container - wait for DOM update using a short delay
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

          // Programmatically left-align text inside rectangle nodes
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
                const padding = 12;
                const shiftX = -(width / 2) + padding;
                text.setAttribute("transform", `translate(${shiftX}, 0)`);
              }
            }
          });

          // Inject custom styles override
          const styleTag = document.createElement("style");
          styleTag.textContent = DIAGRAM_STYLES;
          canvas.appendChild(styleTag);
        }
      }, 50);
    } catch (err) {
      if (!this._isDestroyed) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Mermaid Rendering Error",
            message: err.message || err,
            variant: "error"
          })
        );
      }
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
    this.dispatchEvent(new CustomEvent("retry"));
  }

  generateResourcesMarkdown() {
    if (!this.hasResources) return "";

    let md = "";
    const typeLabel = this.type === "flow" ? "Flow" : "Apex";
    md += `\n\n## ${typeLabel} Resources`;

    const { variables, formulas, constants, textTemplates } = this.resources;

    const escapePipe = (str) => {
      if (!str) return "";
      return String(str).replace(/\|/g, "\\|");
    };

    // Variables & Properties
    if (variables && variables.length > 0) {
      if (this.type === "flow") {
        md += `\n\n### Variables\n| Name | Data Type | Collection | Access |\n| --- | --- | --- | --- |`;
        variables.forEach((v) => {
          const coll = v.isCollection ? "True" : "False";
          md += `\n| ${escapePipe(v.name)} | ${escapePipe(v.dataType)} | ${coll} | ${escapePipe(v.access)} |`;
        });
      } else {
        md += `\n\n### Variables & Properties\n| Name | Data Type | Collection | Access | Scope |\n| --- | --- | --- | --- | --- |`;
        variables.forEach((v) => {
          const coll = v.isCollection ? "True" : "False";
          md += `\n| ${escapePipe(v.name)} | ${escapePipe(v.dataType)} | ${coll} | ${escapePipe(v.access)} | ${escapePipe(v.scope)} |`;
        });
      }
    }

    // Formulas
    if (formulas && formulas.length > 0) {
      md += `\n\n### Formulas\n| Name | Data Type | Expression |\n| --- | --- | --- |`;
      formulas.forEach((f) => {
        const cleanExpression = escapePipe(f.expression).replace(
          /\r?\n/g,
          "<br/>"
        );
        md += `\n| ${escapePipe(f.name)} | ${escapePipe(f.dataType)} | \`${cleanExpression}\` |`;
      });
    }

    // Constants
    if (constants && constants.length > 0) {
      md += `\n\n### Constants\n| Name | Data Type | Value |\n| --- | --- | --- |`;
      constants.forEach((c) => {
        const cleanValue = escapePipe(c.value).replace(/\r?\n/g, "<br/>");
        md += `\n| ${escapePipe(c.name)} | ${escapePipe(c.dataType)} | \`${cleanValue}\` |`;
      });
    }

    // Text Templates
    if (textTemplates && textTemplates.length > 0) {
      md += `\n\n### Text Templates\n| Name | Content |\n| --- | --- |`;
      textTemplates.forEach((t) => {
        const cleanText = escapePipe(t.text).replace(/\r?\n/g, "<br/>");
        md += `\n| ${escapePipe(t.name)} | ${cleanText} |`;
      });
    }

    return md;
  }

  async handleCopyCode() {
    const codeToCopy = this.copiedMermaidCode || this.mermaidCode;
    let text = `\`\`\`mermaid\n${codeToCopy}\n\`\`\``;

    if (this.hasResources) {
      text += this.generateResourcesMarkdown();
    }
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

  handleRedirect() {
    if (this.builderUrl) {
      window.open(this.builderUrl, "_blank");
    }
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
