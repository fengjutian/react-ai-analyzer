"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeReactCode = analyzeReactCode;
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const path = __importStar(require("path"));
function getParserPlugins(filePath) {
    const ext = filePath ? path.extname(filePath).toLowerCase() : "";
    if (ext === ".ts")
        return ["typescript"];
    if (ext === ".tsx")
        return ["typescript", "jsx"];
    if (ext === ".jsx")
        return ["jsx"];
    if (ext === ".js")
        return ["jsx"];
    return ["typescript", "jsx"];
}
function analyzeReactCode(code, filePath) {
    const ast = (0, parser_1.parse)(code, {
        sourceType: "module",
        plugins: getParserPlugins(filePath)
    });
    const importNameToSource = new Map();
    const result = {
        components: [],
        forwardRefComponents: [],
        fcComponents: [],
        componentImports: [],
        componentDependencies: {},
        componentProfiles: {},
        knowledgeTriples: [],
        hooks: [],
        imports: [],
        importSpecifiers: [],
        exports: [],
        interfaces: [],
        types: [],
        props: [],
        functions: [],
        methods: [],
        stateVariables: [],
        jsxElements: [],
        jsxAttributes: []
    };
    const pushUnique = (list, value) => {
        if (!value)
            return;
        if (!list.includes(value))
            list.push(value);
    };
    const tripleSet = new Set();
    const addTriple = (subject, predicate, object) => {
        const key = `${subject}|${predicate}|${object}`;
        if (tripleSet.has(key))
            return;
        tripleSet.add(key);
        result.knowledgeTriples.push({ subject, predicate, object });
    };
    const ensureComponentProfile = (componentName) => {
        if (!result.componentProfiles[componentName]) {
            result.componentProfiles[componentName] = {
                props: [],
                hooks: [],
                stateVariables: [],
                dependencies: []
            };
        }
        return result.componentProfiles[componentName];
    };
    const getCallName = (callee) => {
        if (t.isIdentifier(callee))
            return callee.name;
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            return callee.property.name;
        }
        return undefined;
    };
    const isForwardRefCall = (callee) => {
        if (t.isIdentifier(callee))
            return callee.name === "forwardRef";
        if (t.isMemberExpression(callee)) {
            return t.isIdentifier(callee.object) && callee.object.name === "React"
                && t.isIdentifier(callee.property) && callee.property.name === "forwardRef";
        }
        return false;
    };
    const isReactFcType = (typeAnnotation) => {
        if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation))
            return false;
        if (!t.isTSTypeReference(typeAnnotation.typeAnnotation))
            return false;
        const typeName = typeAnnotation.typeAnnotation.typeName;
        if (t.isIdentifier(typeName)) {
            return typeName.name === "FC";
        }
        if (t.isTSQualifiedName(typeName)) {
            return t.isIdentifier(typeName.left) && typeName.left.name === "React"
                && t.isIdentifier(typeName.right) && typeName.right.name === "FC";
        }
        return false;
    };
    const getJsxName = (name) => {
        if (t.isJSXIdentifier(name))
            return name.name;
        if (t.isJSXMemberExpression(name)) {
            const objectName = t.isJSXIdentifier(name.object) ? name.object.name : undefined;
            const propertyName = t.isJSXIdentifier(name.property) ? name.property.name : undefined;
            if (!objectName || !propertyName)
                return undefined;
            return `${objectName}.${propertyName}`;
        }
        return undefined;
    };
    const collectPropsFromParam = (param) => {
        if (!param)
            return;
        if (t.isIdentifier(param)) {
            pushUnique(result.props, param.name);
            return;
        }
        if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
            pushUnique(result.props, param.left.name);
            return;
        }
        if (t.isObjectPattern(param)) {
            param.properties.forEach(property => {
                if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
                    pushUnique(result.props, property.key.name);
                }
                if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
                    pushUnique(result.props, property.argument.name);
                }
            });
        }
    };
    const extractPropsFromParam = (param) => {
        const props = [];
        if (!param)
            return props;
        if (t.isIdentifier(param)) {
            props.push(param.name);
            return props;
        }
        if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
            props.push(param.left.name);
            return props;
        }
        if (t.isObjectPattern(param)) {
            param.properties.forEach(property => {
                if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
                    props.push(property.key.name);
                }
                if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
                    props.push(property.argument.name);
                }
            });
        }
        return props;
    };
    const addComponentDependencies = (componentName, deps) => {
        if (!result.componentDependencies[componentName]) {
            result.componentDependencies[componentName] = [];
        }
        deps.forEach(dep => pushUnique(result.componentDependencies[componentName], dep));
    };
    const collectComponentMetrics = (nodePath) => {
        const hooks = new Set();
        const stateVariables = new Set();
        nodePath.traverse({
            CallExpression(innerPath) {
                const callName = getCallName(innerPath.node.callee);
                if (callName && /^use/.test(callName)) {
                    hooks.add(callName);
                }
            },
            VariableDeclarator(innerPath) {
                if (!t.isArrayPattern(innerPath.node.id) || !innerPath.node.init)
                    return;
                if (!t.isCallExpression(innerPath.node.init))
                    return;
                const callName = getCallName(innerPath.node.init.callee);
                if (callName !== "useState")
                    return;
                innerPath.node.id.elements.forEach(element => {
                    if (t.isIdentifier(element))
                        stateVariables.add(element.name);
                });
            }
        });
        return { hooks, stateVariables };
    };
    const addComponentProfile = (componentName, nodePath, firstParam) => {
        const profile = ensureComponentProfile(componentName);
        const deps = collectDependenciesFromPath(nodePath);
        const metrics = collectComponentMetrics(nodePath);
        const props = extractPropsFromParam(firstParam);
        deps.forEach(dep => pushUnique(profile.dependencies, dep));
        metrics.hooks.forEach(hook => pushUnique(profile.hooks, hook));
        metrics.stateVariables.forEach(state => pushUnique(profile.stateVariables, state));
        props.forEach(prop => pushUnique(profile.props, prop));
    };
    const collectDependenciesFromPath = (nodePath) => {
        const deps = new Set();
        nodePath.traverse({
            Identifier(innerPath) {
                if (!innerPath.isReferencedIdentifier())
                    return;
                const source = importNameToSource.get(innerPath.node.name);
                if (source)
                    deps.add(source);
            },
            JSXIdentifier(innerPath) {
                const source = importNameToSource.get(innerPath.node.name);
                if (source)
                    deps.add(source);
            }
        });
        return deps;
    };
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            pushUnique(result.imports, path.node.source.value);
            path.node.specifiers.forEach(specifier => {
                pushUnique(result.importSpecifiers, specifier.local.name);
                importNameToSource.set(specifier.local.name, path.node.source.value);
                if (/^[A-Z]/.test(specifier.local.name)) {
                    pushUnique(result.componentImports, specifier.local.name);
                }
            });
        },
        TSInterfaceDeclaration(path) {
            pushUnique(result.interfaces, path.node.id.name);
        },
        TSTypeAliasDeclaration(path) {
            pushUnique(result.types, path.node.id.name);
        },
        FunctionDeclaration(path) {
            const name = path.node.id?.name;
            if (!name)
                return;
            if (/^[A-Z]/.test(name)) {
                pushUnique(result.components, name);
                collectPropsFromParam(path.node.params[0]);
                addComponentDependencies(name, collectDependenciesFromPath(path));
                addComponentProfile(name, path, path.node.params[0]);
                return;
            }
            pushUnique(result.functions, name);
            pushUnique(result.methods, name);
        },
        VariableDeclarator(path) {
            if (t.isIdentifier(path.node.id) && path.node.id.name && /^[A-Z]/.test(path.node.id.name)) {
                const init = path.node.init;
                if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                    pushUnique(result.components, path.node.id.name);
                    collectPropsFromParam(init.params[0]);
                    addComponentDependencies(path.node.id.name, collectDependenciesFromPath(path.get("init")));
                    addComponentProfile(path.node.id.name, path.get("init"), init.params[0]);
                }
            }
            if (t.isIdentifier(path.node.id) && path.node.id.name) {
                if (isReactFcType(path.node.id.typeAnnotation)) {
                    pushUnique(result.fcComponents, path.node.id.name);
                    pushUnique(result.components, path.node.id.name);
                }
                const init = path.node.init;
                if (t.isCallExpression(init) && isForwardRefCall(init.callee)) {
                    pushUnique(result.forwardRefComponents, path.node.id.name);
                    pushUnique(result.components, path.node.id.name);
                    addComponentDependencies(path.node.id.name, collectDependenciesFromPath(path.get("init")));
                    const firstArg = init.arguments[0];
                    if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
                        addComponentProfile(path.node.id.name, path.get("init"), firstArg.params[0]);
                    }
                    if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
                        collectPropsFromParam(firstArg.params[0]);
                    }
                }
                if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                    if (!/^[A-Z]/.test(path.node.id.name)) {
                        pushUnique(result.functions, path.node.id.name);
                        pushUnique(result.methods, path.node.id.name);
                    }
                }
            }
            if (!t.isArrayPattern(path.node.id) || !path.node.init)
                return;
            if (!t.isCallExpression(path.node.init))
                return;
            const callName = getCallName(path.node.init.callee);
            if (callName !== "useState")
                return;
            path.node.id.elements.forEach(element => {
                if (t.isIdentifier(element))
                    pushUnique(result.stateVariables, element.name);
            });
        },
        ClassMethod(path) {
            if (t.isIdentifier(path.node.key)) {
                pushUnique(result.methods, path.node.key.name);
            }
        },
        ClassProperty(path) {
            if (!t.isIdentifier(path.node.key))
                return;
            if (!path.node.value)
                return;
            if (t.isArrowFunctionExpression(path.node.value) || t.isFunctionExpression(path.node.value)) {
                pushUnique(result.methods, path.node.key.name);
            }
        },
        ObjectMethod(path) {
            if (t.isIdentifier(path.node.key)) {
                pushUnique(result.methods, path.node.key.name);
            }
        },
        CallExpression(path) {
            const callName = getCallName(path.node.callee);
            if (callName && /^use/.test(callName)) {
                pushUnique(result.hooks, callName);
            }
        },
        ExportNamedDeclaration(path) {
            path.node.specifiers.forEach(specifier => {
                if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
                    pushUnique(result.exports, specifier.exported.name);
                }
            });
            const declaration = path.node.declaration;
            if (t.isFunctionDeclaration(declaration) && declaration.id) {
                pushUnique(result.exports, declaration.id.name);
            }
            if (t.isVariableDeclaration(declaration)) {
                declaration.declarations.forEach(item => {
                    if (t.isIdentifier(item.id))
                        pushUnique(result.exports, item.id.name);
                });
            }
        },
        ExportDefaultDeclaration(path) {
            const declaration = path.node.declaration;
            if (t.isIdentifier(declaration))
                pushUnique(result.exports, declaration.name);
            if (t.isFunctionDeclaration(declaration) && declaration.id) {
                pushUnique(result.exports, declaration.id.name);
            }
            if (t.isCallExpression(declaration) && isForwardRefCall(declaration.callee)) {
                pushUnique(result.forwardRefComponents, "default");
            }
        },
        JSXOpeningElement(path) {
            pushUnique(result.jsxElements, getJsxName(path.node.name));
            path.node.attributes.forEach(attribute => {
                if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name)) {
                    pushUnique(result.jsxAttributes, attribute.name.name);
                }
            });
        }
    });
    Object.entries(result.componentProfiles).forEach(([componentName, profile]) => {
        profile.props.forEach(prop => addTriple(componentName, "has_prop", prop));
        profile.hooks.forEach(hook => addTriple(componentName, "uses_hook", hook));
        profile.stateVariables.forEach(state => addTriple(componentName, "has_state", state));
        profile.dependencies.forEach(dep => addTriple(componentName, "depends_on", dep));
    });
    result.forwardRefComponents.forEach(componentName => {
        addTriple(componentName, "component_kind", "React.forwardRef");
    });
    result.fcComponents.forEach(componentName => {
        addTriple(componentName, "component_kind", "React.FC");
    });
    result.componentImports.forEach(componentName => {
        addTriple(componentName, "imported_component", "true");
    });
    result.interfaces.forEach(name => {
        addTriple(name, "symbol_kind", "interface");
    });
    result.types.forEach(name => {
        addTriple(name, "symbol_kind", "type_alias");
    });
    return result;
}
//# sourceMappingURL=reactParser.js.map