import * as vscode from "vscode"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"

export function activate(context: vscode.ExtensionContext) {

  const disposable = vscode.commands.registerCommand(
    "react-ai.analyze",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const code = editor.document.getText()
      const analysis = analyzeReactCode(code)

      vscode.window.showInformationMessage(JSON.stringify(analysis, null, 2))
    }
  )

  context.subscriptions.push(disposable)
}