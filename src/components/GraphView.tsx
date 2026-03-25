import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide, forceX, forceY, forceRadial, forceManyBody, forceLink } from 'd3-force';
import { toPng, toSvg } from 'html-to-image';
import { GraphData, FileNode } from '../utils/parser';
import { Search, BarChart2, AlertTriangle, X, Target, FileText, Download, Map as MapIcon, Compass, Info } from 'lucide-react';
import { clsx } from 'clsx';
import FileViewer from './FileViewer';
import { GraphConfig } from './TaxonomySidebar';
import ReactMarkdown from 'react-markdown';
import D3HierarchicalView from './D3HierarchicalView';

// MiniMap Component
const MiniMap = ({ data, dimensions, transform, onNavigate, engineTick }: { data: any, dimensions: { width: number, height: number }, transform: { x: number, y: number, k: number }, onNavigate: (x: number, y: number) => void, engineTick: number }) => {
 const mapWidth = 200;
 const mapHeight = 150;
 const padding = 10;

 // Calculate bounds of the graph
 const bounds = useMemo(() => {
 if (!data.nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
 let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
 let hasValidNodes = false;

 data.nodes.forEach((n: any) => {
 if (typeof n.x === 'number' && !isNaN(n.x) && typeof n.y === 'number' && !isNaN(n.y)) {
 if (n.x < minX) minX = n.x;
 if (n.y < minY) minY = n.y;
 if (n.x > maxX) maxX = n.x;
 if (n.y > maxY) maxY = n.y;
 hasValidNodes = true;
 }
 });

 if (!hasValidNodes) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
 return { minX, minY, maxX, maxY };
 }, [data.nodes, engineTick]);

 const scaleX = (mapWidth - 2 * padding) / (bounds.maxX - bounds.minX || 1);
 const scaleY = (mapHeight - 2 * padding) / (bounds.maxY - bounds.minY || 1);
 let scale = Math.min(scaleX, scaleY);
 if (isNaN(scale) || !isFinite(scale)) scale = 1;

 const offsetX = padding + (mapWidth - 2 * padding - (bounds.maxX - bounds.minX) * scale) / 2;
 const offsetY = padding + (mapHeight - 2 * padding - (bounds.maxY - bounds.minY) * scale) / 2;

 const toMapX = (x: number | undefined) => {
 if (x === undefined || isNaN(x) || !isFinite(x)) return 0;
 const val = (x - bounds.minX) * scale + offsetX;
 return isNaN(val) ? 0 : val;
 };
 const toMapY = (y: number | undefined) => {
 if (y === undefined || isNaN(y) || !isFinite(y)) return 0;
 const val = (y - bounds.minY) * scale + offsetY;
 return isNaN(val) ? 0 : val;
 };
 const fromMapX = (mx: number) => (mx - offsetX) / scale + bounds.minX;
 const fromMapY = (my: number) => (my - offsetY) / scale + bounds.minY;

 // Viewport rectangle
 const viewport = useMemo(() => {
 const k = transform.k || 1;
 const x = transform.x || 0;
 const y = transform.y || 0;

 const topLeft = {
 x: (-x) / k,
 y: (-y) / k
 };
 const bottomRight = {
 x: (dimensions.width - x) / k,
 y: (dimensions.height - y) / k
 };

 const vx = toMapX(topLeft.x);
 const vy = toMapY(topLeft.y);
 const vw = (bottomRight.x - topLeft.x) * scale;
 const vh = (bottomRight.y - topLeft.y) * scale;

 return {
 x: isNaN(vx) ? 0 : vx,
 y: isNaN(vy) ? 0 : vy,
 w: isNaN(vw) || vw < 0 ? 0 : vw,
 h: isNaN(vh) || vh < 0 ? 0 : vh
 };
 }, [transform, dimensions, bounds, scale]);

 const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
 const rect = e.currentTarget.getBoundingClientRect();
 const mx = e.clientX - rect.left;
 const my = e.clientY - rect.top;
 onNavigate(fromMapX(mx), fromMapY(my));
 };

 return (
 <div className="absolute bottom-4 right-4 w-[200px] h-[150px] bg-white/80 backdrop-blur-md border border-zinc-200 rounded-lg shadow-2xl overflow-hidden z-20 transition-colors cursor-crosshair group">
 <svg width={mapWidth} height={mapHeight} className="opacity-60" onClick={handleClick}>
 {/* Links */}
 {data.links.map((l: any, i: number) => {
 const s = typeof l.source === 'object' ? l.source : data.nodes.find((n: any) => n.id === l.source);
 const t = typeof l.target === 'object' ? l.target : data.nodes.find((n: any) => n.id === l.target);
 if (!s || !t || s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) return null;
 return (
 <line 
 key={i} 
 x1={toMapX(s.x)} y1={toMapY(s.y)} 
 x2={toMapX(t.x)} y2={toMapY(t.y)} 
 stroke="rgba(0,0,0,0.1)" 
 strokeWidth="0.5" 
 />
 );
 })}
 {/* Nodes */}
 {data.nodes.map((n: any) => {
 if (n.x === undefined || n.y === undefined) return null;
 return (
 <circle 
 key={n.id} 
 cx={toMapX(n.x)} cy={toMapY(n.y)} 
 r="1.5" 
 fill="rgba(0,0,0,0.3)" 
 />
 );
 })}
 {/* Viewport Indicator */}
 <rect 
 x={viewport.x} y={viewport.y} 
 width={viewport.w} height={viewport.h} 
 fill="rgba(99, 102, 241, 0.1)" 
 stroke="#6366f1" 
 strokeWidth="1.5"
 className="transition-all duration-200"
 />
 </svg>
 <div className="absolute top-1 left-2 text-[8px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1 pointer-events-none">
 <MapIcon size={8} />
 <span>Map</span>
 </div>
 <div className="absolute bottom-1 left-2 text-[7px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
 Click to navigate
 </div>
 </div>
 );
};

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
 searchQuery?: string;
 onNodeClick: (node: FileNode | null) => void;
 onLinkClick?: (link: any) => void;
 onStatsChange?: (stats: any) => void;
 selectedNodeId?: string;
 config: GraphConfig;
 onConfigChange?: (config: GraphConfig) => void;
 viewMode?: 'split' | 'graph' | 'file';
}

