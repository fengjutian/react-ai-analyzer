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
    imports: [] as string[],
    importSpecifiers: [] as string[],
    exports: [] as string[],
    stateVariables: [] as string[],
    jsxElements: [] as string[]
  }

  const pushUnique = (list: string[], value: string | undefined) => {
    if (!value) return
    if (!list.includes(value)) list.push(value)
  }

  const getCallName = (callee: t.Expression | t.V8IntrinsicIdentifier) => {
    if (t.isIdentifier(callee)) return callee.name
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      return callee.property.name
    }
    return undefined
  }

  const getJsxName = (name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string | undefined => {
    if (t.isJSXIdentifier(name)) return name.name
    if (t.isJSXMemberExpression(name)) {
      const objectName = t.isJSXIdentifier(name.object) ? name.object.name : undefined
      const propertyName = t.isJSXIdentifier(name.property) ? name.property.name : undefined
      if (!objectName || !propertyName) return undefined
      return `${objectName}.${propertyName}`
    }
    return undefined
  }

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      pushUnique(result.imports, path.node.source.value)
      path.node.specifiers.forEach(specifier => {
        pushUnique(result.importSpecifiers, specifier.local.name)
      })
    },
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const name = path.node.id?.name
      if (name && /^[A-Z]/.test(name)) pushUnique(result.components, name)
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      if (t.isIdentifier(path.node.id) && path.node.id.name && /^[A-Z]/.test(path.node.id.name)) {
        const init = path.node.init
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          pushUnique(result.components, path.node.id.name)
        }
      }

      if (!t.isArrayPattern(path.node.id) || !path.node.init) return
      if (!t.isCallExpression(path.node.init)) return

      const callName = getCallName(path.node.init.callee)
      if (callName !== "useState") return

      path.node.id.elements.forEach(element => {
        if (t.isIdentifier(element)) pushUnique(result.stateVariables, element.name)
      })
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const callName = getCallName(path.node.callee)
      if (callName && /^use/.test(callName)) {
        pushUnique(result.hooks, callName)
      }
    },
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      path.node.specifiers.forEach(specifier => {
        if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
          pushUnique(result.exports, specifier.exported.name)
        }
      })

      const declaration = path.node.declaration
      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        pushUnique(result.exports, declaration.id.name)
      }
      if (t.isVariableDeclaration(declaration)) {
        declaration.declarations.forEach(item => {
          if (t.isIdentifier(item.id)) pushUnique(result.exports, item.id.name)
        })
      }
    },
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const declaration = path.node.declaration
      if (t.isIdentifier(declaration)) pushUnique(result.exports, declaration.name)
      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        pushUnique(result.exports, declaration.id.name)
      }
    },
    JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
      pushUnique(result.jsxElements, getJsxName(path.node.name))
    }
  })

  return result
}
