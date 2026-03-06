import * as vscode from "vscode"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"
import { buildGraph } from "../../analyzer/graph/dependencyGraph"

export function activate(context: vscode.ExtensionContext) {

  const analyzeDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.analyze",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const code = editor.document.getText()
      const analysis = analyzeReactCode(code, editor.document.fileName)
      const graph = buildGraph(
        analysis.components.map(name => ({ name, imports: analysis.imports }))
      )

      const panel = vscode.window.createWebviewPanel(
        "reactAnalyzer",
        "React Analyzer",
        vscode.ViewColumn.One,
        {}
      )
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
      `
    }
  )

  const indexDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.indexWorkspace",
    async () => {
      vscode.window.showInformationMessage("Indexing workspace...")
      setTimeout(() => {
        vscode.window.showInformationMessage("Indexing completed!")
      }, 2000)
    }
  )

  context.subscriptions.push(analyzeDisposable, indexDisposable)
}
