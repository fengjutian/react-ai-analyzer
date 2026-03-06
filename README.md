# React AI Analyzer

An AI-powered React code analyzer for VS Code. This extension helps developers analyze React components, hooks, and dependency graphs using LLM and vector search capabilities.

## Project Structure

- `extension/`: VS Code extension core code
  - `src/extension.ts`: Main entry point for the extension
  - `src/commands/`: Command handlers (e.g., analyze)
  - `src/panel/`: Webview panel implementation
  - `src/utils/`: Workspace and other utility functions
- `analyzer/`: Core code analysis logic
  - `ast/`: React code parsing using AST
  - `graph/`: Dependency graph construction
  - `indexer/`: Code indexing for vector search
- `llm/`: LLM client for interacting with AI models
- `vector/`: Vector store for managing code embeddings

## Features

- [x] Basic project structure
- [ ] React AST parsing
- [ ] Dependency graph generation
- [ ] Vector-based code search
- [ ] AI-powered component analysis

## Getting Started

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` in VS Code to start debugging

## License

MIT
