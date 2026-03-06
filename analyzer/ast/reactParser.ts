import { parse } from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"

export function analyzeReactCode(code: string) {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"]
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