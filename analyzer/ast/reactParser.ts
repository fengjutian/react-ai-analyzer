import { parse } from "@babel/parser"
import traverse from "@babel/traverse"

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
    ImportDeclaration(path) {
      result.imports.push(path.node.source.value)
    },
    FunctionDeclaration(path) {
      const name = path.node.id?.name
      if (name && /^[A-Z]/.test(name)) result.components.push(name)
    },
    CallExpression(path) {
      const callee = path.node.callee
      if (callee.type === "Identifier" && /^use/.test(callee.name)) {
        result.hooks.push(callee.name)
      }
    }
  })

  return result
}