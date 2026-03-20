import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, FileNode } from '../utils/parser';
import { forceCollide, forceX, forceY, forceRadial, forceManyBody, forceLink } from 'd3-force';
import { Search, BarChart2, AlertTriangle, X, Target, FileText, Download, BrainCircuit } from 'lucide-react';
import FileViewer from './FileViewer';
import { GraphConfig } from './TaxonomySidebar';
import { askAI } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const sanitize = (str: any) => {
  if (!str) return 'unknown';
  const val = typeof str === 'object' ? str.id : str;
  let sanitized = String(val).replace(/[^a-zA-Z0-9]/g, '_');
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = 'node_' + sanitized;
  }
  return sanitized;
};

const extractClassesAndFunctions = (content?: string) => {
  if (!content) return { classes: [], functions: [] };
  const classes: string[] = [];
  const functions: string[] = [];
  
  const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    if (match[1]) classes.push(match[1]);
  }
  
  const funcRegex = /(?:function\s+([a-zA-Z0-9_]+))|(?:const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name) functions.push(name);
  }
  
  return { classes, functions };
};

interface GraphViewProps {
  data: GraphData;
  commits?: any[];
  contributors?: any[];
  onNodeClick: (node: FileNode | null) => void;
  selectedNodeId?: string;
  config: GraphConfig;
  theme?: 'dark' | 'light';
}

