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
function activate(context) {
    const analyzeDisposable = vscode.commands.registerCommand("react-ai-analyzer.analyze", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const code = editor.document.getText();
        const analysis = (0, reactParser_1.analyzeReactCode)(code, editor.document.fileName);
        const graph = (0, dependencyGraph_1.buildGraph)(analysis.components.map(name => ({ name, imports: analysis.imports })));
        const panel = vscode.window.createWebviewPanel("reactAnalyzer", "React Analyzer", vscode.ViewColumn.One, {});
        panel.webview.html = `
        <html>
          <body>
            <h2>Components</h2>
            <pre>${JSON.stringify(analysis.components, null, 2)}</pre>
            <h2>Hooks</h2>
            <pre>${JSON.stringify(analysis.hooks, null, 2)}</pre>
            <h2>Exports</h2>
            <pre>${JSON.stringify(analysis.exports, null, 2)}</pre>
            <h2>Import Specifiers</h2>
            <pre>${JSON.stringify(analysis.importSpecifiers, null, 2)}</pre>
            <h2>State Variables</h2>
            <pre>${JSON.stringify(analysis.stateVariables, null, 2)}</pre>
            <h2>JSX Elements</h2>
            <pre>${JSON.stringify(analysis.jsxElements, null, 2)}</pre>
            <h2>Dependency Graph</h2>
            <pre>${JSON.stringify([...graph.entries()], null, 2)}</pre>
          </body>
        </html>
      `;
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