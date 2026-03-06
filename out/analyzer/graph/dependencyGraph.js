"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = buildGraph;
function buildGraph(nodes) {
    const graph = new Map();
    nodes.forEach(node => graph.set(node.name, node.imports));
    return graph;
}
//# sourceMappingURL=dependencyGraph.js.map