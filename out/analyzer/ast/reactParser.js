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
    const result = {
        components: [],
        hooks: [],
        imports: [],
        importSpecifiers: [],
        exports: [],
        stateVariables: [],
        jsxElements: []
    };
    const pushUnique = (list, value) => {
        if (!value)
            return;
        if (!list.includes(value))
            list.push(value);
    };
    const getCallName = (callee) => {
        if (t.isIdentifier(callee))
            return callee.name;
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            return callee.property.name;
        }
        return undefined;
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
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            pushUnique(result.imports, path.node.source.value);
            path.node.specifiers.forEach(specifier => {
                pushUnique(result.importSpecifiers, specifier.local.name);
            });
        },
        FunctionDeclaration(path) {
            const name = path.node.id?.name;
            if (name && /^[A-Z]/.test(name))
                pushUnique(result.components, name);
        },
        VariableDeclarator(path) {
            if (t.isIdentifier(path.node.id) && path.node.id.name && /^[A-Z]/.test(path.node.id.name)) {
                const init = path.node.init;
                if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                    pushUnique(result.components, path.node.id.name);
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
        },
        JSXOpeningElement(path) {
            pushUnique(result.jsxElements, getJsxName(path.node.name));
        }
    });
    return result;
}
//# sourceMappingURL=reactParser.js.map