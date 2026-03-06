export interface Node {
  name: string
  imports: string[]
}

export function buildGraph(nodes: Node[]) {
  const graph = new Map<string, string[]>()
  nodes.forEach(node => graph.set(node.name, node.imports))
  return graph
}