export default function GraphView({ data, commits = [], contributors = [], searchQuery = '', onNodeClick, onLinkClick, onStatsChange, selectedNodeId, config, onConfigChange, viewMode = 'graph' }: GraphViewProps) {
  const [cycles, setCycles] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/data.worker.ts', import.meta.url), { type: 'module' });
    
    setIsProcessing(true);
    worker.postMessage({ data, config, commits, contributors });

    worker.onmessage = (e) => {
      if (e.data.type === 'ERROR') {
        console.error('Worker error in GraphView:', e.data.payload);
        setIsProcessing(false);
        return;
      }

      const { displayData: computedData, degrees, cycles: computedCycles } = e.data;
      // We can't easily update displayData if it's a useMemo, 
      // so we might need to change how displayData is handled.
      setCycles(computedCycles || []);
      // For now, let's just update the stats
      if (onStatsChange && degrees && computedCycles) {
        onStatsChange({ inDegree: degrees, outDegree: degrees, cycles: computedCycles });
      }
      setIsProcessing(false);
    };

    return () => worker.terminate();
  }, [data, config, commits, contributors, onStatsChange]);
 const [hoverNode, setHoverNode] = useState<FileNode | null>(null);
 const [hoverLink, setHoverLink] = useState<any | null>(null);
 
 // Advanced Features State
 const [showStats, setShowStats] = useState(false);
 const [isExporting, setIsExporting] = useState(false);
 const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
 const [engineTick, setEngineTick] = useState(0);
 const tickRef = useRef(0);
 const tooltipRef = useRef<HTMLDivElement>(null);

 const chartRef = useRef<any>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

 useEffect(() => {
 if (!containerRef.current) return;
 
 const resizeObserver = new ResizeObserver((entries) => {
 for (const entry of entries) {
 setDimensions({
 width: entry.contentRect.width,
 height: entry.contentRect.height
 });
 }
 });
 
 resizeObserver.observe(containerRef.current);
 return () => resizeObserver.disconnect();
 }, []);

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
 content = `<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n <graph id="G" edgedefault="directed">\n`;
 displayData.nodes.forEach(n => {
 content += ` <node id="${n.id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>\n`;
 });
 displayData.links.forEach((l: any) => {
 const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
 const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
 if (sourceId && targetId) {
 content += ` <edge source="${sourceId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" target="${targetId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>\n`;
 }
 });
 content += ` </graph>\n</graphml>`;
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
 }, [displayData, config.model]);

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

 const hasInitialZoomed = useRef(false);

 useEffect(() => {
 hasInitialZoomed.current = false;
 }, [displayData]);

 useEffect(() => {
 if (chartRef.current) {
 const fg = chartRef.current;
 
 // Advanced physics for better separation and less overlapping
 fg.d3Force('charge', forceManyBody().strength(-800).distanceMax(1000));
 
 fg.d3Force('link', forceLink().distance((link: any) => {
 const sourceR = getNodeSize(link.source);
 const targetR = getNodeSize(link.target);
 return 60 + sourceR + targetR;
 }).strength(0.5));
 
 fg.d3Force('collide', forceCollide().radius((node: any) => {
 const r = getNodeSize(node);
 return r + 25; // Extra padding for labels and borders
 }).iterations(3));

 fg.d3Force('x', forceX(0).strength(0.02));
 fg.d3Force('y', forceY(0).strength(0.02));
 
 fg.d3Force('radial', null);
 
 fg.d3ReheatSimulation();
 }
 }, [displayData, config.metric, degrees]);

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

 const getNodeSize = useCallback((node: any) => {
  const val = node.val || 1;
  if (config.metric === 'centrality') {
   return 2 + Math.sqrt(degrees.get(node.id) || 0);
  }
  if (config.metric === 'physics-state') {
   return 2 + Math.sqrt(node.physics?.state_management || 0) * 2;
  }
  if (config.metric === 'physics-effects') {
   return 2 + Math.sqrt(node.physics?.side_effects || 0) * 2;
  }
  if (config.metric === 'physics-data') {
   return 2 + Math.sqrt(node.physics?.data_flow || 0) * 2;
  }
  if (config.metric === 'physics-comp') {
   return 2 + Math.sqrt(node.physics?.computation || 0) * 2;
  }
  if (config.metric === 'physics-complexity') {
   return 2 + Math.sqrt(node.metrics?.complexity || 0) * 2;
  }
  return val;
 }, [config.metric, degrees]);

 const getNodeColor = useCallback((node: any) => {
  if (config.metric.startsWith('physics-')) {
   const size = getNodeSize(node);
   if (size > 2) {
    if (config.metric === 'physics-state') return { fill: '#ec4899', border: '#be185d' };
    if (config.metric === 'physics-effects') return { fill: '#f59e0b', border: '#b45309' };
    if (config.metric === 'physics-data') return { fill: '#10b981', border: '#047857' };
    if (config.metric === 'physics-comp') return { fill: '#6366f1', border: '#4338ca' };
   }
   return { fill: '#e2e8f0', border: '#94a3b8' };
  }

  switch (node.type) {
   case 'yml': case 'yaml': return { fill: '#cb171e', border: '#8a1015' }; // YML Red
  case 'yml': case 'yaml': return { fill: '#cb171e', border: '#8a1015' }; // YML Red
  case 'cpp': case 'cc': case 'cxx': return { fill: '#f34b7d', border: '#a93457' }; // CPP Pink
  case 'c': return { fill: '#555555', border: '#333333' }; // C Gray
  case 'java': return { fill: '#b07219', border: '#7a4f11' }; // Java Brown
  case 'ts': case 'tsx': return { fill: '#3178c6', border: '#1e4b82' }; // TypeScript Blue
 case 'js': case 'jsx': return { fill: '#f7df1e', border: '#a19100' }; // JS Yellow
 case 'py': return { fill: '#3572A5', border: '#1e4262' }; // Python Blue
 case 'css': case 'scss': return { fill: '#563d7c', border: '#312346' }; // CSS Purple
 case 'html': return { fill: '#e34c26', border: '#8b2c15' }; // HTML Orange
 case 'json': return { fill: '#292929', border: '#000000' }; // JSON Black
 case 'md': return { fill: '#083fa1', border: '#042154' }; // Markdown Blue
 case 'folder': return { fill: '#eab308', border: '#854d0e' }; // Folder Yellow
 case 'commit': return { fill: '#10b981', border: '#047857' }; // Commit Green
 case 'contributor': return { fill: '#8b5cf6', border: '#5b21b6' }; // Contributor Purple
 case 'repo': return { fill: '#f43f5e', border: '#be123c' }; // Repo Rose
 default: return { fill: '#94a3b8', border: '#475569' }; // Default Slate
 }
 }, [config.metric, getNodeSize]);

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
 outDegree,
 cycles
 };
 }, [displayData, cycles]);

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

 useEffect(() => {
 if (searchQuery.trim() && chartRef.current) {
 const query = searchQuery.toLowerCase();
 const match = displayData.nodes.find(n => 
 n.name.toLowerCase().includes(query) || 
 (n.path && n.path.toLowerCase().includes(query))
 );
 
 if (match && typeof match.x === 'number' && typeof match.y === 'number') {
 chartRef.current.centerAt(match.x, match.y, 1000);
 chartRef.current.zoom(2, 1000);
 }
 }
 }, [searchQuery, displayData]);

 const getDagMode = () => {
 if (cycles && cycles.length > 0) return undefined;
 if (config.encoding === 'dag-td') return 'td';
 if (config.encoding === 'dag-lr') return 'lr';
 if (config.encoding === 'radial') return 'radialout';
 return undefined;
 };

 return (
 <div 
 ref={containerRef}
 className={clsx(
 "w-full h-full bg-white overflow-hidden relative font-sans transition-colors",
 viewMode !== 'graph' && "rounded-xl border border-zinc-200 shadow-lg"
 )}
 >
 {['tree-of-life', 'collapsible-tree'].includes(config.model) ? (
 <D3HierarchicalView 
 data={data} 
 type={config.model as any} 
 onNodeClick={onNodeClick}
 onClose={() => onConfigChange?.({ ...config, model: 'tree' })} 
 />
 ) : (
 dimensions.width > 0 && dimensions.height > 0 && (
 <ForceGraph2D
 ref={chartRef}
 graphData={displayData}
 width={dimensions.width}
 height={dimensions.height}
 onZoomEnd={(t) => {
 requestAnimationFrame(() => setTransform(t));
 }}
 onEngineStop={() => {
 setEngineTick(Date.now());
 if (!hasInitialZoomed.current && chartRef.current) {
 chartRef.current.zoomToFit(400, 50);
 hasInitialZoomed.current = true;
 }
 }}
 nodeId="id"
 nodeLabel="name"
 dagMode={getDagMode()}
 dagLevelDistance={50}
 nodeColor={(node: any) => getNodeColor(node).fill}
 nodeRelSize={6}
 nodeVal={(node: any) => getNodeSize(node)}
 linkColor={(link: any) => {
 const isHighlighted = highlightLinks.has(link);
 const isDimmed = highlightNodes.size > 0 && !isHighlighted;
 if (isHighlighted) return '#3b82f6';
 if (isDimmed) return 'rgba(0,0,0,0.05)';
 return 'rgba(0,0,0,0.2)';
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
 onBackgroundClick={() => onNodeClick(null)}
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
 const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

 const isHighlighted = highlightNodes.has(node.id);
 const isDimmed = highlightNodes.size > 0 && !isHighlighted;
 const isSearchMatch = searchMatchNodes.has(node.id);
 const isSelected = node.id === selectedNodeId;
 const isHovered = node.id === hoverNode?.id;

 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 
 const r = getNodeSize(node);

 if (node.type === 'contributor' && node.avatar) {
 if (!node.img) {
 const img = new Image();
 img.src = node.avatar;
 node.img = img;
 }
 
 const size = r * 2.5; // Make avatars slightly larger
 
 ctx.save();
 ctx.beginPath();
 ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
 ctx.clip();
 
 if (node.img.complete && node.img.naturalHeight !== 0) {
 if (isDimmed) ctx.globalAlpha = 0.2;
 ctx.drawImage(node.img, node.x - size / 2, node.y - size / 2, size, size);
 ctx.globalAlpha = 1;
 } else {
 ctx.fillStyle = getNodeColor(node).fill;
 if (isDimmed) ctx.globalAlpha = 0.2;
 ctx.fill();
 ctx.globalAlpha = 1;
 }
 
 ctx.restore();
 
 ctx.beginPath();
 ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
 ctx.lineWidth = 1.5 / globalScale;
 ctx.strokeStyle = getNodeColor(node).border;
 if (isDimmed) ctx.globalAlpha = 0.2;
 ctx.stroke();
 ctx.globalAlpha = 1;

 } else {
 ctx.beginPath();
 ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
 
 // Add shadow for depth
 ctx.shadowColor = isDimmed ? 'transparent' : 'rgba(0,0,0,0.15)';
 ctx.shadowBlur = 4 / globalScale;
 ctx.shadowOffsetX = 1 / globalScale;
 ctx.shadowOffsetY = 1 / globalScale;
 
 ctx.fillStyle = getNodeColor(node).fill;
 if (isDimmed) ctx.globalAlpha = 0.2;
 ctx.fill();
 
 // Reset shadow before stroke
 ctx.shadowColor = 'transparent';
 ctx.shadowBlur = 0;
 ctx.shadowOffsetX = 0;
 ctx.shadowOffsetY = 0;
 
 ctx.lineWidth = 1.5 / globalScale;
 ctx.strokeStyle = getNodeColor(node).border;
 ctx.stroke();
 
 ctx.globalAlpha = 1;
 }

 // Draw highlight ring
 if (isHighlighted || isSearchMatch || isSelected || isHovered) {
 ctx.beginPath();
 ctx.arc(node.x, node.y, r + 4 / globalScale, 0, 2 * Math.PI, false);
 ctx.strokeStyle = isSearchMatch ? 'rgba(234, 179, 8, 0.8)' : 'rgba(99, 102, 241, 0.8)';
 ctx.lineWidth = 2 / globalScale;
 ctx.stroke();
 }

 const showLabel = globalScale > 2 || isHighlighted || isSearchMatch || isSelected || isHovered;

 if (showLabel) {
 const labelY = node.y + r + fontSize;
 
 // Draw background pill
 ctx.fillStyle = isDimmed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)';
 ctx.fillRect(
 node.x - bckgDimensions[0] / 2, 
 labelY - bckgDimensions[1] / 2, 
 bckgDimensions[0], 
 bckgDimensions[1]
 );
 
 // Draw border for pill
 ctx.lineWidth = 0.5 / globalScale;
 ctx.strokeStyle = isDimmed ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)';
 ctx.strokeRect(
 node.x - bckgDimensions[0] / 2, 
 labelY - bckgDimensions[1] / 2, 
 bckgDimensions[0], 
 bckgDimensions[1]
 );

 // Draw text
 ctx.fillStyle = isDimmed ? 'rgba(0,0,0,0.3)' : '#000000';
 ctx.fillText(label, node.x, labelY);
 }
 }}
 />))}
 
 {/* Top Left: Breadcrumbs */}
 <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
 {selectedNodeId && (
 <div className="flex items-center gap-1 px-3 py-1.5 bg-white/80 backdrop-blur-md border border-zinc-200 rounded-lg text-[10px] font-mono text-zinc-500 shadow-sm max-w-xl overflow-hidden">
 <Compass size={12} className="flex-shrink-0" />
 {(() => {
 const node = displayData.nodes.find(n => n.id === selectedNodeId);
 if (!node || !node.path) return null;
 const parts = node.path.split('/');
 return parts.map((p: string, i: number) => (
 <React.Fragment key={i}>
 <span className={i === parts.length - 1 ? "text-indigo-500 font-bold" : ""}>{p}</span>
 {i < parts.length - 1 && <span className="opacity-30">/</span>}
 </React.Fragment>
 ));
 })()}
 </div>
 )}
 </div>

 {/* Top Left: Stats Toggle & Panel */}
 <div className="absolute top-20 left-4 z-10 flex flex-col items-start">
 </div>

 {/* Top Right: Layout Controls */}
 <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
 <div className="bg-white/90 backdrop-blur-md border border-zinc-200 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
 <button 
 onClick={() => {
 if (chartRef.current) {
 chartRef.current.zoomToFit(400);
 }
 }}
 className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
 title="Fit to screen"
 >
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
 </svg>
 </button>
 </div>

 <div className="bg-white/90 backdrop-blur-md border border-zinc-200 rounded-lg shadow-lg p-1 flex flex-col space-y-1 mt-2 transition-colors">
 <button 
 onClick={() => handleExport('json')}
 className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors flex flex-col items-center"
 title="Export as JSON"
 disabled={isExporting}
 >
 <Download className="w-4 h-4 mb-1" />
 <span className="text-[9px] font-mono">JSON</span>
 </button>
 </div>
 </div>
 
 {/* Bottom Left: Legend */}
 <div className={clsx("legend-container absolute bottom-4 left-4 bg-white/90 backdrop-blur-md border border-zinc-200 p-3 rounded-lg shadow-xl pointer-events-auto z-10 transition-all", !showLegend && "p-2")}>
    <button onClick={() => setShowLegend(!showLegend)} className="absolute -top-2 -right-2 bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 rounded-full p-1 z-20 transition-colors shadow-sm">
       {showLegend ? <X size={12} /> : <Info size={12} />}
    </button>
    {showLegend && (
      <>
        <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider sticky top-0 bg-white/90 backdrop-blur-md py-1 border-b border-zinc-100">Node Types</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 max-h-48 overflow-y-auto pr-2">
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
 <div className="w-3 h-3 rounded-full border border-zinc-200 " style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}></div>
 <span className="text-xs text-zinc-700 ">{label}</span>
 </div>
 );
 })}
 </div>
 </>
 )}
 </div>

 {/* Link Tooltip */}
 {hoverLink && (
 <div 
 ref={tooltipRef}
 className="fixed z-50 px-3 py-2 bg-white/95 text-zinc-900 text-xs rounded-lg shadow-xl pointer-events-none backdrop-blur-sm border border-zinc-200 "
 style={{ left: -1000, top: -1000 }}
 >
 <div className="font-medium mb-1 border-b border-zinc-200 pb-1">Connection</div>
 <div className="flex flex-col gap-1">
 <span className="text-zinc-600 ">From: <span className="text-zinc-900 font-mono">{typeof hoverLink.source === 'object' ? hoverLink.source.name : hoverLink.source}</span></span>
 <span className="text-zinc-600 ">To: <span className="text-zinc-900 font-mono">{typeof hoverLink.target === 'object' ? hoverLink.target.name : hoverLink.target}</span></span>
 {hoverLink.type && <span className="text-indigo-600 mt-1">Type: {hoverLink.type}</span>}
 <span className="text-zinc-500 italic mt-1 text-[10px]">Click to view import</span>
 </div>
 </div>
 )}

 {/* Mini Map (Temporarily Disabled)
 <MiniMap 
 data={displayData} 
 dimensions={dimensions} 
 transform={transform} 
 engineTick={engineTick}
 onNavigate={(x, y) => {
 if (chartRef.current) {
 chartRef.current.centerAt(x, y, 1000);
 }
 }}
 />
 */}
 </div>
 );
}
