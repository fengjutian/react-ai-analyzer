import * as vscode from "vscode"
import * as path from "path"
import { analyzeReactCode } from "../../analyzer/ast/reactParser"
import { buildGraph } from "../../analyzer/graph/dependencyGraph"

function getNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let value = ""
  for (let i = 0; i < 16; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return value
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeJsonForScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}

type D3Node = {
  id: string
  kind: "component" | "dependency"
}

type D3Link = {
  source: string
  target: string
}

type D3FeatureNode = {
  id: string
  kind: "root" | "component" | "function" | "prop" | "group" | "type" | "interface" | "imported-component" | "hook" | "state" | "dependency" | "relation"
}

type D3FeatureLink = {
  source: string
  target: string
}

type D3KnowledgeNode = {
  id: string
  kind: D3FeatureNode["kind"]
}

type D3KnowledgeLink = {
  source: string
  target: string
}

function toD3GraphData(graph: Map<string, string[]>) {
  const nodeMap = new Map<string, D3Node>()
  const links: D3Link[] = []
  const edgeSet = new Set<string>()

  const ensureNode = (id: string, kind: D3Node["kind"]) => {
    const current = nodeMap.get(id)
    if (current) {
      if (kind === "component") current.kind = "component"
      return
    }
    nodeMap.set(id, { id, kind })
  }

  for (const [componentName, imports] of graph.entries()) {
    ensureNode(componentName, "component")
    for (const dependencyName of imports) {
      ensureNode(dependencyName, "dependency")
      const edgeId = `${componentName}->${dependencyName}`
      if (edgeSet.has(edgeId)) continue
      edgeSet.add(edgeId)
      links.push({ source: componentName, target: dependencyName })
    }
  }

  if (nodeMap.size === 0) {
    nodeMap.set("No dependencies found", { id: "No dependencies found", kind: "dependency" })
  }

  return {
    nodes: [...nodeMap.values()],
    links
  }
}

function toFeatureGraphData(analysis: ReturnType<typeof analyzeReactCode>) {
  const nodeMap = new Map<string, D3FeatureNode>()
  const links: D3FeatureLink[] = []
  const edgeSet = new Set<string>()

  const ensureNode = (id: string, kind: D3FeatureNode["kind"]) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, kind })
    }
  }

  const addLink = (source: string, target: string) => {
    const edgeId = `${source}->${target}`
    if (edgeSet.has(edgeId)) return
    edgeSet.add(edgeId)
    links.push({ source, target })
  }

  const root = "Current File"
  const propGroup = "Props"
  const functionGroup = "Functions"
  const forwardRefGroup = "forwardRef Components"
  const fcGroup = "React.FC Components"
  const importedComponentGroup = "Imported Components"
  const interfaceGroup = "Interfaces"
  const typeGroup = "Type Aliases"
  const hookGroup = "Hooks"
  const stateGroup = "State Variables"
  const dependencyGroup = "Dependencies"

  ensureNode(root, "root")
  ensureNode(propGroup, "group")
  ensureNode(functionGroup, "group")
  ensureNode(forwardRefGroup, "group")
  ensureNode(fcGroup, "group")
  ensureNode(importedComponentGroup, "group")
  ensureNode(interfaceGroup, "group")
  ensureNode(typeGroup, "group")
  ensureNode(hookGroup, "group")
  ensureNode(stateGroup, "group")
  ensureNode(dependencyGroup, "group")

  addLink(root, propGroup)
  addLink(root, functionGroup)
  addLink(root, forwardRefGroup)
  addLink(root, fcGroup)
  addLink(root, importedComponentGroup)
  addLink(root, interfaceGroup)
  addLink(root, typeGroup)
  addLink(root, hookGroup)
  addLink(root, stateGroup)
  addLink(root, dependencyGroup)

  analysis.components.forEach(component => {
    ensureNode(component, "component")
    addLink(root, component)
  })

  const allFunctions = [...new Set([...analysis.functions, ...analysis.methods])]
  allFunctions.forEach(fn => {
    ensureNode(fn, "function")
    addLink(functionGroup, fn)
  })

  analysis.forwardRefComponents.forEach(component => {
    ensureNode(component, "component")
    addLink(forwardRefGroup, component)
  })

  analysis.fcComponents.forEach(component => {
    ensureNode(component, "component")
    addLink(fcGroup, component)
  })

  analysis.componentImports.forEach(component => {
    ensureNode(component, "imported-component")
    addLink(importedComponentGroup, component)
  })

  analysis.interfaces.forEach(name => {
    ensureNode(name, "interface")
    addLink(interfaceGroup, name)
  })

  analysis.types.forEach(name => {
    ensureNode(name, "type")
    addLink(typeGroup, name)
  })

  Object.entries(analysis.componentProfiles).forEach(([componentName, profile]) => {
    ensureNode(componentName, "component")

    profile.props.forEach(prop => {
      ensureNode(prop, "prop")
      addLink(propGroup, prop)
      addLink(componentName, prop)
    })

    profile.hooks.forEach(hook => {
      ensureNode(hook, "hook")
      addLink(hookGroup, hook)
      addLink(componentName, hook)
    })

    profile.stateVariables.forEach(state => {
      ensureNode(state, "state")
      addLink(stateGroup, state)
      addLink(componentName, state)
    })

    profile.dependencies.forEach(dep => {
      ensureNode(dep, "dependency")
      addLink(dependencyGroup, dep)
      addLink(componentName, dep)
    })
  })

  const allProps = [...new Set([...analysis.props, ...analysis.jsxAttributes])]
  allProps.forEach(prop => {
    ensureNode(prop, "prop")
    addLink(propGroup, prop)
  })

  return {
    nodes: [...nodeMap.values()],
    links
  }
}

