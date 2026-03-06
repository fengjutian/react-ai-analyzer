import * as vscode from "vscode"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"
import { buildGraph } from "../../analyzer/graph/dependencyGraph"

export function activate(context: vscode.ExtensionContext) {

  const disposable = vscode.commands.registerCommand(
    "react-ai.analyze",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const code = editor.document.getText()
      const analysis = analyzeReactCode(code)
      const graph = buildGraph(
        analysis.components.map(name => ({ name, imports: analysis.imports }))
      )

      // 弹出 Webview 面板显示结果
      const panel = vscode.window.createWebviewPanel(
        "reactAnalyzer",
        "React Analyzer",
        vscode.ViewColumn.One,
        {}
      )
      panel.webview.html = `
        <html>
          <body>
            <h2>组件</h2>
            <pre>${JSON.stringify(analysis.components, null, 2)}</pre>
            <h2>Hooks</h2>
            <pre>${JSON.stringify(analysis.hooks, null, 2)}</pre>
            <h2>依赖图</h2>
            <pre>${JSON.stringify([...graph.entries()], null, 2)}</pre>
          </body>
        </html>
      `
    }
  )

  context.subscriptions.push(disposable)
}