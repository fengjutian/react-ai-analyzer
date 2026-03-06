import { parse } from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import * as path from "path"

function getParserPlugins(filePath?: string): ("jsx" | "typescript")[] {
  const ext = filePath ? path.extname(filePath).toLowerCase() : ""
  if (ext === ".ts") return ["typescript"]
  if (ext === ".tsx") return ["typescript", "jsx"]
  if (ext === ".jsx") return ["jsx"]
  if (ext === ".js") return ["jsx"]
  return ["typescript", "jsx"]
}

export function analyzeReactCode(code: string, filePath?: string) {
  const ast = parse(code, {
    sourceType: "module",
    plugins: getParserPlugins(filePath)
  })

  const result = {
    components: [] as string[],
    hooks: [] as string[],
    imports: [] as string[]
  }

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      result.imports.push(path.node.source.value)
    },
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const name = path.node.id?.name
      if (name && /^[A-Z]/.test(name)) result.components.push(name)
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee
      if (t.isIdentifier(callee) && /^use/.test(callee.name)) {
        result.hooks.push(callee.name)
      }
    }
  })

  return result
}