function toKnowledgeGraphData(analysis: ReturnType<typeof analyzeReactCode>) {
  const nodeMap = new Map<string, D3KnowledgeNode>()
  const links: D3KnowledgeLink[] = []
  const labels: Record<string, string> = {}

  const componentSet = new Set(analysis.components)
  const functionSet = new Set([...analysis.functions, ...analysis.methods])
  const propSet = new Set([...analysis.props, ...analysis.jsxAttributes])
  const hookSet = new Set(analysis.hooks)
  const stateSet = new Set(analysis.stateVariables)
  const dependencySet = new Set(analysis.imports)
  const importedComponentSet = new Set(analysis.componentImports)
  const interfaceSet = new Set(analysis.interfaces)
  const typeSet = new Set(analysis.types)

  const inferKind = (name: string): D3KnowledgeNode["kind"] => {
    if (componentSet.has(name)) return "component"
    if (importedComponentSet.has(name)) return "imported-component"
    if (hookSet.has(name)) return "hook"
    if (stateSet.has(name)) return "state"
    if (propSet.has(name)) return "prop"
    if (functionSet.has(name)) return "function"
    if (interfaceSet.has(name)) return "interface"
    if (typeSet.has(name)) return "type"
    if (dependencySet.has(name) || name.startsWith(".") || name.includes("/")) return "dependency"
    return "group"
  }

  const ensureNode = (id: string, kind: D3KnowledgeNode["kind"], label?: string) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, kind })
    }
    if (label) labels[id] = label
  }

  if (analysis.knowledgeTriples.length === 0) {
    ensureNode("knowledge:empty", "group", "No knowledge triples")
    return { nodes: [...nodeMap.values()], links, labels }
  }

  analysis.knowledgeTriples.forEach((triple, index) => {
    const subjectId = `entity:${triple.subject}`
    const objectId = `entity:${triple.object}`
    const relationId = `relation:${index}:${triple.predicate}`

    ensureNode(subjectId, inferKind(triple.subject), triple.subject)
    ensureNode(objectId, inferKind(triple.object), triple.object)
    ensureNode(relationId, "relation", triple.predicate)

    links.push({ source: subjectId, target: relationId })
    links.push({ source: relationId, target: objectId })
  })

  return {
    nodes: [...nodeMap.values()],
    links,
    labels
  }
}

