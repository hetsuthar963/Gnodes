import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { toPng, toSvg } from 'html-to-image';
import { GraphData, FileNode } from '../utils/parser';
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
  onLinkClick?: (link: any) => void;
  onStatsChange?: (stats: any) => void;
  selectedNodeId?: string;
  config: GraphConfig;
  theme?: 'dark' | 'light';
}

export default function GraphView({ data, commits = [], contributors = [], onNodeClick, onLinkClick, onStatsChange, selectedNodeId, config, theme = 'dark' }: GraphViewProps) {
  const [hoverNode, setHoverNode] = useState<FileNode | null>(null);
  const [hoverLink, setHoverLink] = useState<any | null>(null);
  
  // Advanced Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${e.clientX + 15}px`;
        tooltipRef.current.style.top = `${e.clientY + 15}px`;
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

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
          val: 15,
          author: c.commit?.author?.name,
          date: c.commit?.author?.date || c.commit?.committer?.date
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
        val: 10,
        author: c.commit?.author?.name,
        date: c.commit?.author?.date || c.commit?.committer?.date
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

  const displayDataRef = useRef(displayData);
  const onNodeClickRef = useRef(onNodeClick);
  const setHoverNodeRef = useRef(setHoverNode);

  useEffect(() => {
    displayDataRef.current = displayData;
    onNodeClickRef.current = onNodeClick;
    setHoverNodeRef.current = setHoverNode;
  }, [displayData, onNodeClick, setHoverNode]);

  const handleExport = useCallback(async (format: 'json' | 'graphml') => {
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
      displayData.links.forEach((l: any) => {
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
  }, [displayData, config.model, theme]);

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

  useEffect(() => {
    if (onStatsChange) {
      onStatsChange(stats);
    }
  }, [stats, onStatsChange]);

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

  const getDagMode = () => {
    if (config.encoding === 'dag-td') return 'td';
    if (config.encoding === 'dag-lr') return 'lr';
    if (config.encoding === 'radial') return 'radialout';
    return undefined;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-white dark:bg-[#050505] overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 shadow-lg relative font-sans transition-colors"
    >
      <ForceGraph2D
        ref={chartRef}
        graphData={displayData}
        nodeId="id"
        nodeLabel="name"
        dagMode={getDagMode()}
        dagLevelDistance={50}
        nodeColor={(node: any) => getNodeColor(node).fill}
        nodeRelSize={6}
        nodeVal={(node: any) => {
          const val = node.val || 1;
          return config.metric === 'centrality' 
            ? 1 + Math.sqrt(degrees.get(node.id) || 0)
            : val;
        }}
        linkColor={(link: any) => {
          const isHighlighted = highlightLinks.has(link);
          const isDimmed = highlightNodes.size > 0 && !isHighlighted;
          if (isHighlighted) return theme === 'dark' ? '#60a5fa' : '#3b82f6';
          if (isDimmed) return theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
          return theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
        }}
        linkWidth={(link: any) => highlightLinks.has(link) ? 3 : Math.max(0.5, Math.min(5, Math.sqrt(link.value || 1)))}
        linkDirectionalArrowLength={config.encoding === 'dag-td' || config.encoding === 'dag-lr' ? 3.5 : 0}
        linkDirectionalArrowRelPos={1}
        linkHoverPrecision={10}
        linkLabel={(link: any) => {
          const sourceName = link.source.name || link.source;
          const targetName = link.target.name || link.target;
          return `${sourceName} → ${targetName}${link.type ? ` (${link.type})` : ''}`;
        }}
        onNodeClick={(node: any) => {
          if (node && node.type !== 'folder') {
            onNodeClick(node as FileNode);
          }
        }}
        onNodeHover={(node: any) => {
          setHoverNode(node || null);
        }}
        onLinkHover={(link: any) => {
          setHoverLink(link || null);
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

          const isHighlighted = highlightNodes.has(node.id);
          const isDimmed = highlightNodes.size > 0 && !isHighlighted;
          const isSearchMatch = searchMatchNodes.has(node.id);
          const isSelected = node.id === selectedNodeId;
          const isHovered = node.id === hoverNode?.id;

          ctx.fillStyle = isHighlighted || isSearchMatch || isSelected || isHovered ? (theme === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(240,240,240,0.8)') : 'rgba(255, 255, 255, 0)';
          if (isHighlighted || isSearchMatch || isSelected || isHovered) {
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDimmed ? (theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : (theme === 'dark' ? '#ffffff' : '#000000');
          
          ctx.beginPath();
          const val = node.val || 1;
          const r = config.metric === 'centrality' 
            ? 2 + Math.sqrt(degrees.get(node.id) || 0)
            : val;
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = getNodeColor(node).fill;
          if (isDimmed) ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;

          if (globalScale > 1.5 || isHighlighted || isSearchMatch || isSelected || isHovered) {
            ctx.fillStyle = isDimmed ? (theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : (theme === 'dark' ? '#ffffff' : '#000000');
            ctx.fillText(label, node.x, node.y + r + fontSize);
          }
        }}
      />
      
      {/* Top Left: Search Bar */}
      <div className="absolute top-4 left-4 w-80 z-10">
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
      <div className="absolute top-20 left-4 z-10 flex flex-col items-start">
      </div>

      {/* Top Right: Layout Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <div className="bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
          <button 
            onClick={() => {
              if (chartRef.current) {
                chartRef.current.zoomToFit(400);
              }
            }}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors"
            title="Fit to screen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
        </div>

        <div className="bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
          <button 
            onClick={() => handleExport('json')}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-md transition-colors flex flex-col items-center"
            title="Export as JSON"
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-mono">JSON</span>
          </button>
        </div>
      </div>
      
      {/* Bottom Left: Legend */}
      <div className="legend-container absolute bottom-4 left-4 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 p-3 rounded-lg shadow-xl pointer-events-none z-10 transition-colors">
        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Node Types</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Array.from(new Set(displayData.nodes.map(n => {
            const type = n.type;
            return type === 'ts' || type === 'tsx' ? 'TypeScript' :
                   type === 'js' || type === 'jsx' ? 'JavaScript' :
                   type === 'py' ? 'Python' :
                   type === 'css' || type === 'scss' ? 'Styles' :
                   type === 'html' ? 'HTML' :
                   type === 'md' ? 'Markdown' :
                   type === 'json' ? 'JSON' :
                   type === 'folder' ? 'Folder' :
                   type === 'commit' ? 'Commit' :
                   type === 'contributor' ? 'Contributor' :
                   type === 'repo' ? 'Repository' :
                   type.toUpperCase();
          }))).map(label => {
            // Find a representative type for the color
            const repType = label === 'TypeScript' ? 'ts' :
                            label === 'JavaScript' ? 'js' :
                            label === 'Python' ? 'py' :
                            label === 'Styles' ? 'css' :
                            label === 'HTML' ? 'html' :
                            label === 'Markdown' ? 'md' :
                            label === 'JSON' ? 'json' :
                            label === 'Folder' ? 'folder' :
                            label === 'Commit' ? 'commit' :
                            label === 'Contributor' ? 'contributor' :
                            label === 'Repository' ? 'repo' :
                            label.toLowerCase();
            const color = getNodeColor({ type: repType }).fill;
            return (
              <div key={label} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full border border-zinc-200 dark:border-white/20" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}></div>
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Link Tooltip */}
      {hoverLink && (
        <div 
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-white text-xs rounded-lg shadow-xl pointer-events-none backdrop-blur-sm border border-zinc-200 dark:border-white/10"
          style={{ left: -1000, top: -1000 }}
        >
          <div className="font-medium mb-1 border-b border-zinc-200 dark:border-white/20 pb-1">Connection</div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 dark:text-zinc-300">From: <span className="text-zinc-900 dark:text-white font-mono">{typeof hoverLink.source === 'object' ? hoverLink.source.name : hoverLink.source}</span></span>
            <span className="text-zinc-600 dark:text-zinc-300">To: <span className="text-zinc-900 dark:text-white font-mono">{typeof hoverLink.target === 'object' ? hoverLink.target.name : hoverLink.target}</span></span>
            {hoverLink.type && <span className="text-indigo-600 dark:text-indigo-300 mt-1">Type: {hoverLink.type}</span>}
            <span className="text-zinc-500 dark:text-zinc-400 italic mt-1 text-[10px]">Click to view import</span>
          </div>
        </div>
      )}

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

                {node.size !== undefined && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Size</div>
                    <div className="text-sm text-zinc-900 dark:text-white">
                      {node.size < 1024 ? `${node.size} B` : node.size < 1024 * 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${(node.size / (1024 * 1024)).toFixed(1)} MB`}
                    </div>
                  </div>
                )}

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
                  <>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Author</div>
                      <div className="text-sm text-zinc-900 dark:text-white">{(node as any).author}</div>
                    </div>
                    {(node as any).date && (
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Date</div>
                        <div className="text-sm text-zinc-900 dark:text-white">{new Date((node as any).date).toLocaleString()}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
