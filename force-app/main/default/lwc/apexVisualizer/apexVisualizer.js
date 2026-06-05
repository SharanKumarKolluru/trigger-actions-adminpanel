import { LightningElement, api, track } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import APEX_PARSER_RESOURCE from "@salesforce/resourceUrl/apexParser";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertApexToMermaid } from "./apexLensConverter";

export default class ApexVisualizer extends LightningElement {
  @api className;
  @api apiVersion = "v66.0";

  @track error;
  @track isLoading = true;
  @track loadingMessage = "Loading parsing libraries...";
  @track resources;

  @track selectedMethod = "";
  @track methodsList = [];

  classId;
  classBody;
  symbolTable;
  sessionId;
  orgDomainUrl;
  mermaidCode;
  isParserLoaded = false;
  _isDestroyed = false;

  get filteredResources() {
    if (!this.resources) return null;
    if (!this.selectedMethod) return this.resources;

    const filteredVariables = this.resources.variables.filter((v) => {
      return (
        v.scope === "Class Field" ||
        v.scope === "Class Property" ||
        v.scope === `Method: ${this.selectedMethod}()`
      );
    });

    return {
      ...this.resources,
      variables: filteredVariables
    };
  }

  get methodOptions() {
    return (this.methodsList || []).map((methodName) => {
      return { label: methodName, value: methodName };
    });
  }

  get builderUrl() {
    if (!this.orgDomainUrl || !this.classId) return "";
    return `${this.orgDomainUrl}/lightning/setup/ApexClasses/page?address=%2F${this.classId}`;
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
      this.isLoading = true;
      this.error = null;

      if (!this.isParserLoaded) {
        // Load Certinia's Apex Parser script
        await loadScript(this, APEX_PARSER_RESOURCE);
        this.isParserLoaded = true;
      }

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

      await this.fetchApexClass();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isLoading = false;
    }
  }

  async fetchApexClass() {
    this.loadingMessage = "Fetching Apex class code and symbol table...";
    try {
      const query = `SELECT Id, Body, SymbolTable FROM ApexClass WHERE Name = '${this.className}'`;
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
      this.resources = this.parseApexResources(this.symbolTable);

      this.generateFlowchart();
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `Tooling API fetch failed: ${err.message || err}`;
        this.isLoading = false;
      }
    }
  }

  generateFlowchart() {
    this.loadingMessage = "Generating flowchart diagram...";
    try {
      const result = convertApexToMermaid(this.classBody, this.selectedMethod);
      this.mermaidCode = result.mermaidCode;
      this.selectedMethod = result.selectedMethod;
      this.methodsList = result.methods;

      this.isLoading = false;
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `Flowchart generation failed: ${err.message || err}`;
        this.isLoading = false;
      }
    }
  }

  handleMethodChange(event) {
    this.selectedMethod = event.detail.value;
    this.isLoading = true;
    this.generateFlowchart();
  }

  handleRetry() {
    this.error = null;
    this.isLoading = true;
    this.loadLibraries();
  }

  parseApexResources(symbolTable) {
    if (!symbolTable) return null;

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

    // Sort methods by start line to match local variables to their enclosing methods
    const methods = getArray(symbolTable.methods)
      .map((m) => ({
        name: m.name,
        line: m.location ? m.location.line : 0
      }))
      .filter((m) => m.line > 0)
      .sort((a, b) => a.line - b.line);

    const getEnclosingMethod = (line) => {
      if (!line || methods.length === 0) return null;
      let enclosing = null;
      for (let i = 0; i < methods.length; i++) {
        if (methods[i].line <= line) {
          enclosing = methods[i].name;
        } else {
          break;
        }
      }
      return enclosing;
    };

    const uniqueVariables = new Map();

    // 1. Variables (Fields / Local variables / Parameters)
    getArray(symbolTable.variables).forEach((v) => {
      const typeText = v.type || "Object";
      const hasModifiers = v.modifiers && v.modifiers.length > 0;
      const modifiers = getArray(v.modifiers).join(" ") || "private";
      const line = v.location ? v.location.line : null;

      let scope = "Class Field";
      if (!hasModifiers && line) {
        const methodName = getEnclosingMethod(line);
        if (methodName) {
          scope = `Method: ${methodName}()`;
        }
      }

      uniqueVariables.set(v.name, {
        name: v.name,
        dataType: typeText,
        isCollection: typeText.includes("<") || typeText.includes("[]"),
        access: modifiers,
        scope: scope
      });
    });

    // 2. Properties (prefer properties over variables if names clash)
    getArray(symbolTable.properties).forEach((p) => {
      const typeText = p.type || "Object";
      const modifiers = getArray(p.modifiers).join(" ") || "public";

      uniqueVariables.set(p.name, {
        name: p.name,
        dataType: `${typeText} {Property}`,
        isCollection: typeText.includes("<") || typeText.includes("[]"),
        access: modifiers,
        scope: "Class Property"
      });
    });

    resources.variables = Array.from(uniqueVariables.values());

    // Sort alphabetically by name
    resources.variables.sort((a, b) => a.name.localeCompare(b.name));

    return resources;
  }
}