function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  analysis: ReturnType<typeof analyzeReactCode>,
  graph: Map<string, string[]>
) {
  const graphData = toD3GraphData(graph)
  const featureGraphData = toFeatureGraphData(analysis)
  const knowledgeGraphData = toKnowledgeGraphData(analysis)
  const d3ScriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionUri.fsPath, "node_modules", "d3", "dist", "d3.min.js"))
  )
  const nonce = getNonce()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Analyzer</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      h2 { margin: 20px 0 8px; font-size: 16px; }
      pre { background: #f6f8fa; border-radius: 8px; padding: 12px; overflow: auto; }
      .graph-wrap {
        border: 1px solid #ddd;
        border-radius: 8px;
        min-height: 460px;
        height: 460px;
        overflow: hidden;
        background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
      }
      .graph-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .graph-toolbar button {
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
      }
      .graph-toolbar button:hover { background: #f4f4f4; }
      .hint { color: #666; font-size: 12px; }
      #graphSvg { width: 100%; height: 100%; display: block; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
      }
      .card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 10px;
        background: #fff;
      }
      .card h3 {
        margin: 0 0 8px;
        font-size: 13px;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .tag {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 12px;
      }
      .tag-empty {
        color: #6b7280;
        font-size: 12px;
      }
    </style>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <script nonce="${nonce}" src="${d3ScriptUri}"></script>
  </head>
  <body>
    <h1>React Analyzer</h1>
    <p class="hint">Dependency tree rendered with D3 force graph. Drag nodes to pin, drag canvas to pan, wheel to zoom.</p>

    <h2>Dependency Graph</h2>
    <div class="graph-toolbar">
      <span class="hint">Component: blue, Dependency: orange</span>
      <button id="graphReset" type="button">Reset View</button>
    </div>
    <div class="graph-wrap" id="graphWrap">
      <svg id="graphSvg"></svg>
    </div>

    <h2>Function & Props Relationship</h2>
    <div class="graph-toolbar">
      <span class="hint">Root: purple, Component: blue, Imported: cyan, Function: green, Prop: orange, Interface: red, Type: brown</span>
      <button id="featureGraphReset" type="button">Reset View</button>
    </div>
    <div class="graph-wrap" id="featureGraphWrap">
      <svg id="featureGraphSvg"></svg>
    </div>

    <h2>Knowledge Graph</h2>
    <div class="graph-toolbar">
      <span class="hint">Entity -> relation -> entity (from extracted triples)</span>
      <button id="knowledgeGraphReset" type="button">Reset View</button>
    </div>
    <div class="graph-wrap" id="knowledgeGraphWrap">
      <svg id="knowledgeGraphSvg"></svg>
    </div>

    <h2>Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.components, null, 2))}</pre>

    <h2>Imported Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.componentImports, null, 2))}</pre>

    <h2>Function & Props View</h2>
    <div class="grid">
      <div class="card">
        <h3>React.forwardRef Components</h3>
        <div class="tags">${
          analysis.forwardRefComponents.length
            ? analysis.forwardRefComponents.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
            : '<span class="tag-empty">None</span>'
        }</div>
      </div>
      <div class="card">
        <h3>React.FC Components</h3>
        <div class="tags">${
          analysis.fcComponents.length
            ? analysis.fcComponents.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
            : '<span class="tag-empty">None</span>'
        }</div>
      </div>
      <div class="card">
        <h3>Functions</h3>
        <div class="tags">${
          analysis.functions.length
            ? analysis.functions.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
            : '<span class="tag-empty">None</span>'
        }</div>
      </div>
      <div class="card">
        <h3>Properties (Props + JSX Attributes)</h3>
        <div class="tags">${
          [...new Set([...analysis.props, ...analysis.jsxAttributes])].length
            ? [...new Set([...analysis.props, ...analysis.jsxAttributes])]
                .map(name => `<span class="tag">${escapeHtml(name)}</span>`)
                .join("")
            : '<span class="tag-empty">None</span>'
        }</div>
      </div>
    </div>

    <h2>Hooks</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.hooks, null, 2))}</pre>

    <h2>Props</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.props, null, 2))}</pre>

    <h2>Methods</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.methods, null, 2))}</pre>

    <h2>Exports</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.exports, null, 2))}</pre>

    <h2>Interfaces</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.interfaces, null, 2))}</pre>

    <h2>Type Aliases</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.types, null, 2))}</pre>

    <h2>Import Specifiers</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.importSpecifiers, null, 2))}</pre>

    <h2>State Variables</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.stateVariables, null, 2))}</pre>

    <h2>JSX Elements</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.jsxElements, null, 2))}</pre>

    <h2>ForwardRef Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.forwardRefComponents, null, 2))}</pre>

    <h2>FC Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.fcComponents, null, 2))}</pre>

    <h2>Functions</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.functions, null, 2))}</pre>

    <h2>JSX Attributes</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.jsxAttributes, null, 2))}</pre>

    <h2>Raw Dependency Data</h2>
    <pre>${escapeHtml(JSON.stringify([...graph.entries()], null, 2))}</pre>

    <h2>Component Dependencies</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.componentDependencies, null, 2))}</pre>

    <h2>Component Profiles</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.componentProfiles, null, 2))}</pre>

    <h2>Knowledge Triples</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.knowledgeTriples, null, 2))}</pre>

    <script nonce="${nonce}">
      const parsed = ${safeJsonForScript(graphData)}
      const featureParsed = ${safeJsonForScript(featureGraphData)}
      const knowledgeParsed = ${safeJsonForScript(knowledgeGraphData)}
      const graphWrap = document.getElementById("graphWrap")
      const featureGraphWrap = document.getElementById("featureGraphWrap")
      const knowledgeGraphWrap = document.getElementById("knowledgeGraphWrap")

      if (!window.d3) {
        if (graphWrap) {
          graphWrap.innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
        }
        if (featureGraphWrap) {
          featureGraphWrap.innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
        }
        if (knowledgeGraphWrap) {
          knowledgeGraphWrap.innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
        }
      } else {
        const d3 = window.d3
        const renderGraph = (options) => {
          const svg = d3.select(options.svgSelector)
          const wrap = document.getElementById(options.wrapId)
          if (!wrap) return

          const width = wrap.clientWidth || 900
          const height = wrap.clientHeight || 460
          svg.attr("viewBox", [0, 0, width, height])

          const zoomLayer = svg.append("g")
          const link = zoomLayer
            .append("g")
            .attr("stroke", "#a0aec0")
            .attr("stroke-opacity", 0.7)
            .selectAll("line")
            .data(options.data.links)
            .join("line")
            .attr("stroke-width", 1.5)

          const node = zoomLayer
            .append("g")
            .selectAll("circle")
            .data(options.data.nodes)
            .join("circle")
            .attr("r", d => options.radiusByKind[d.kind] || 7)
            .attr("fill", d => options.colorByKind[d.kind] || "#6b7280")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5)

          const label = zoomLayer
            .append("g")
            .selectAll("text")
            .data(options.data.nodes)
            .join("text")
            .text(d => options.labelById?.[d.id] || d.id)
            .attr("font-size", 11)
            .attr("fill", "#1f2937")

          const simulation = d3.forceSimulation(options.data.nodes)
            .force("link", d3.forceLink(options.data.links).id(d => d.id).distance(90))
            .force("charge", d3.forceManyBody().strength(-280))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(20))

          simulation.on("tick", () => {
            link
              .attr("x1", d => d.source.x)
              .attr("y1", d => d.source.y)
              .attr("x2", d => d.target.x)
              .attr("y2", d => d.target.y)

            node
              .attr("cx", d => d.x)
              .attr("cy", d => d.y)

            label
              .attr("x", d => d.x + 12)
              .attr("y", d => d.y + 4)
          })

          const drag = d3.drag()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart()
              d.fx = d.x
              d.fy = d.y
            })
            .on("drag", (event, d) => {
              d.fx = event.x
              d.fy = event.y
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0)
              d.fx = event.x
              d.fy = event.y
            })

          node.call(drag)

          const zoom = d3.zoom().scaleExtent([0.3, 4]).on("zoom", event => {
            zoomLayer.attr("transform", event.transform)
          })
          svg.call(zoom)

          const resetButton = document.getElementById(options.resetButtonId)
          if (resetButton) {
            resetButton.addEventListener("click", () => {
              svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
            })
          }
        }

        renderGraph({
          svgSelector: "#graphSvg",
          wrapId: "graphWrap",
          resetButtonId: "graphReset",
          data: parsed,
          colorByKind: { component: "#2563eb", dependency: "#f59e0b" },
          radiusByKind: { component: 10, dependency: 7 }
        })

        renderGraph({
          svgSelector: "#featureGraphSvg",
          wrapId: "featureGraphWrap",
          resetButtonId: "featureGraphReset",
          data: featureParsed,
          colorByKind: {
            root: "#9333ea",
            group: "#7c3aed",
            component: "#2563eb",
            "imported-component": "#0ea5e9",
            function: "#16a34a",
            prop: "#ea580c",
            interface: "#dc2626",
            type: "#7c2d12",
            hook: "#0f766e",
            state: "#be185d",
            dependency: "#475569"
          },
          radiusByKind: {
            root: 12,
            group: 10,
            component: 9,
            "imported-component": 9,
            function: 8,
            prop: 8,
            interface: 8,
            type: 8,
            hook: 8,
            state: 8,
            dependency: 8
          },
          labelById: {}
        })

        renderGraph({
          svgSelector: "#knowledgeGraphSvg",
          wrapId: "knowledgeGraphWrap",
          resetButtonId: "knowledgeGraphReset",
          data: knowledgeParsed,
          colorByKind: {
            component: "#2563eb",
            "imported-component": "#0ea5e9",
            hook: "#0f766e",
            state: "#be185d",
            prop: "#ea580c",
            function: "#16a34a",
            interface: "#dc2626",
            type: "#7c2d12",
            dependency: "#475569",
            group: "#6b7280",
            relation: "#7c3aed",
            root: "#9333ea"
          },
          radiusByKind: {
            component: 9,
            "imported-component": 9,
            hook: 8,
            state: 8,
            prop: 8,
            function: 8,
            interface: 8,
            type: 8,
            dependency: 8,
            group: 8,
            relation: 7,
            root: 10
          },
          labelById: knowledgeParsed.labels
        })
      }
    </script>
  </body>
