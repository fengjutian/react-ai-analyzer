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
        imports: []
    };
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            result.imports.push(path.node.source.value);
        },
        FunctionDeclaration(path) {
            const name = path.node.id?.name;
            if (name && /^[A-Z]/.test(name))
                result.components.push(name);
        },
        CallExpression(path) {
            const callee = path.node.callee;
            if (t.isIdentifier(callee) && /^use/.test(callee.name)) {
                result.hooks.push(callee.name);
            }
        }
    });
    return result;
}
//# sourceMappingURL=reactParser.js.map