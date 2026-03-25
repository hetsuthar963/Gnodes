import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, FileNode } from '../utils/parser';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  data: GraphData;
  type: 'collapsible-tree';
  onNodeClick: (node: FileNode | null) => void;
  onClose: () => void;
}

export default function D3HierarchicalView({ data, type, onNodeClick, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hierarchyData = useMemo(() => {
    const root: any = { name: 'root', children: [] };
    const levelMap: any = { '': root };

    data.nodes.forEach(node => {
      const parts = node.path.split('/');
      let currentPath = '';
      
      parts.forEach((part, i) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!levelMap[currentPath]) {
          const newNode = { 
            name: part, 
            path: currentPath, 
            children: [],
            value: node.size || 100, // Use file size if available
            data: i === parts.length - 1 ? node : null
          };
          levelMap[currentPath] = newNode;
          levelMap[parentPath].children.push(newNode);
        }
      });
    });

    // Remove children array if empty to make it a leaf node for D3
    const clean = (node: any) => {
      if (node.children.length === 0) {
        delete node.children;
      } else {
        node.children.forEach(clean);
      }
    };
    clean(root);

    return d3.hierarchy(root)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data.nodes]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    if (type === 'collapsible-tree') {
      renderCollapsibleTree(svg, hierarchyData, width, height, onNodeClick);
    }
  }, [hierarchyData, type, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

function renderCollapsibleTree(svg: any, root: d3.HierarchyNode<any>, width: number, height: number, onNodeClick: any) {
  const margin = { top: 20, right: 120, bottom: 20, left: 120 };
  const dx = 10;
  const dy = width / 6;
  const tree = d3.tree().nodeSize([dx, dy]);
  const diagonal = d3.linkHorizontal().x((d: any) => d.y).y((d: any) => d.x);

  const g = svg.append("g");

  const gLink = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5);

  const gNode = g.append("g")
      .attr("cursor", "pointer")
      .attr("pointer-events", "all");

  // Add zoom behavior
  svg.call(d3.zoom().on("zoom", (event: any) => {
    g.attr("transform", event.transform);
  }));

  const treeRoot: any = root;
  treeRoot.x0 = dy / 2;
  treeRoot.y0 = 0;

  // Initialize collapsible tree
  treeRoot.descendants().forEach((d: any, i: number) => {
    d.id = i;
    if (d.children) {
      d._children = d.children;
      d.children = null;
    }
  });
  
  // Expand root
  treeRoot.children = treeRoot._children;
  treeRoot._children = null;

  update(null, treeRoot);

  function update(event: any, source: any) {
    const duration = event?.altKey ? 2500 : 250;
    const nodes = treeRoot.descendants().reverse();
    const links = treeRoot.links();

    // Compute the new tree layout.
    tree(treeRoot);

    let left = treeRoot;
    let right = treeRoot;
    treeRoot.eachBefore((node: any) => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + margin.top + margin.bottom;

    const transition = svg.transition()
        .duration(duration)
        .attr("viewBox", [-margin.left, left.x - margin.top, width, height])
        .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

    // Update the nodes…
    const node = gNode.selectAll("g")
      .data(nodes, (d: any) => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node.enter().append("g")
        .attr("transform", (d: any) => `translate(${source.y0},${source.x0})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .on("click", (event: any, d: any) => {
          if (d._children) {
            d.children = d.children ? null : d._children;
            update(event, d);
          } else if (d.data.data) {
            onNodeClick(d.data.data);
          }
        });

    nodeEnter.append("circle")
        .attr("r", 2.5)
        .attr("fill", (d: any) => d._children ? "#555" : getColorByExtension(d.data.name))
        .attr("stroke-width", 10)
        .on("mouseover", function(event, d: any) {
          d3.select(this).attr("r", 5).attr("fill", "#6366f1");
        })
        .on("mouseout", function(event, d: any) {
          d3.select(this).attr("r", 2.5).attr("fill", (d: any) => d._children ? "#555" : getColorByExtension(d.data.name));
        });

    nodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", (d: any) => d._children ? -6 : 6)
        .attr("text-anchor", (d: any) => d._children ? "end" : "start")
        .text((d: any) => d.data.name)
        .style("font", "8px sans-serif")
        .style("fill", "#333")
      .clone(true).lower()
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .attr("stroke", "white")
        .attr("stroke-width", 0);

    // Transition nodes to their new position.
    const nodeUpdate = node.merge(nodeEnter as any).transition(transition as any)
        .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
        .attr("fill-opacity", 1)
        .attr("stroke-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition(transition as any).remove()
        .attr("transform", (d: any) => `translate(${source.y},${source.x})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0);

    // Update the links…
    const link = gLink.selectAll("path")
      .data(links, (d: any) => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link.enter().append("path")
        .attr("d", (d: any) => {
          const o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o} as any);
        });

    // Transition links to their new position.
    link.merge(linkEnter as any).transition(transition as any)
        .attr("d", diagonal as any);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition(transition as any).remove()
        .attr("d", (d: any) => {
          const o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o} as any);
        });

    // Stash the old positions for transition.
    treeRoot.eachBefore((d: any) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
}

function getColorByExtension(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return '#3178c6';
    case 'js': case 'jsx': return '#f7df1e';
    case 'py': case 'pyw': case 'ipynb': return '#3572A5';
    case 'css': case 'scss': case 'sass': case 'less': case 'styl': return '#563d7c';
    case 'html': case 'htm': case 'xhtml': case 'pug': case 'hbs': return '#e34c26';
    case 'json': case 'csv': case 'tsv': case 'xml': case 'graphql': return '#292929';
    case 'md': case 'markdown': case 'mdx': return '#083fa1';
    case 'yml': case 'yaml': case 'toml': case 'ini': case 'env': case 'conf': return '#cb171e';
    case 'cpp': case 'cc': case 'cxx': case 'h': case 'hpp': return '#f34b7d';
    case 'c': return '#555555';
    case 'java': case 'kt': case 'scala': case 'groovy': case 'class': case 'jar': return '#b07219';
    case 'swift': return '#ffac45';
    case 'dart': return '#00b4ab';
    case 'go': return '#00add8';
    case 'cs': case 'fs': case 'vb': return '#178600';
    case 'hs': return '#5e5086';
    case 'f90': return '#734f96';
    case 'cbl': return '#005577';
    case 'sh': case 'bash': case 'zsh': case 'fish': case 'command': return '#89e051';
    case 'pl': case 'lua': case 'ps1': case 'bat': case 'cmd': return '#4f5d95';
    case 'tf': case 'hcl': case 'dockerfile': return '#57534e';
    case 'txt': case 'rst': case 'tex': case 'adoc': return '#6e7681';
    default: return '#94a3b8';
  }
}