</html>`
}

function getWorkspaceIndexHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  summary: {
    fileCount: number
    componentCount: number
    interfaceCount: number
    typeCount: number
    componentImportCount: number
    componentsByFile: Record<string, string[]>
    dependenciesByFile: Record<string, Record<string, string[]>>
    interfacesByFile: Record<string, string[]>
    typesByFile: Record<string, string[]>
  }
) {
  const d3ScriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionUri.fsPath, "node_modules", "d3", "dist", "d3.min.js"))
  )
  const nonce = getNonce()

  const graphData = (() => {
    const nodes: Array<{ id: string; kind: "file" | "component" }> = []
    const links: Array<{ source: string; target: string }> = []
    const nodeSet = new Set<string>()

    Object.entries(summary.componentsByFile).forEach(([file, components]) => {
      if (!nodeSet.has(file)) {
        nodes.push({ id: file, kind: "file" })
        nodeSet.add(file)
      }
      components.forEach(component => {
        const componentNode = `component:${component}`
        if (!nodeSet.has(componentNode)) {
          nodes.push({ id: componentNode, kind: "component" })
          nodeSet.add(componentNode)
        }
        links.push({ source: file, target: componentNode })
      })
    })

    return { nodes, links }
  })()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Workspace Index</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      h2 { margin: 20px 0 8px; font-size: 16px; }
      .kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      .kpi-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fff; }
      .kpi-item b { font-size: 18px; }
      pre { background: #f6f8fa; border-radius: 8px; padding: 12px; overflow: auto; }
      .graph-wrap { border: 1px solid #ddd; border-radius: 8px; height: 420px; overflow: hidden; }
      .hint { color: #666; font-size: 12px; }
      #workspaceGraphSvg { width: 100%; height: 100%; display: block; }
    </style>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <script nonce="${nonce}" src="${d3ScriptUri}"></script>
  </head>
  <body>
    <h1>Workspace Index</h1>
    <p class="hint">Cross-file summary for React-related files.</p>

    <div class="kpi">
      <div class="kpi-item"><div>Files</div><b>${summary.fileCount}</b></div>
      <div class="kpi-item"><div>Components</div><b>${summary.componentCount}</b></div>
      <div class="kpi-item"><div>Interfaces</div><b>${summary.interfaceCount}</b></div>
      <div class="kpi-item"><div>Types</div><b>${summary.typeCount}</b></div>
      <div class="kpi-item"><div>Imported Components</div><b>${summary.componentImportCount}</b></div>
    </div>

    <h2>File-Component Graph</h2>
    <div class="graph-wrap"><svg id="workspaceGraphSvg"></svg></div>

    <h2>Components By File</h2>
    <pre>${escapeHtml(JSON.stringify(summary.componentsByFile, null, 2))}</pre>
    <h2>Component Dependencies By File</h2>
    <pre>${escapeHtml(JSON.stringify(summary.dependenciesByFile, null, 2))}</pre>
    <h2>Interfaces By File</h2>
    <pre>${escapeHtml(JSON.stringify(summary.interfacesByFile, null, 2))}</pre>
    <h2>Types By File</h2>
    <pre>${escapeHtml(JSON.stringify(summary.typesByFile, null, 2))}</pre>

    <script nonce="${nonce}">
      const graphData = ${safeJsonForScript(graphData)}
      if (!window.d3) {
        document.querySelector(".graph-wrap").innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
      } else {
        const d3 = window.d3
        const svg = d3.select("#workspaceGraphSvg")
        const wrap = document.querySelector(".graph-wrap")
        const width = wrap ? wrap.clientWidth : 900
        const height = wrap ? wrap.clientHeight : 420
        svg.attr("viewBox", [0, 0, width, height])

        const zoomLayer = svg.append("g")
        const link = zoomLayer.append("g").attr("stroke", "#9ca3af").attr("stroke-opacity", 0.8)
          .selectAll("line").data(graphData.links).join("line").attr("stroke-width", 1.2)
        const node = zoomLayer.append("g").selectAll("circle").data(graphData.nodes).join("circle")
          .attr("r", d => (d.kind === "file" ? 10 : 7))
          .attr("fill", d => (d.kind === "file" ? "#334155" : "#2563eb"))
        const label = zoomLayer.append("g").selectAll("text").data(graphData.nodes).join("text")
          .text(d => d.kind === "component" ? d.id.replace(/^component:/, "") : d.id)
          .attr("font-size", 11).attr("fill", "#111827")

        const simulation = d3.forceSimulation(graphData.nodes)
          .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(80))
          .force("charge", d3.forceManyBody().strength(-220))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collision", d3.forceCollide().radius(16))

        simulation.on("tick", () => {
          link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y)
          node.attr("cx", d => d.x).attr("cy", d => d.y)
          label.attr("x", d => d.x + 10).attr("y", d => d.y + 4)
        })

        const drag = d3.drag()
          .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
          .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = event.x; d.fy = event.y })
        node.call(drag)

        const zoom = d3.zoom().scaleExtent([0.3, 4]).on("zoom", event => zoomLayer.attr("transform", event.transform))
        svg.call(zoom)
      }
    </script>
  </body>
</html>`
}

