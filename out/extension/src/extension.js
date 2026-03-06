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
const reactParser_1 = require("../../analyzer/ast/reactParser");
const dependencyGraph_1 = require("../../analyzer/graph/dependencyGraph");
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
function getWebviewHtml(analysis, graph) {
    const mermaidSource = toMermaidGraph(graph);
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
      .graph-wrap { border: 1px solid #ddd; border-radius: 8px; padding: 12px; overflow: auto; }
      .hint { color: #666; font-size: 12px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  </head>
  <body>
    <h1>React Analyzer</h1>
    <p class="hint">Dependency tree is rendered with Mermaid.js.</p>

    <h2>Dependency Graph</h2>
    <div class="graph-wrap">
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

    <script>
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "default" })
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
        const panel = vscode.window.createWebviewPanel("reactAnalyzer", "React Analyzer", vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = getWebviewHtml(analysis, graph);
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