export default function GraphView({ data, commits = [], contributors = [], onNodeClick, selectedNodeId, config, theme = 'dark' }: GraphViewProps) {
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [hoverNode, setHoverNode] = useState<FileNode | null>(null);
  const [hoverLink, setHoverLink] = useState<any | null>(null);
  
  // Advanced Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const handleAskAI = async (node: FileNode) => {
    if (!node.content) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const response = await askAI(node.content, "Summarize this file and explain its purpose.", true);
      setAiResponse(response);
    } catch (err) {
      console.error(err);
      setAiResponse('Failed to get AI response.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = (format: 'json' | 'graphml') => {
    let content = '';
    let filename = `graph-export.${format}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(displayData, null, 2);
      mimeType = 'application/json';
    } else if (format === 'graphml') {
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n  <graph id="G" edgedefault="directed">\n`;
      displayData.nodes.forEach(n => {
        content += `    <node id="${n.id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>\n`;
      });
      displayData.links.forEach(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sourceId && targetId) {
          content += `    <edge source="${sourceId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" target="${targetId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>\n`;
        }
      });
      content += `  </graph>\n</graphml>`;
      mimeType = 'application/xml';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute display data based on model
  const displayData = useMemo(() => {
    if (config.model === 'raw-text') {
      const nodes: any[] = [];
      const links: any[] = [];
      
      const fileNodes = data.nodes.filter(n => (n as any).content);
      
      fileNodes.forEach((fileNode) => {
        nodes.push({ ...fileNode, val: 15 });
        const fId = fileNode.id;
        const lines = ((fileNode as any).content || '').split('\n').length;
        nodes.push({ id: `${fId}-lines`, name: `${lines} Lines`, type: 'stat', val: 5 });
        links.push({ source: fId, target: `${fId}-lines` });
      });
      return { nodes, links };
    }

    if (config.model === 'dependency') return data;
    
    if (config.model === 'tree') {
      // Directory Tree Graph
      const nodes = [...data.nodes];
      const links: any[] = [];
      const dirs = new Map<string, any>();
      
      data.nodes.forEach(n => {
        if (!n.path) return;
        const parts = n.path.split('/');
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          const parent = currentPath;
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          if (!dirs.has(currentPath)) {
            const dirNode = { id: currentPath, path: currentPath, name: parts[i], type: 'folder', val: 8 };
            dirs.set(currentPath, dirNode);
            nodes.push(dirNode as any);
            if (parent) {
              links.push({ source: parent, target: currentPath });
            }
          }
        }
        const dir = parts.slice(0, -1).join('/');
        if (dir) {
          links.push({ source: dir, target: n.id });
        }
      });
      
      return { nodes, links };
    }

    if (config.model === 'commit-file') {
      if (commits.length === 0) return { nodes: [], links: [] };
      const nodes: any[] = [];
      const links: any[] = [];
      
      commits.forEach(c => {
        nodes.push({
          id: c.sha,
          name: (c.commit?.message || '').split('\n')[0].substring(0, 30),
          path: c.sha.substring(0, 7),
          type: 'commit',
          val: 15
        });
      });
      
      data.nodes.forEach(n => {
        nodes.push({ ...n, val: 10 });
      });
      
      // Mock links
      commits.slice(0, 10).forEach(c => {
        data.nodes.slice(0, 5).forEach(n => {
          links.push({ source: c.sha, target: n.id });
        });
      });
      
      return { nodes, links };
    }

    if (config.model.startsWith('commit-') || config.model === 'git-dag') {
      if (commits.length === 0) return { nodes: [], links: [] };
      const nodes = commits.map(c => ({
        id: c.sha,
        name: (c.commit?.message || '').split('\n')[0].substring(0, 50),
        path: `${c.sha.substring(0, 7)} by ${c.commit?.author?.name}`,
        type: 'commit',
        val: 10
      }));

      const links: any[] = [];
      commits.forEach(c => {
        if (c.parents) {
          c.parents.forEach((p: any) => {
            if (commits.some(cm => cm.sha === p.sha)) {
              links.push({ source: c.sha, target: p.sha });
            }
          });
        }
      });

      return { nodes, links };
    }

    if (config.model.startsWith('contributor-')) {
      if (contributors.length === 0) return { nodes: [], links: [] };
      const nodes = contributors.map(c => ({
        id: c.login,
        name: c.login,
        path: `Contributions: ${c.contributions}`,
        type: 'contributor',
        val: Math.max(10, Math.min(50, c.contributions / 2)),
        avatar: c.avatar_url
      }));

      const links: any[] = [];
      if (config.model === 'contributor-collab') {
        const centralNode = { id: 'repo', name: 'Repository', path: '', type: 'repo', val: 30, avatar: undefined };
        nodes.push(centralNode as any);
        contributors.forEach(c => {
          links.push({ source: c.login, target: 'repo' });
        });
      }

      return { nodes, links };
    }

    return data;
  }, [data, config.model, commits, contributors]);

  // Compute metrics
  const degrees = useMemo(() => {
    const deg = new Map<string, number>();
    displayData.nodes.forEach(n => deg.set(n.id, 0));
    displayData.links.forEach((l: any) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      deg.set(src, (deg.get(src) || 0) + 1);
      deg.set(tgt, (deg.get(tgt) || 0) + 1);
    });
    return deg;
  }, [displayData]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute clusters based on directory path
  const clusters = useMemo(() => {
    const getDir = (path: string | undefined) => {
      if (!path) return 'root';
      const parts = path.split('/');
      return parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    };
    
    const dirs = Array.from(new Set(displayData.nodes.map(n => getDir(n.path))));
    const map = new Map<string, { x: number, y: number }>();
    
    // Arrange clusters in a circle
    const radius = Math.max(400, dirs.length * 50);
    dirs.forEach((dir, i) => {
      const angle = (i / dirs.length) * 2 * Math.PI;
      map.set(dir, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    });
    
    return map;
  }, [displayData.nodes]);

  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;
      
      // Reset forces
      fg.d3Force('charge', null);
      fg.d3Force('link', null);
      fg.d3Force('collide', null);
      fg.d3Force('clusterX', null);
      fg.d3Force('clusterY', null);
      fg.d3Force('radial', null);

      if (config.encoding === 'circular') {
        const radius = Math.max(300, displayData.nodes.length * 8);
        fg.d3Force('radial', forceRadial(radius, 0, 0).strength(0.8));
        fg.d3Force('collide', forceCollide().radius(15).iterations(2));
        fg.d3Force('charge', forceManyBody().strength(-50));
      } else if (config.encoding === 'force') {
        fg.d3Force('charge', forceManyBody().strength(-400).distanceMax(1200));
        fg.d3Force('link', forceLink().distance(120));
        fg.d3Force('collide', forceCollide().radius(30).iterations(3));
        
        if (config.metric === 'cluster') {
          fg.d3Force('clusterX', forceX((node: any) => {
            if (!node.path) return 0;
            const parts = node.path.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
            return clusters.get(dir)?.x || 0;
          }).strength(0.15));
          
          fg.d3Force('clusterY', forceY((node: any) => {
            if (!node.path) return 0;
            const parts = node.path.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
            return clusters.get(dir)?.y || 0;
          }).strength(0.15));
        }
      } else {
        // DAG modes
        fg.d3Force('charge', forceManyBody().strength(-200));
        fg.d3Force('collide', forceCollide().radius(20).iterations(2));
        fg.d3Force('link', forceLink().distance(50));
      }
      
      setTimeout(() => {
        if (fgRef.current) fgRef.current.zoomToFit(800, 50);
      }, 800);
    }
  }, [displayData, config, clusters]);

  // Center camera on selected node
  useEffect(() => {
    if (selectedNodeId && fgRef.current) {
      const node = data.nodes.find(n => n.id === selectedNodeId) as any;
      if (node && node.x !== undefined && node.y !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(3, 1000);
      }
    }
  }, [selectedNodeId, data.nodes]);

  const getNodeColor = useCallback((node: any) => {
    switch (node.type) {
      case 'ts': case 'tsx': return { fill: '#3178c6', border: '#60a5fa' };
      case 'js': case 'jsx': return { fill: '#f7df1e', border: '#fde047' };
      case 'py': return { fill: '#3572A5', border: '#7dd3fc' };
      case 'css': case 'scss': return { fill: '#563d7c', border: '#c084fc' };
      case 'html': return { fill: '#e34c26', border: '#fca5a5' };
      case 'json': return { fill: '#292929', border: '#a1a1aa' };
      case 'md': return { fill: '#083fa1', border: '#93c5fd' };
      case 'folder': return { fill: '#3f3f46', border: '#a1a1aa' };
      case 'commit': return { fill: '#10b981', border: '#6ee7b7' };
      case 'contributor': return { fill: '#8b5cf6', border: '#c4b5fd' };
      case 'repo': return { fill: '#f43f5e', border: '#fda4af' };
      default: return { fill: '#9e9e9e', border: '#d4d4d8' };
    }
  }, []);

  // Calculate In-Depth Repo Stats
  const stats = useMemo(() => {
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    
    displayData.nodes.forEach(n => { inDegree[n.id] = 0; outDegree[n.id] = 0; });
    displayData.links.forEach((l: any) => {
      const source = typeof l.source === 'object' ? l.source?.id : l.source;
      const target = typeof l.target === 'object' ? l.target?.id : l.target;
      if (source) outDegree[source] = (outDegree[source] || 0) + 1;
      if (target) inDegree[target] = (inDegree[target] || 0) + 1;
    });

    const sortedByIn = [...displayData.nodes].sort((a, b) => (inDegree[b.id] || 0) - (inDegree[a.id] || 0));
    const sortedByOut = [...displayData.nodes].sort((a, b) => (outDegree[b.id] || 0) - (outDegree[a.id] || 0));
    
    const anomalies = displayData.nodes.filter(n => (outDegree[n.id] || 0) > 10);
    const isolated = displayData.nodes.filter(n => (inDegree[n.id] || 0) === 0 && (outDegree[n.id] || 0) === 0);

    return {
      totalNodes: displayData.nodes.length,
      totalLinks: displayData.links.length,
      topDependencies: sortedByIn.slice(0, 3),
      topImporters: sortedByOut.slice(0, 3),
      anomalies,
      isolated,
      inDegree,
      outDegree
    };
  }, [displayData]);

  // Compute highlighted nodes and links (including search)
  const { highlightNodes, highlightLinks, searchMatchNodes } = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<any>();
    const searchMatches = new Set<string>();

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      displayData.nodes.forEach(n => {
        if (n.name.toLowerCase().includes(query) || (n.path && n.path.toLowerCase().includes(query))) {
          searchMatches.add(n.id);
          nodes.add(n.id);
        }
      });
    }

    if (hoverNode || selectedNodeId) {
      const activeNodeId = hoverNode?.id || selectedNodeId;
      const activeNode = displayData.nodes.find(n => n.id === activeNodeId);
      nodes.add(activeNodeId!);
      
      // Highlight directory siblings (the cluster) to show its path
      if (activeNode && activeNode.path) {
        const activeDir = activeNode.path.split('/').slice(0, -1).join('/');
        displayData.nodes.forEach(n => {
          if (!n.path) return;
          const nDir = n.path.split('/').slice(0, -1).join('/');
          if (nDir === activeDir) {
            nodes.add(n.id);
          }
        });
      }
      
      displayData.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (sourceId === activeNodeId || targetId === activeNodeId) {
          links.add(link);
          nodes.add(sourceId);
          nodes.add(targetId);
        }
      });
    }

    if (hoverLink) {
      links.add(hoverLink);
      const sourceId = typeof hoverLink.source === 'object' ? hoverLink.source.id : hoverLink.source;
      const targetId = typeof hoverLink.target === 'object' ? hoverLink.target.id : hoverLink.target;
      nodes.add(sourceId);
      nodes.add(targetId);
    }

    return { highlightNodes: nodes, highlightLinks: links, searchMatchNodes: searchMatches };
  }, [displayData, hoverNode, hoverLink, selectedNodeId, searchQuery]);

  // Handle drawing Neural-style nodes with smooth animation
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (node.x === undefined || node.y === undefined) return;
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoverNode?.id;
    const isSearchMatch = searchMatchNodes.has(node.id);
    const isHighlighted = highlightNodes.has(node.id);
    
    // Dim if there are highlights/searches and this node isn't part of them
    const isDimmed = (highlightNodes.size > 0 && !isHighlighted) || (searchQuery.trim() !== '' && !isSearchMatch && !isHighlighted);
    
    // Base radius from parser (based on length and connections)
    const baseR = config.metric === 'centrality' 
      ? 4 + Math.sqrt(degrees.get(node.id) || 0) * 3
      : 4 + (node.val || 1) * 1.2;
    
    // Target radius based on state
    const targetR = isHovered ? baseR * 1.5 : (isSelected ? baseR * 1.3 : (isHighlighted ? baseR * 1.2 : baseR));
    
    if (node.__currentR === undefined) node.__currentR = baseR;
    node.__currentR += (targetR - node.__currentR) * 0.2;
    const NODE_R = node.__currentR;
    
    const colors = getNodeColor(node);
    const isDark = theme === 'dark';
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    ctx.shadowBlur = isHighlighted ? 25 : 10;
    ctx.shadowColor = colors.border;

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_R + 6, 0, 2 * Math.PI, false);
      ctx.fillStyle = isHovered 
        ? (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.2)') 
        : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)');
      ctx.fill();
    }

    // Search Match Ring
    if (isSearchMatch) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_R + 10, 0, 2 * Math.PI, false);
      ctx.strokeStyle = isDark ? 'rgba(250, 204, 21, 0.8)' : 'rgba(234, 179, 8, 0.8)'; // Yellow ring
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R, 0, 2 * Math.PI, false);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    ctx.lineWidth = isSelected || isHovered ? 3 : 1.5;
    ctx.strokeStyle = isSelected || isHovered ? (isDark ? '#ffffff' : '#000000') : colors.border;
    ctx.stroke();

    const label = node.name;
    
    if (node.type === 'contributor' && node.avatar) {
      if (!node.__img) {
        const img = new Image();
        img.src = node.avatar;
        node.__img = img;
      }
      if (node.__img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_R, 0, 2 * Math.PI, false);
        ctx.clip();
        ctx.drawImage(node.__img, node.x - NODE_R, node.y - NODE_R, NODE_R * 2, NODE_R * 2);
        ctx.restore();
      }
    } else {
      const shortName = label ? label.split('.').pop()?.toUpperCase() || '' : '';
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const innerFontSize = Math.max(6, NODE_R * 0.4);
      ctx.font = `bold ${innerFontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(shortName.substring(0, 4), node.x, node.y);
    }

    if (globalScale > 1.2 || isHighlighted || isSearchMatch) {
      const baseFontSize = isHighlighted || isSearchMatch ? 14 : 10;
      const fontSize = baseFontSize / Math.max(1, globalScale / 2);
      ctx.font = `${isHighlighted || isSearchMatch ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      
      const textWidth = ctx.measureText(label).width;
      const bgWidth = textWidth + 12;
      const bgHeight = fontSize + 8;
      const bgX = node.x - bgWidth / 2;
      const bgY = node.y + NODE_R + 6;
      
      ctx.fillStyle = isHighlighted || isSearchMatch 
        ? (isDark ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)') 
        : (isDark ? 'rgba(30, 30, 30, 0.75)' : 'rgba(240, 240, 240, 0.85)');
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 6);
        ctx.fill();
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      }
      
      ctx.fillStyle = isHighlighted || isSearchMatch 
        ? (isDark ? '#ffffff' : '#000000') 
        : (isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)');
      ctx.fillText(label, node.x, bgY + bgHeight / 2);
    }
    
    ctx.globalAlpha = 1;
  }, [getNodeColor, highlightNodes, searchMatchNodes, hoverNode, selectedNodeId, searchQuery, config.metric, degrees, theme]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white dark:bg-[#050505] overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 shadow-lg relative font-sans transition-colors">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={displayData}
        nodeLabel=""
        nodeRelSize={16}
        
        dagMode={['dag-td', 'dag-lr', 'radial'].includes(config.encoding) ? config.encoding.replace('dag-', '').replace('radial', 'radialout') as any : undefined}
        dagLevelDistance={80}
        
        linkColor={(link: any) => {
          if (hoverLink === link) return theme === 'dark' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.8)';
          return highlightLinks.has(link) 
            ? (theme === 'dark' ? 'rgba(100, 200, 255, 0.8)' : 'rgba(59, 130, 246, 0.8)') 
            : (theme === 'dark' ? 'rgba(100, 150, 255, 0.15)' : 'rgba(100, 150, 255, 0.3)');
        }}
        linkWidth={(link: any) => {
          if (hoverLink === link) return 4;
          return highlightLinks.has(link) ? 2 : 1;
        }}
        linkCurvature={config.encoding === 'force' ? 0.25 : 0} 
        linkDirectionalArrowLength={config.encoding === 'force' ? 0 : 4}
        linkDirectionalArrowRelPos={1}
        
        linkDirectionalParticles={(link: any) => {
          if (hoverLink === link) return 6;
          return highlightLinks.has(link) ? 4 : 1;
        }}
        linkDirectionalParticleWidth={(link: any) => {
          if (hoverLink === link) return 4;
          return highlightLinks.has(link) ? 3 : 1.5;
        }}
        linkDirectionalParticleSpeed={(link: any) => highlightLinks.has(link) ? 0.008 : 0.002}
        linkDirectionalParticleColor={(link: any) => highlightLinks.has(link) ? '#ffffff' : 'rgba(100, 200, 255, 0.5)'}
        
        onNodeClick={(node: any) => {
          if (node.type !== 'folder') {
            onNodeClick(node as FileNode);
          }
        }}
        onBackgroundClick={() => onNodeClick(null)}
        onNodeHover={(node) => setHoverNode(node as FileNode | null)}
        onLinkHover={(link) => setHoverLink(link)}
        backgroundColor={theme === 'dark' ? '#050505' : '#ffffff'}
        
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          if (node.x === undefined || node.y === undefined) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          const hitRadius = Math.max(30, (node.__currentR || 14) + 10);
          ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        linkPointerAreaPaint={(link: any, color, ctx) => {
          if (link.source.x === undefined || link.target.x === undefined) return;
          ctx.strokeStyle = color;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(link.source.x, link.source.y);
          if (config.encoding === 'force') {
            ctx.quadraticCurveTo(
              (link.source.x + link.target.x) / 2,
              (link.source.y + link.target.y) / 2,
              link.target.x,
              link.target.y
            );
          } else {
            ctx.lineTo(link.target.x, link.target.y);
          }
          ctx.stroke();
        }}
      />
      
      {/* Top Center: Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-80 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search nodes by name or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-full pl-10 pr-10 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top Left: Stats Toggle & Panel */}
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start">
        <button
          onClick={() => setShowStats(!showStats)}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg shadow-lg backdrop-blur-md border transition-colors ${
            showStats ? 'bg-indigo-600/90 border-indigo-500 text-white' : 'bg-white/90 dark:bg-[#1e1e1e]/90 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-[#2a2a2a]'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span className="text-sm font-medium">Repo Insights</span>
        </button>

        {showStats && (
          <div className="mt-2 w-80 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl p-4 flex flex-col space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar transition-colors">
            {/* Overview */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 dark:bg-black/30 rounded-lg p-3 border border-zinc-100 dark:border-white/5 transition-colors">
                  <div className="text-2xl font-light text-zinc-900 dark:text-white">{stats.totalNodes}</div>
                  <div className="text-xs text-zinc-500 mt-1">Total Files</div>
                </div>
                <div className="bg-zinc-50 dark:bg-black/30 rounded-lg p-3 border border-zinc-100 dark:border-white/5 transition-colors">
                  <div className="text-2xl font-light text-zinc-900 dark:text-white">{stats.totalLinks}</div>
                  <div className="text-xs text-zinc-500 mt-1">Dependencies</div>
                </div>
              </div>
            </div>

            {/* Hubs */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
                <Target className="w-3.5 h-3.5 mr-1.5" /> Key Hubs (Most Imported)
              </h3>
              <div className="space-y-2">
                {stats.topDependencies.map((node, i) => (
                  <div key={node.id} className="flex items-center justify-between bg-zinc-50 dark:bg-black/20 p-2 rounded border border-zinc-100 dark:border-white/5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors" onClick={() => onNodeClick(node)}>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-2">{node.name}</span>
                    <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{stats.inDegree[node.id]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Anomalies / Alerts */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Anomalies & Alerts
              </h3>
              <div className="space-y-2">
                {stats.anomalies.length > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-lg transition-colors">
                    <div className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-1">High Coupling Detected</div>
                    <p className="text-xs text-amber-600 dark:text-amber-400/70">{stats.anomalies.length} files have &gt;10 dependencies.</p>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 italic">No highly coupled files detected.</div>
                )}
                
                {stats.isolated.length > 0 && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/5 p-3 rounded-lg mt-2 transition-colors">
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-1">Isolated Files</div>
                    <p className="text-xs text-zinc-500">{stats.isolated.length} files have no imports or dependents.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Right: Layout Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <div className="bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
          <button 
            onClick={() => fgRef.current?.zoomToFit(800, 50)}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors"
            title="Fit to screen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
          <button 
            onClick={() => fgRef.current?.d3ReheatSimulation()}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors"
            title="Reheat simulation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>

        <div className="bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
          <button 
            onClick={() => handleExport('json')}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors flex flex-col items-center"
            title="Export JSON"
          >
            <Download className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-mono">JSON</span>
          </button>
          <button 
            onClick={() => handleExport('graphml')}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors flex flex-col items-center"
            title="Export GraphML"
          >
            <Download className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-mono">GML</span>
          </button>
        </div>
      </div>
      
      {/* Bottom Left: Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 p-3 rounded-lg shadow-xl pointer-events-none z-10 transition-colors">
        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Node Types</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: 'TypeScript', color: '#3178c6' },
            { label: 'JavaScript', color: '#f7df1e' },
            { label: 'Python', color: '#3572A5' },
            { label: 'Styles', color: '#563d7c' },
            { label: 'HTML', color: '#e34c26' },
            { label: 'Markdown', color: '#083fa1' },
          ].map(item => (
            <div key={item.label} className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full border border-zinc-200 dark:border-white/20" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}></div>
              <span className="text-xs text-zinc-700 dark:text-zinc-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side: Node Details Panel (Living Document) */}
      {selectedNodeId && (
        <div className="absolute top-20 right-4 w-80 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[calc(100%-6rem)] z-10 overflow-hidden transition-colors">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-black/20">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center">
              <FileText className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
              Node Details
            </h3>
            <button 
              onClick={() => onNodeClick(null)}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {(() => {
            const node = displayData.nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            
            return (
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">{node.type === 'commit' ? 'Message' : node.type === 'contributor' ? 'User' : 'File Name'}</div>
                  <div className="text-sm text-zinc-900 dark:text-white font-medium break-all">{node.name}</div>
                </div>
                
                <div>
                  <div className="text-xs text-zinc-500 mb-1">{node.type === 'commit' ? 'SHA' : node.type === 'contributor' ? 'Info' : 'Path'}</div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-zinc-100 dark:bg-black/30 p-2 rounded border border-zinc-200 dark:border-white/5 break-all">
                    {node.path}
                  </div>
                </div>

                {node.type !== 'commit' && node.type !== 'contributor' && node.type !== 'repo' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-50 dark:bg-black/30 rounded-lg p-3 border border-zinc-200 dark:border-white/5">
                        <div className="text-xl font-light text-zinc-900 dark:text-white">{stats.inDegree[node.id] || 0}</div>
                        <div className="text-xs text-zinc-500 mt-1">Imported By</div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-black/30 rounded-lg p-3 border border-zinc-200 dark:border-white/5">
                        <div className="text-xl font-light text-zinc-900 dark:text-white">{stats.outDegree[node.id] || 0}</div>
                        <div className="text-xs text-zinc-500 mt-1">Dependencies</div>
                      </div>
                    </div>

                    {(node as any).content && (
                      <div>
                        <div className="text-xs text-zinc-500 mb-2">Content Preview</div>
                        <div className="h-48 rounded-lg overflow-hidden border border-zinc-200 dark:border-white/10 relative">
                          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-white dark:to-[#1e1e1e] z-10" />
                          <FileViewer file={node as FileNode} theme={theme} />
                        </div>
                        
                        <div className="mt-4 border-t border-zinc-200 dark:border-white/5 pt-4">
                            <button
                              onClick={() => handleAskAI(node as FileNode)}
                              disabled={aiLoading}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              <BrainCircuit className="w-4 h-4" />
                              {aiLoading ? 'Analyzing...' : 'Ask AI'}
                            </button>
                            
                            {aiResponse && (
                              <div className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-black/30 p-3 rounded border border-zinc-200 dark:border-white/5 mt-2 max-h-48 overflow-y-auto custom-scrollbar">
                                <ReactMarkdown>{aiResponse}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                    )}
                  </>
                )}
                
                {node.type === 'commit' && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Author</div>
                    <div className="text-sm text-zinc-900 dark:text-white">{(node as any).author}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
