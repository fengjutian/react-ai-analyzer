import * as vscode from "vscode"
import * as path from "path"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"
import { buildGraph } from "../../analyzer/graph/dependencyGraph"
import { getWebviewHtml, getWorkspaceIndexHtml } from "./webview/analyzerView"
import { WorkspaceIndexResult } from "../../analyzer/types"

export function activate(context: vscode.ExtensionContext) {
  const analyzeDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.analyze",
    async (resource?: vscode.Uri) => {
      let document: vscode.TextDocument | undefined

      if (resource) {
        document = await vscode.workspace.openTextDocument(resource)
      } else {
        document = vscode.window.activeTextEditor?.document
      }

      if (!document) {
        vscode.window.showWarningMessage("No file selected for analysis.")
        return
      }

      const code = document.getText()
      const analysis = analyzeReactCode(code, document.fileName)
      const graph = buildGraph(
        analysis.components.map(name => ({
          name,
          imports: analysis.componentDependencies[name] ?? []
        }))
      )

      const panel = vscode.window.createWebviewPanel(
        "reactAnalyzer",
        "React Analyzer",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [context.extensionUri]
        }
      )

      panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, analysis, graph)
    }
  )

  const indexDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.indexWorkspace",
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace folder found.")
        return
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Indexing workspace for React analysis",
          cancellable: false
        },
        async progress => {
          const files = await vscode.workspace.findFiles(
            "**/*.{js,jsx,ts,tsx}",
            "**/{node_modules,out,dist,.git}/**"
          )
          progress.report({ message: `Found ${files.length} files` })

          const componentsByFile: Record<string, string[]> = {}
          const dependenciesByFile: Record<string, Record<string, string[]>> = {}
          const interfacesByFile: Record<string, string[]> = {}
          const typesByFile: Record<string, string[]> = {}

          const componentSet = new Set<string>()
          const interfaceSet = new Set<string>()
          const typeSet = new Set<string>()
          const importedComponentSet = new Set<string>()

          for (let i = 0; i < files.length; i += 1) {
            const file = files[i]
            const document = await vscode.workspace.openTextDocument(file)
            const analysis = analyzeReactCode(document.getText(), file.fsPath)
            const relativeFile = path.relative(workspaceFolder.uri.fsPath, file.fsPath).replace(/\\/g, "/")

            componentsByFile[relativeFile] = analysis.components
            dependenciesByFile[relativeFile] = analysis.componentDependencies
            interfacesByFile[relativeFile] = analysis.interfaces
            typesByFile[relativeFile] = analysis.types

            analysis.components.forEach(name => componentSet.add(name))
            analysis.interfaces.forEach(name => interfaceSet.add(name))
            analysis.types.forEach(name => typeSet.add(name))
            analysis.componentImports.forEach(name => importedComponentSet.add(name))

            if (i % 20 === 0) {
              progress.report({ message: `Indexed ${i + 1}/${files.length}` })
            }
          }

          const panel = vscode.window.createWebviewPanel(
            "reactAnalyzerWorkspaceIndex",
            "React Analyzer Workspace Index",
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              localResourceRoots: [context.extensionUri]
            }
          )

          const summary: WorkspaceIndexResult = {
            fileCount: files.length,
            componentCount: componentSet.size,
            interfaceCount: interfaceSet.size,
            typeCount: typeSet.size,
            componentImportCount: importedComponentSet.size,
            componentsByFile,
            dependenciesByFile,
            interfacesByFile,
            typesByFile
          }

          panel.webview.html = getWorkspaceIndexHtml(panel.webview, context.extensionUri, summary)
        }
      )
    }
  )

  context.subscriptions.push(analyzeDisposable, indexDisposable)
}
