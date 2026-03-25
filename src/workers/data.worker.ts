// src/workers/data.worker.ts
import { GraphData, detectCycles, FileNode, FileLink } from '../utils/parser';
import { extractRawDependencies, resolveDependencies } from '../utils/parser';
import * as TreeSitter from 'web-tree-sitter';
import treeSitterWasm from 'web-tree-sitter/web-tree-sitter.wasm?url';
import jsWasm from '@repomix/tree-sitter-wasms/out/tree-sitter-javascript.wasm?url';
import tsWasm from '@repomix/tree-sitter-wasms/out/tree-sitter-typescript.wasm?url';
import tsxWasm from '@repomix/tree-sitter-wasms/out/tree-sitter-tsx.wasm?url';

let parserInitialized = false;
let jsLang: TreeSitter.Language | null = null;
let tsLang: TreeSitter.Language | null = null;
let tsxLang: TreeSitter.Language | null = null;

// Process pool for parsers
const parserPool: TreeSitter.Parser[] = [];
const MAX_PARSERS = 4;

async function loadLanguage(url: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return TreeSitter.Language.load(new Uint8Array(buffer));
}

async function initTreeSitter() {
  if (parserInitialized) return;
  
  await TreeSitter.Parser.init({
    locateFile(scriptName: string) {
      if (scriptName === 'web-tree-sitter.wasm' || scriptName === 'tree-sitter.wasm') {
        return treeSitterWasm;
      }
      return scriptName;
    }
  });

  [jsLang, tsLang, tsxLang] = await Promise.all([
    loadLanguage(jsWasm),
    loadLanguage(tsWasm),
    loadLanguage(tsxWasm)
  ]);

  for (let i = 0; i < MAX_PARSERS; i++) {
    parserPool.push(new TreeSitter.Parser());
  }
  parserInitialized = true;
}

// Simple string hash function
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Cache for expensive parsing operations
const parseCache = new Map<string, {
  contentHash: number;
  linesOfCode: number;
  complexity: number;
  physics: any;
  deps: { path: string, type: string }[];
}>();

