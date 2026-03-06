"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const reactParser_1 = require("../../analyzer/ast/reactParser");
const dependencyGraph_1 = require("../../analyzer/graph/dependencyGraph");
function getNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let i = 0; i < 16; i += 1) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeMermaidLabel(value) {
    return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}
function toMermaidGraph(graph) {
    const lines = ["flowchart LR"];
    const idByLabel = new Map();
    const edgeSet = new Set();
    let nodeCounter = 0;
    const ensureNode = (label) => {
        let id = idByLabel.get(label);
        if (id)
            return id;
        nodeCounter += 1;
        id = `N${nodeCounter}`;
        idByLabel.set(label, id);
        lines.push(`${id}[\"${escapeMermaidLabel(label)}\"]`);
        return id;
    };
    for (const [name, imports] of graph.entries()) {
        const fromId = ensureNode(name);
        for (const dep of imports) {
            const toId = ensureNode(dep);
            const edgeKey = `${fromId}->${toId}`;
            if (edgeSet.has(edgeKey))
                continue;
            edgeSet.add(edgeKey);
            lines.push(`${fromId} --> ${toId}`);
        }
    }
    if (nodeCounter === 0) {
        lines.push('Empty["No dependencies found"]');
    }
    return lines.join("\n");
}
function getWebviewHtml(webview, extensionUri, analysis, graph) {
    const mermaidSource = toMermaidGraph(graph);
    const mermaidScriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, "node_modules", "mermaid", "dist", "mermaid.min.js")));
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Analyzer</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      h2 { margin: 20px 0 8px; font-size: 16px; }
      pre { background: #f6f8fa; border-radius: 8px; padding: 12px; overflow: auto; }
      .graph-wrap {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        min-height: 420px;
        overflow: hidden;
        cursor: grab;
        user-select: none;
        background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
      }
      .graph-wrap:active { cursor: grabbing; }
      .graph-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .graph-toolbar button {
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
      }
      .graph-toolbar button:hover { background: #f4f4f4; }
      .graph-wrap svg { width: 100%; height: 100%; }
      .hint { color: #666; font-size: 12px; }
    </style>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <script nonce="${nonce}" src="${mermaidScriptUri}"></script>
  </head>
  <body>
    <h1>React Analyzer</h1>
    <p class="hint">Dependency tree is rendered with Mermaid.js. Drag to pan, wheel to zoom, double-click or reset to restore.</p>

    <h2>Dependency Graph</h2>
    <div class="graph-toolbar">
      <span class="hint">Interactive view</span>
      <button id="graphReset" type="button">Reset View</button>
    </div>
    <div class="graph-wrap" id="graphWrap">
      <div class="mermaid">${escapeHtml(mermaidSource)}</div>
    </div>

    <h2>Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.components, null, 2))}</pre>

    <h2>Hooks</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.hooks, null, 2))}</pre>

    <h2>Exports</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.exports, null, 2))}</pre>

    <h2>Import Specifiers</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.importSpecifiers, null, 2))}</pre>

    <h2>State Variables</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.stateVariables, null, 2))}</pre>

    <h2>JSX Elements</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.jsxElements, null, 2))}</pre>

    <h2>Raw Dependency Data</h2>
    <pre>${escapeHtml(JSON.stringify([...graph.entries()], null, 2))}</pre>

    <script nonce="${nonce}">
      const setupGraphInteractions = () => {
        const wrap = document.getElementById("graphWrap")
        const resetButton = document.getElementById("graphReset")
        const svg = wrap ? wrap.querySelector("svg") : null
        if (!wrap || !svg) return

        const graphRoot = svg.querySelector("g")
        if (!graphRoot) return

        let scale = 1
        let translateX = 0
        let translateY = 0
        let isDragging = false
        let lastX = 0
        let lastY = 0

        const applyTransform = () => {
          graphRoot.setAttribute("transform", "translate(" + translateX + "," + translateY + ") scale(" + scale + ")")
        }

        const resetTransform = () => {
          scale = 1
          translateX = 0
          translateY = 0
          applyTransform()
        }

        wrap.addEventListener("mousedown", event => {
          isDragging = true
          lastX = event.clientX
          lastY = event.clientY
        })

        window.addEventListener("mousemove", event => {
          if (!isDragging) return
          translateX += event.clientX - lastX
          translateY += event.clientY - lastY
          lastX = event.clientX
          lastY = event.clientY
          applyTransform()
        })

        window.addEventListener("mouseup", () => {
          isDragging = false
        })

        wrap.addEventListener("mouseleave", () => {
          isDragging = false
        })

        wrap.addEventListener("wheel", event => {
          event.preventDefault()
          const zoomDelta = event.deltaY < 0 ? 1.1 : 0.9
          const nextScale = Math.min(4, Math.max(0.3, scale * zoomDelta))
          if (nextScale === scale) return

          const rect = wrap.getBoundingClientRect()
          const offsetX = event.clientX - rect.left
          const offsetY = event.clientY - rect.top
          const ratio = nextScale / scale
          translateX = offsetX - (offsetX - translateX) * ratio
          translateY = offsetY - (offsetY - translateY) * ratio
          scale = nextScale
          applyTransform()
        }, { passive: false })

        wrap.addEventListener("dblclick", resetTransform)
        if (resetButton) resetButton.addEventListener("click", resetTransform)
      }

      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" })
        window.mermaid.run({ querySelector: ".mermaid" }).then(setupGraphInteractions)
      }
    </script>
  </body>
</html>`;
}
function activate(context) {
    const analyzeDisposable = vscode.commands.registerCommand("react-ai-analyzer.analyze", async (resource) => {
        let document;
        if (resource) {
            document = await vscode.workspace.openTextDocument(resource);
        }
        else {
            document = vscode.window.activeTextEditor?.document;
        }
        if (!document) {
            vscode.window.showWarningMessage("No file selected for analysis.");
            return;
        }
        const code = document.getText();
        const analysis = (0, reactParser_1.analyzeReactCode)(code, document.fileName);
        const graph = (0, dependencyGraph_1.buildGraph)(analysis.components.map(name => ({ name, imports: analysis.imports })));
        const panel = vscode.window.createWebviewPanel("reactAnalyzer", "React Analyzer", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [context.extensionUri]
        });
        panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, analysis, graph);
    });
    const indexDisposable = vscode.commands.registerCommand("react-ai-analyzer.indexWorkspace", async () => {
        vscode.window.showInformationMessage("Indexing workspace...");
        setTimeout(() => {
            vscode.window.showInformationMessage("Indexing completed!");
        }, 2000);
    });
    context.subscriptions.push(analyzeDisposable, indexDisposable);
}
//# sourceMappingURL=extension.js.map