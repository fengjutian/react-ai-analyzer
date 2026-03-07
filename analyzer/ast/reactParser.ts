import { parse } from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import * as path from "path"
import { AnalysisResult } from "../types"

function getParserPlugins(filePath?: string): ("jsx" | "typescript")[] {
  const ext = filePath ? path.extname(filePath).toLowerCase() : ""
  if (ext === ".ts") return ["typescript"]
  if (ext === ".tsx") return ["typescript", "jsx"]
  if (ext === ".jsx") return ["jsx"]
  if (ext === ".js") return ["jsx"]
  return ["typescript", "jsx"]
}

export function analyzeReactCode(code: string, filePath?: string): AnalysisResult {
  const ast = parse(code, {
    sourceType: "module",
    plugins: getParserPlugins(filePath)
  })

  const importNameToSource = new Map<string, string>()

  const result: AnalysisResult = {
    components: [] as string[],
    forwardRefComponents: [] as string[],
    fcComponents: [] as string[],
    componentImports: [] as string[],
    componentDependencies: {} as Record<string, string[]>,
    componentProfiles: {} as Record<string, {
      props: string[]
      hooks: string[]
      stateVariables: string[]
      dependencies: string[]
    }>,
    knowledgeTriples: [] as Array<{
      subject: string
      predicate: string
      object: string
    }>,
    hooks: [] as string[],
    imports: [] as string[],
    importSpecifiers: [] as string[],
    exports: [] as string[],
    interfaces: [] as string[],
    types: [] as string[],
    props: [] as string[],
    functions: [] as string[],
    methods: [] as string[],
    stateVariables: [] as string[],
    jsxElements: [] as string[],
    jsxAttributes: [] as string[]
  }

  const pushUnique = (list: string[], value: string | undefined) => {
    if (!value) return
    if (!list.includes(value)) list.push(value)
  }

  const tripleSet = new Set<string>()
  const addTriple = (subject: string, predicate: string, object: string) => {
    const key = `${subject}|${predicate}|${object}`
    if (tripleSet.has(key)) return
    tripleSet.add(key)
    result.knowledgeTriples.push({ subject, predicate, object })
  }

  const ensureComponentProfile = (componentName: string) => {
    if (!result.componentProfiles[componentName]) {
      result.componentProfiles[componentName] = {
        props: [],
        hooks: [],
        stateVariables: [],
        dependencies: []
      }
    }
    return result.componentProfiles[componentName]
  }

  const getCallName = (callee: t.Expression | t.V8IntrinsicIdentifier) => {
    if (t.isIdentifier(callee)) return callee.name
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      return callee.property.name
    }
    return undefined
  }

  const isForwardRefCall = (callee: t.Expression | t.V8IntrinsicIdentifier) => {
    if (t.isIdentifier(callee)) return callee.name === "forwardRef"
    if (t.isMemberExpression(callee)) {
      return t.isIdentifier(callee.object) && callee.object.name === "React"
        && t.isIdentifier(callee.property) && callee.property.name === "forwardRef"
    }
    return false
  }

  const isReactFcType = (
    typeAnnotation?: t.TSTypeAnnotation | t.TypeAnnotation | t.Noop | null
  ) => {
    if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation)) return false
    if (!t.isTSTypeReference(typeAnnotation.typeAnnotation)) return false

    const typeName = typeAnnotation.typeAnnotation.typeName
    if (t.isIdentifier(typeName)) {
      return typeName.name === "FC"
    }
    if (t.isTSQualifiedName(typeName)) {
      return t.isIdentifier(typeName.left) && typeName.left.name === "React"
        && t.isIdentifier(typeName.right) && typeName.right.name === "FC"
    }
    return false
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

  const collectPropsFromParam = (param: t.Function["params"][number] | undefined) => {
    if (!param) return

    if (t.isIdentifier(param)) {
      pushUnique(result.props, param.name)
      return
    }

    if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
      pushUnique(result.props, param.left.name)
      return
    }

    if (t.isObjectPattern(param)) {
      param.properties.forEach(property => {
        if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
          pushUnique(result.props, property.key.name)
        }
        if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
          pushUnique(result.props, property.argument.name)
        }
      })
    }
  }

  const extractPropsFromParam = (param: t.Function["params"][number] | undefined) => {
    const props: string[] = []
    if (!param) return props

    if (t.isIdentifier(param)) {
      props.push(param.name)
      return props
    }

    if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
      props.push(param.left.name)
      return props
    }

    if (t.isObjectPattern(param)) {
      param.properties.forEach(property => {
        if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
          props.push(property.key.name)
        }
        if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
          props.push(property.argument.name)
        }
      })
    }

    return props
  }

  const addComponentDependencies = (componentName: string, deps: Set<string>) => {
    if (!result.componentDependencies[componentName]) {
      result.componentDependencies[componentName] = []
    }
    deps.forEach(dep => pushUnique(result.componentDependencies[componentName], dep))
  }

  const collectComponentMetrics = (nodePath: NodePath<t.Node>) => {
    const hooks = new Set<string>()
    const stateVariables = new Set<string>()

    nodePath.traverse({
      CallExpression(innerPath: NodePath<t.CallExpression>) {
        const callName = getCallName(innerPath.node.callee)
        if (callName && /^use/.test(callName)) {
          hooks.add(callName)
        }
      },
      VariableDeclarator(innerPath: NodePath<t.VariableDeclarator>) {
        if (!t.isArrayPattern(innerPath.node.id) || !innerPath.node.init) return
        if (!t.isCallExpression(innerPath.node.init)) return
        const callName = getCallName(innerPath.node.init.callee)
        if (callName !== "useState") return

        innerPath.node.id.elements.forEach(element => {
          if (t.isIdentifier(element)) stateVariables.add(element.name)
        })
      }
    })

    return { hooks, stateVariables }
  }

  const addComponentProfile = (
    componentName: string,
    nodePath: NodePath<t.Node>,
    firstParam?: t.Function["params"][number]
  ) => {
    const profile = ensureComponentProfile(componentName)
    const deps = collectDependenciesFromPath(nodePath)
    const metrics = collectComponentMetrics(nodePath)
    const props = extractPropsFromParam(firstParam)

    deps.forEach(dep => pushUnique(profile.dependencies, dep))
    metrics.hooks.forEach(hook => pushUnique(profile.hooks, hook))
    metrics.stateVariables.forEach(state => pushUnique(profile.stateVariables, state))
    props.forEach(prop => pushUnique(profile.props, prop))
  }

  const collectDependenciesFromPath = (nodePath: NodePath<t.Node>) => {
    const deps = new Set<string>()

    nodePath.traverse({
      Identifier(innerPath: NodePath<t.Identifier>) {
        if (!innerPath.isReferencedIdentifier()) return
        const source = importNameToSource.get(innerPath.node.name)
        if (source) deps.add(source)
      },
      JSXIdentifier(innerPath: NodePath<t.JSXIdentifier>) {
        const source = importNameToSource.get(innerPath.node.name)
        if (source) deps.add(source)
      }
    })

    return deps
  }

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      pushUnique(result.imports, path.node.source.value)
      path.node.specifiers.forEach(specifier => {
        pushUnique(result.importSpecifiers, specifier.local.name)
        importNameToSource.set(specifier.local.name, path.node.source.value)
        if (/^[A-Z]/.test(specifier.local.name)) {
          pushUnique(result.componentImports, specifier.local.name)
        }
      })
    },
    TSInterfaceDeclaration(path: NodePath<t.TSInterfaceDeclaration>) {
      pushUnique(result.interfaces, path.node.id.name)
    },
    TSTypeAliasDeclaration(path: NodePath<t.TSTypeAliasDeclaration>) {
      pushUnique(result.types, path.node.id.name)
    },
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const name = path.node.id?.name
      if (!name) return

      if (/^[A-Z]/.test(name)) {
        pushUnique(result.components, name)
        collectPropsFromParam(path.node.params[0])
        addComponentDependencies(name, collectDependenciesFromPath(path as NodePath<t.Node>))
        addComponentProfile(name, path as NodePath<t.Node>, path.node.params[0])
        return
      }

      pushUnique(result.functions, name)
      pushUnique(result.methods, name)
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      if (t.isIdentifier(path.node.id) && path.node.id.name && /^[A-Z]/.test(path.node.id.name)) {
        const init = path.node.init
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          pushUnique(result.components, path.node.id.name)
          collectPropsFromParam(init.params[0])
          addComponentDependencies(path.node.id.name, collectDependenciesFromPath(path.get("init") as NodePath<t.Node>))
          addComponentProfile(path.node.id.name, path.get("init") as NodePath<t.Node>, init.params[0])
        }
      }

      if (t.isIdentifier(path.node.id) && path.node.id.name) {
        if (isReactFcType(path.node.id.typeAnnotation)) {
          pushUnique(result.fcComponents, path.node.id.name)
          pushUnique(result.components, path.node.id.name)
        }

        const init = path.node.init

        if (t.isCallExpression(init) && isForwardRefCall(init.callee)) {
          pushUnique(result.forwardRefComponents, path.node.id.name)
          pushUnique(result.components, path.node.id.name)
          addComponentDependencies(path.node.id.name, collectDependenciesFromPath(path.get("init") as NodePath<t.Node>))
          const firstArg = init.arguments[0]
          if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
            addComponentProfile(path.node.id.name, path.get("init") as NodePath<t.Node>, firstArg.params[0])
          }
          if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
            collectPropsFromParam(firstArg.params[0])
          }
        }

        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          if (!/^[A-Z]/.test(path.node.id.name)) {
            pushUnique(result.functions, path.node.id.name)
            pushUnique(result.methods, path.node.id.name)
          }
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
    ClassMethod(path: NodePath<t.ClassMethod>) {
      if (t.isIdentifier(path.node.key)) {
        pushUnique(result.methods, path.node.key.name)
      }
    },
    ClassProperty(path: NodePath<t.ClassProperty>) {
      if (!t.isIdentifier(path.node.key)) return
      if (!path.node.value) return
      if (t.isArrowFunctionExpression(path.node.value) || t.isFunctionExpression(path.node.value)) {
        pushUnique(result.methods, path.node.key.name)
      }
    },
    ObjectMethod(path: NodePath<t.ObjectMethod>) {
      if (t.isIdentifier(path.node.key)) {
        pushUnique(result.methods, path.node.key.name)
      }
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
      if (t.isCallExpression(declaration) && isForwardRefCall(declaration.callee)) {
        pushUnique(result.forwardRefComponents, "default")
      }
    },
    JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
      pushUnique(result.jsxElements, getJsxName(path.node.name))
      path.node.attributes.forEach(attribute => {
        if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name)) {
          pushUnique(result.jsxAttributes, attribute.name.name)
        }
      })
    }
  })

  Object.entries(result.componentProfiles).forEach(([componentName, profile]) => {
    profile.props.forEach(prop => addTriple(componentName, "has_prop", prop))
    profile.hooks.forEach(hook => addTriple(componentName, "uses_hook", hook))
    profile.stateVariables.forEach(state => addTriple(componentName, "has_state", state))
    profile.dependencies.forEach(dep => addTriple(componentName, "depends_on", dep))
  })

  result.forwardRefComponents.forEach(componentName => {
    addTriple(componentName, "component_kind", "React.forwardRef")
  })

  result.fcComponents.forEach(componentName => {
    addTriple(componentName, "component_kind", "React.FC")
  })

  result.componentImports.forEach(componentName => {
    addTriple(componentName, "imported_component", "true")
  })

  result.interfaces.forEach(name => {
    addTriple(name, "symbol_kind", "interface")
  })

  result.types.forEach(name => {
    addTriple(name, "symbol_kind", "type_alias")
  })

  return result
}
