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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const reactParser_1 = require("../../analyzer/ast/reactParser");
const dependencyGraph_1 = require("../../analyzer/graph/dependencyGraph");
function getNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let i = 0; i < 16; i += 1) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function safeJsonForScript(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}
function toD3GraphData(graph) {
    const nodeMap = new Map();
    const links = [];
    const edgeSet = new Set();
    const ensureNode = (id, kind) => {
        const current = nodeMap.get(id);
        if (current) {
            if (kind === "component")
                current.kind = "component";
            return;
        }
        nodeMap.set(id, { id, kind });
    };
    for (const [componentName, imports] of graph.entries()) {
        ensureNode(componentName, "component");
        for (const dependencyName of imports) {
            ensureNode(dependencyName, "dependency");
            const edgeId = `${componentName}->${dependencyName}`;
            if (edgeSet.has(edgeId))
                continue;
            edgeSet.add(edgeId);
            links.push({ source: componentName, target: dependencyName });
        }
    }
    if (nodeMap.size === 0) {
        nodeMap.set("No dependencies found", { id: "No dependencies found", kind: "dependency" });
    }
    return {
        nodes: [...nodeMap.values()],
        links
    };
}
function toFeatureGraphData(analysis) {
    const nodeMap = new Map();
    const links = [];
    const edgeSet = new Set();
    const ensureNode = (id, kind) => {
        if (!nodeMap.has(id)) {
            nodeMap.set(id, { id, kind });
        }
    };
    const addLink = (source, target) => {
        const edgeId = `${source}->${target}`;
        if (edgeSet.has(edgeId))
            return;
        edgeSet.add(edgeId);
        links.push({ source, target });
    };
    const root = "Current File";
    const propGroup = "Props";
    const functionGroup = "Functions";
    const forwardRefGroup = "forwardRef Components";
    const fcGroup = "React.FC Components";
    const importedComponentGroup = "Imported Components";
    const interfaceGroup = "Interfaces";
    const typeGroup = "Type Aliases";
    ensureNode(root, "root");
    ensureNode(propGroup, "group");
    ensureNode(functionGroup, "group");
    ensureNode(forwardRefGroup, "group");
    ensureNode(fcGroup, "group");
    ensureNode(importedComponentGroup, "group");
    ensureNode(interfaceGroup, "group");
    ensureNode(typeGroup, "group");
    addLink(root, propGroup);
    addLink(root, functionGroup);
    addLink(root, forwardRefGroup);
    addLink(root, fcGroup);
    addLink(root, importedComponentGroup);
    addLink(root, interfaceGroup);
    addLink(root, typeGroup);
    analysis.components.forEach(component => {
        ensureNode(component, "component");
        addLink(root, component);
    });
    const allProps = [...new Set([...analysis.props, ...analysis.jsxAttributes])];
    allProps.forEach(prop => {
        ensureNode(prop, "prop");
        addLink(propGroup, prop);
    });
    const allFunctions = [...new Set([...analysis.functions, ...analysis.methods])];
    allFunctions.forEach(fn => {
        ensureNode(fn, "function");
        addLink(functionGroup, fn);
    });
    analysis.forwardRefComponents.forEach(component => {
        ensureNode(component, "component");
        addLink(forwardRefGroup, component);
    });
    analysis.fcComponents.forEach(component => {
        ensureNode(component, "component");
        addLink(fcGroup, component);
    });
    analysis.componentImports.forEach(component => {
        ensureNode(component, "imported-component");
        addLink(importedComponentGroup, component);
    });
    analysis.interfaces.forEach(name => {
        ensureNode(name, "interface");
        addLink(interfaceGroup, name);
    });
    analysis.types.forEach(name => {
        ensureNode(name, "type");
        addLink(typeGroup, name);
    });
    return {
        nodes: [...nodeMap.values()],
        links
    };
}
function getWebviewHtml(webview, extensionUri, analysis, graph) {
    const graphData = toD3GraphData(graph);
    const featureGraphData = toFeatureGraphData(analysis);
    const d3ScriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, "node_modules", "d3", "dist", "d3.min.js")));
    const nonce = getNonce();
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

    <h2>Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.components, null, 2))}</pre>

    <h2>Imported Components</h2>
    <pre>${escapeHtml(JSON.stringify(analysis.componentImports, null, 2))}</pre>

    <h2>Function & Props View</h2>
    <div class="grid">
      <div class="card">
        <h3>React.forwardRef Components</h3>
        <div class="tags">${analysis.forwardRefComponents.length
        ? analysis.forwardRefComponents.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
        : '<span class="tag-empty">None</span>'}</div>
      </div>
      <div class="card">
        <h3>React.FC Components</h3>
        <div class="tags">${analysis.fcComponents.length
        ? analysis.fcComponents.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
        : '<span class="tag-empty">None</span>'}</div>
      </div>
      <div class="card">
        <h3>Functions</h3>
        <div class="tags">${analysis.functions.length
        ? analysis.functions.map(name => `<span class="tag">${escapeHtml(name)}</span>`).join("")
        : '<span class="tag-empty">None</span>'}</div>
      </div>
      <div class="card">
        <h3>Properties (Props + JSX Attributes)</h3>
        <div class="tags">${[...new Set([...analysis.props, ...analysis.jsxAttributes])].length
        ? [...new Set([...analysis.props, ...analysis.jsxAttributes])]
            .map(name => `<span class="tag">${escapeHtml(name)}</span>`)
            .join("")
        : '<span class="tag-empty">None</span>'}</div>
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

    <script nonce="${nonce}">
      const parsed = ${safeJsonForScript(graphData)}
      const featureParsed = ${safeJsonForScript(featureGraphData)}
      const graphWrap = document.getElementById("graphWrap")
      const featureGraphWrap = document.getElementById("featureGraphWrap")

      if (!window.d3) {
        if (graphWrap) {
          graphWrap.innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
        }
        if (featureGraphWrap) {
          featureGraphWrap.innerHTML = "<div style='padding:12px;color:#b91c1c;'>D3 failed to load.</div>"
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
            .text(d => d.id)
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
            type: "#7c2d12"
          },
          radiusByKind: {
            root: 12,
            group: 10,
            component: 9,
            "imported-component": 9,
            function: 8,
            prop: 8,
            interface: 8,
            type: 8
          }
        })
      }
    </script>
  </body>
</html>`;
}
function activate(context) {
    const analyzeDisposable = vscode.commands.registerCommand("react-ai-analyzer.analyze", async (resource) => {
        let document;
        if (resource) {
            document = await vscode.workspace.openTextDocument(resource);
        }
        else {
            document = vscode.window.activeTextEditor?.document;
        }
        if (!document) {
            vscode.window.showWarningMessage("No file selected for analysis.");
            return;
        }
        const code = document.getText();
        const analysis = (0, reactParser_1.analyzeReactCode)(code, document.fileName);
        const graph = (0, dependencyGraph_1.buildGraph)(analysis.components.map(name => ({ name, imports: analysis.imports })));
        const panel = vscode.window.createWebviewPanel("reactAnalyzer", "React Analyzer", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [context.extensionUri]
        });
        panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, analysis, graph);
    });
    const indexDisposable = vscode.commands.registerCommand("react-ai-analyzer.indexWorkspace", async () => {
        vscode.window.showInformationMessage("Indexing workspace...");
        setTimeout(() => {
            vscode.window.showInformationMessage("Indexing completed!");
        }, 2000);
    });
    context.subscriptions.push(analyzeDisposable, indexDisposable);
}
//# sourceMappingURL=extension.js.map