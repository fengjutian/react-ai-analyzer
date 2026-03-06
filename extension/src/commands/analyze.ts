import * as vscode from 'vscode';
import { AnalyzerPanel } from '../panel/analyzerPanel';

export function analyzeCommand(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Analyzing React code...');
    AnalyzerPanel.createOrShow(context.extensionUri);
}
