import * as vscode from 'vscode';

export function getWorkspaceFolder(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function findReactFiles(): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles('**/*.{jsx,tsx}', '**/node_modules/**');
}
