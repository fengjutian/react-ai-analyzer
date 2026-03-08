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
const analyzerView_1 = require("./webview/analyzerView");
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
        const graph = (0, dependencyGraph_1.buildGraph)(analysis.components.map(name => ({
            name,
            imports: analysis.componentDependencies[name] ?? []
        })));
        const panel = vscode.window.createWebviewPanel("reactAnalyzer", "React Analyzer", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [context.extensionUri]
        });
        panel.webview.html = (0, analyzerView_1.getWebviewHtml)(panel.webview, context.extensionUri, analysis, graph);
    });
    const indexDisposable = vscode.commands.registerCommand("react-ai-analyzer.indexWorkspace", async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage("No workspace folder found.");
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Indexing workspace for React analysis",
            cancellable: false
        }, async (progress) => {
            const files = await vscode.workspace.findFiles("**/*.{js,jsx,ts,tsx}", "**/{node_modules,out,dist,.git}/**");
            progress.report({ message: `Found ${files.length} files` });
            const componentsByFile = {};
            const dependenciesByFile = {};
            const interfacesByFile = {};
            const typesByFile = {};
            const componentSet = new Set();
            const interfaceSet = new Set();
            const typeSet = new Set();
            const importedComponentSet = new Set();
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const document = await vscode.workspace.openTextDocument(file);
                const analysis = (0, reactParser_1.analyzeReactCode)(document.getText(), file.fsPath);
                const relativeFile = path.relative(workspaceFolder.uri.fsPath, file.fsPath).replace(/\\/g, "/");
                componentsByFile[relativeFile] = analysis.components;
                dependenciesByFile[relativeFile] = analysis.componentDependencies;
                interfacesByFile[relativeFile] = analysis.interfaces;
                typesByFile[relativeFile] = analysis.types;
                analysis.components.forEach(name => componentSet.add(name));
                analysis.interfaces.forEach(name => interfaceSet.add(name));
                analysis.types.forEach(name => typeSet.add(name));
                analysis.componentImports.forEach(name => importedComponentSet.add(name));
                if (i % 20 === 0) {
                    progress.report({ message: `Indexed ${i + 1}/${files.length}` });
                }
            }
            const panel = vscode.window.createWebviewPanel("reactAnalyzerWorkspaceIndex", "React Analyzer Workspace Index", vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [context.extensionUri]
            });
            const summary = {
                fileCount: files.length,
                componentCount: componentSet.size,
                interfaceCount: interfaceSet.size,
                typeCount: typeSet.size,
                componentImportCount: importedComponentSet.size,
                componentsByFile,
                dependenciesByFile,
                interfacesByFile,
                typesByFile
            };
            panel.webview.html = (0, analyzerView_1.getWorkspaceIndexHtml)(panel.webview, context.extensionUri, summary);
        });
    });
    context.subscriptions.push(analyzeDisposable, indexDisposable);
}
//# sourceMappingURL=extension.js.map