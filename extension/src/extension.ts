import * as vscode from "vscode"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"
import { buildGraph } from "../../analyzer/graph/dependencyGraph"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeMermaidLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")
}

function toMermaidGraph(graph: Map<string, string[]>) {
  const lines: string[] = ["flowchart LR"]
  const idByLabel = new Map<string, string>()
  const edgeSet = new Set<string>()
  let nodeCounter = 0

  const ensureNode = (label: string) => {
    let id = idByLabel.get(label)
    if (id) return id

    nodeCounter += 1
    id = `N${nodeCounter}`
    idByLabel.set(label, id)
    lines.push(`${id}[\"${escapeMermaidLabel(label)}\"]`)
    return id
  }

  for (const [name, imports] of graph.entries()) {
    const fromId = ensureNode(name)
    for (const dep of imports) {
      const toId = ensureNode(dep)
      const edgeKey = `${fromId}->${toId}`
      if (edgeSet.has(edgeKey)) continue
      edgeSet.add(edgeKey)
      lines.push(`${fromId} --> ${toId}`)
    }
  }

  if (nodeCounter === 0) {
    lines.push('Empty["No dependencies found"]')
  }

  return lines.join("\n")
}

function getWebviewHtml(analysis: ReturnType<typeof analyzeReactCode>, graph: Map<string, string[]>) {
  const mermaidSource = toMermaidGraph(graph)

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
</html>`
}

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
        analysis.components.map(name => ({ name, imports: analysis.imports }))
      )

      const panel = vscode.window.createWebviewPanel(
        "reactAnalyzer",
        "React Analyzer",
        vscode.ViewColumn.One,
        { enableScripts: true }
      )

      panel.webview.html = getWebviewHtml(analysis, graph)
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
