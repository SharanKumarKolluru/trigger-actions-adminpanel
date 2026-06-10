import { createElement } from "lwc";
import DiagramViewer from "c/diagramViewer";

describe("c-diagram-viewer", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("does not render 'View Resources' button when no resources are passed", () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    document.body.appendChild(element);

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const viewResourcesBtn = Array.from(buttons).find(
      (btn) => btn.label === "View Resources"
    );
    expect(viewResourcesBtn).toBeUndefined();
  });

  it("renders 'View Resources' button and opens side-drawer when clicked", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private"
        }
      ]
    };
    document.body.appendChild(element);

    // Wait for rendering
    await Promise.resolve();

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const viewResourcesBtn = Array.from(buttons).find(
      (btn) => btn.label === "View Resources"
    );
    expect(viewResourcesBtn).toBeDefined();

    // Check closed state
    let drawer = element.shadowRoot.querySelector(".diagram-drawer");
    expect(drawer.classList.contains("open")).toBe(false);

    // Click to open
    viewResourcesBtn.click();
    await Promise.resolve();

    drawer = element.shadowRoot.querySelector(".diagram-drawer");
    expect(drawer.classList.contains("open")).toBe(true);
  });

  it("generates resources markdown when copying diagram code", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.mermaidCode = "graph TD; A-->B;";
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private"
        }
      ]
    };
    document.body.appendChild(element);

    await Promise.resolve();

    // Mock clipboard API
    const writeTextMock = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    });

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const copyButton = Array.from(buttons).find(
      (btn) => btn.label === "Copy Diagram Code"
    );
    expect(copyButton).toBeDefined();

    copyButton.click();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("## Flow Resources");
    expect(copiedText).toContain("| myVar | String | False | Private |");
  });

  it("generates resources markdown with Scope column for Apex type", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.mermaidCode = "graph TD; A-->B;";
    element.type = "apex";
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private",
          scope: "Method: myMethod()"
        }
      ]
    };
    document.body.appendChild(element);

    await Promise.resolve();

    // Mock clipboard API
    const writeTextMock = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    });

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const copyButton = Array.from(buttons).find(
      (btn) => btn.label === "Copy Diagram Code"
    );
    copyButton.click();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("## Apex Resources");
    expect(copiedText).toContain(
      "| myVar | String | False | Private | Method: myMethod() |"
    );
  });
});