export function activate(context: vscode.ExtensionContext) {
  const analyzeDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.analyze",
    async (resource?: vscode.Uri) => {
      let document: vscode.TextDocument | undefined

      if (resource) {
        document = await vscode.workspace.openTextDocument(resource)
      } else {
        document = vscode.window.activeTextEditor?.document
      }

      if (!document) {
        vscode.window.showWarningMessage("No file selected for analysis.")
        return
      }

      const code = document.getText()
      const analysis = analyzeReactCode(code, document.fileName)
      const graph = buildGraph(
        analysis.components.map(name => ({
          name,
          imports: analysis.componentDependencies[name] ?? []
        }))
      )

      const panel = vscode.window.createWebviewPanel(
        "reactAnalyzer",
        "React Analyzer",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [context.extensionUri]
        }
      )

      panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, analysis, graph)
    }
  )

  const indexDisposable = vscode.commands.registerCommand(
    "react-ai-analyzer.indexWorkspace",
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace folder found.")
        return
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Indexing workspace for React analysis",
          cancellable: false
        },
        async progress => {
          const files = await vscode.workspace.findFiles(
            "**/*.{js,jsx,ts,tsx}",
            "**/{node_modules,out,dist,.git}/**"
          )
          progress.report({ message: `Found ${files.length} files` })

          const componentsByFile: Record<string, string[]> = {}
          const dependenciesByFile: Record<string, Record<string, string[]>> = {}
          const interfacesByFile: Record<string, string[]> = {}
          const typesByFile: Record<string, string[]> = {}

          const componentSet = new Set<string>()
          const interfaceSet = new Set<string>()
          const typeSet = new Set<string>()
          const importedComponentSet = new Set<string>()

          for (let i = 0; i < files.length; i += 1) {
            const file = files[i]
            const document = await vscode.workspace.openTextDocument(file)
            const analysis = analyzeReactCode(document.getText(), file.fsPath)
            const relativeFile = path.relative(workspaceFolder.uri.fsPath, file.fsPath).replace(/\\/g, "/")

            componentsByFile[relativeFile] = analysis.components
            dependenciesByFile[relativeFile] = analysis.componentDependencies
            interfacesByFile[relativeFile] = analysis.interfaces
            typesByFile[relativeFile] = analysis.types

            analysis.components.forEach(name => componentSet.add(name))
            analysis.interfaces.forEach(name => interfaceSet.add(name))
            analysis.types.forEach(name => typeSet.add(name))
            analysis.componentImports.forEach(name => importedComponentSet.add(name))

            if (i % 20 === 0) {
              progress.report({ message: `Indexed ${i + 1}/${files.length}` })
            }
          }

          const panel = vscode.window.createWebviewPanel(
            "reactAnalyzerWorkspaceIndex",
            "React Analyzer Workspace Index",
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              localResourceRoots: [context.extensionUri]
            }
          )

          panel.webview.html = getWorkspaceIndexHtml(panel.webview, context.extensionUri, {
            fileCount: files.length,
            componentCount: componentSet.size,
            interfaceCount: interfaceSet.size,
            typeCount: typeSet.size,
            componentImportCount: importedComponentSet.size,
            componentsByFile,
            dependenciesByFile,
            interfacesByFile,
            typesByFile
          })
        }
      )
    }
  )

  context.subscriptions.push(analyzeDisposable, indexDisposable)
}