function calculateComplexity(content: string): number {
  const controlFlowKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||', '?', ':'];
  let complexity = 1;
  for (const keyword of controlFlowKeywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = content.match(regex);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function extractPhysicsLogic(content: string) {
  const result = {
    state_management: 0,
    side_effects: 0,
    data_flow: 0,
    computation: 0
  };

  const stateRegex = /\b(useState|useReducer|useRef|useContext|useMemo|useCallback|createStore|configureStore|createSlice|createReducer)\b/g;
  result.state_management = (content.match(stateRegex) || []).length;

  const effectRegex = /\b(useEffect|useLayoutEffect|componentDidMount|document|window|element|localStorage|sessionStorage|indexedDB|setItem|getItem|setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/g;
  result.side_effects = (content.match(effectRegex) || []).length;

  const dataRegex = /\b(fetch|axios|http|api|handle[A-Z]\w*|on[A-Z]\w*|set[A-Z]\w*)\b/g;
  result.data_flow = (content.match(dataRegex) || []).length;

  const compWordRegex = /\b(compute|calculate|transform|reduce|map|filter|process|forEach|sort|flatMap)\b/g;
  const compOpRegex = /(\+|\-|\*|\/|\%|\>|\<|\>\=|\<\=|\=\=|\=\=\=)/g;
  result.computation = (content.match(compWordRegex) || []).length + (content.match(compOpRegex) || []).length;

  return result;
}

async function parseWithTreeSitter(content: string, ext: string, parserIndex: number): Promise<{ deps: { path: string, type: string }[], complexity: number }> {
  const parser = parserPool[parserIndex];
  let lang: TreeSitter.Language | null = null;
  
  if (ext === 'js' || ext === 'jsx') lang = jsLang;
  else if (ext === 'ts') lang = tsLang;
  else if (ext === 'tsx') lang = tsxLang;

  if (!lang) {
    // Fallback to regex if language not supported by tree-sitter
    return {
      deps: extractRawDependencies(content, `dummy.${ext}`),
      complexity: calculateComplexity(content)
    };
  }

  parser.setLanguage(lang);
  const tree = parser.parse(content);
  
  const deps: { path: string, type: string }[] = [];
  let complexity = 1;

  // A simple traversal to find imports/requires and control flow
  function traverse(node: TreeSitter.Node) {
    const type = node.type;
    
    // Control flow for complexity
    if (['if_statement', 'for_statement', 'while_statement', 'switch_statement', 'catch_clause', 'ternary_expression', '&&', '||'].includes(type)) {
      complexity++;
    }

    // Dependencies
    if (type === 'import_statement' || type === 'export_statement') {
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        const text = sourceNode.text;
        if (text.length >= 2) {
          deps.push({ path: text.slice(1, -1), type: 'static' }); // Remove quotes
        }
      }
    } else if (type === 'call_expression') {
      const funcNode = node.childForFieldName('function');
      if (funcNode) {
        const funcText = funcNode.text;
        if (funcText === 'require' || funcText === 'import') {
          const argsNode = node.childForFieldName('arguments');
          if (argsNode && argsNode.namedChildCount > 0) {
            const arg = argsNode.namedChild(0);
            if (arg && arg.type === 'string') {
              const text = arg.text;
              if (text.length >= 2) {
                deps.push({ path: text.slice(1, -1), type: funcText === 'require' ? 'require' : 'dynamic' });
              }
            }
          }
        }
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) traverse(child);
    }
  }

  traverse(tree.rootNode);
  tree.delete();

  // Unique by path
  const seen = new Set();
  const uniqueDeps = deps.filter(d => {
    if (seen.has(d.path)) return false;
    seen.add(d.path);
    return true;
  });

  return { deps: uniqueDeps, complexity };
}

async function buildGraphDataAsync(files: { path: string, content?: string, size?: number }[]): Promise<GraphData> {
  const nodes: FileNode[] = [];
  const links: FileLink[] = [];
  const allPaths = files.map(f => f.path);
  const allPathsSet = new Set(allPaths);

  const fileIndex = new Map<string, string[]>();
  for (const path of allPaths) {
    const fileName = path.split('/').pop() || '';
    const nameWithoutExt = fileName.split('.').slice(0, -1).join('.');
    
    if (!fileIndex.has(fileName)) fileIndex.set(fileName, []);
    fileIndex.get(fileName)!.push(path);
    
    if (nameWithoutExt && nameWithoutExt !== fileName) {
      if (!fileIndex.has(nameWithoutExt)) fileIndex.set(nameWithoutExt, []);
      fileIndex.get(nameWithoutExt)!.push(path);
    }
  }

  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};

  // Process files concurrently using the parser pool
  const processPromises = files.map(async (file, index) => {
    const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
    const content = file.content || '';
    
    let linesOfCode = 0;
    let complexity = 1;
    let physics = { state_management: 0, side_effects: 0, data_flow: 0, computation: 0 };
    let rawDeps: { path: string, type: string }[] = [];

    if (content) {
      const hash = hashCode(content);
      const cached = parseCache.get(file.path);
      
      if (cached && cached.contentHash === hash) {
        linesOfCode = cached.linesOfCode;
        complexity = cached.complexity;
        physics = cached.physics;
        rawDeps = cached.deps;
      } else {
        linesOfCode = content.split('\n').filter(l => l.trim().length > 0).length;
        physics = extractPhysicsLogic(content);
        
        if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
          const parserIndex = index % MAX_PARSERS;
          const result = await parseWithTreeSitter(content, ext, parserIndex);
          rawDeps = result.deps;
          complexity = result.complexity;
        } else {
          complexity = calculateComplexity(content);
          rawDeps = extractRawDependencies(content, file.path);
        }
        
        parseCache.set(file.path, {
          contentHash: hash,
          linesOfCode,
          complexity,
          physics,
          deps: rawDeps
        });
      }
    }
    
    return { file, ext, content, linesOfCode, complexity, physics, rawDeps };
  });

  const processedFiles = await Promise.all(processPromises);

  for (const { file, ext, content, linesOfCode, complexity, physics, rawDeps } of processedFiles) {
    let deps: { path: string, type: string }[] = [];
    if (content) {
      deps = resolveDependencies(rawDeps, file.path, allPaths, fileIndex, allPathsSet);
    }

    nodes.push({
      id: file.path,
      name: file.path.split('/').pop() || file.path,
      path: file.path,
      type: ext,
      content: file.content,
      val: 0,
      size: file.size,
      metrics: {
        complexity,
        linesOfCode,
      },
      physics,
    });

    inDegree[file.path] = 0;
    outDegree[file.path] = 0;

    if (content) {
      for (const dep of deps) {
        if (dep.path === file.path) continue;
        links.push({
          source: file.path,
          target: dep.path,
          type: dep.type,
        });
        outDegree[file.path] = (outDegree[file.path] || 0) + 1;
        inDegree[dep.path] = (inDegree[dep.path] || 0) + 1;
      }
    }
  }

  for (const node of nodes) {
    const contentScore = Math.log10((node.metrics?.linesOfCode || 0) + 1) * 2;
    const connectivityScore = ((inDegree[node.id] || 0) * 2) + ((outDegree[node.id] || 0) * 0.5);
    const complexityScore = Math.log10((node.metrics?.complexity || 0) + 1) * 1.5;
    node.val = contentScore + connectivityScore + complexityScore;
    node.val = Math.max(3, Math.min(node.val, 60));
  }

  return { nodes, links };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'BUILD_GRAPH') {
    try {
      await initTreeSitter();
      
      // Override the extractRawDependencies in parser.ts or pass the parser down
      // Since buildGraphData is synchronous in parser.ts, we need to handle parsing here
      // Or we can modify parser.ts to be async.
      // Wait, buildGraphData is currently synchronous. We should make it async if we want to use Tree-sitter.
      
      const graphData = await buildGraphDataAsync(payload);
      self.postMessage({ type: 'GRAPH_BUILT', payload: graphData });
    } catch (error) {
      console.error('Worker Error in BUILD_GRAPH:', error);
      self.postMessage({ 
        type: 'ERROR', 
        payload: `Graph building failed: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}` 
      });
    }
    return;
  }

  // Legacy handler for computeDisplayData
  const { data, config, commits, contributors } = e.data;
  if (data && config) {
    try {
      const displayData = computeDisplayData(data, config, commits, contributors);
      const degrees = computeDegrees(displayData);
      const cycles = detectCycles(displayData);

      self.postMessage({ displayData, degrees, cycles });
    } catch (error) {
      console.error('Worker Error in computeDisplayData:', error);
      self.postMessage({ 
        type: 'ERROR', 
        payload: `Display data computation failed: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }
};

// ... rest of the file


function computeDisplayData(data: GraphData, config: any, commits: any[], contributors: any[]): GraphData {
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
          if (parent) links.push({ source: parent, target: currentPath });
        }
      }
      const dir = parts.slice(0, -1).join('/');
      if (dir) links.push({ source: dir, target: n.id });
    });
    return { nodes, links };
  }

  // ... (Add other model logic here)

  return data;
}

function computeDegrees(displayData: GraphData): Map<string, number> {
  const deg = new Map<string, number>();
  displayData.nodes.forEach(n => deg.set(n.id, 0));
  displayData.links.forEach((l: any) => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    deg.set(src, (deg.get(src) || 0) + 1);
    deg.set(tgt, (deg.get(tgt) || 0) + 1);
  });
  return deg;
}
