export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: string;
  content?: string;
  val: number; // node size
  size?: number; // file size in bytes
  metrics?: {
    complexity: number;
    linesOfCode: number;
  };
  physics?: {
    state_management: number;
    side_effects: number;
    data_flow: number;
    computation: number;
  };
}

export interface FileLink {
  source: string;
  target: string;
  type?: string;
}

export interface GraphData {
  nodes: FileNode[];
  links: FileLink[];
}

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

  // 1. State Management
  const stateRegex = /\b(useState|useReducer|useRef|useContext|useMemo|useCallback|createStore|configureStore|createSlice|createReducer)\b/g;
  result.state_management = (content.match(stateRegex) || []).length;

  // 2. Side Effects
  const effectRegex = /\b(useEffect|useLayoutEffect|componentDidMount|document|window|element|localStorage|sessionStorage|indexedDB|setItem|getItem|setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/g;
  result.side_effects = (content.match(effectRegex) || []).length;

  // 3. Data Flow
  const dataRegex = /\b(fetch|axios|http|api|handle[A-Z]\w*|on[A-Z]\w*|set[A-Z]\w*)\b/g;
  result.data_flow = (content.match(dataRegex) || []).length;

  // 4. Computation
  const compWordRegex = /\b(compute|calculate|transform|reduce|map|filter|process|forEach|sort|flatMap)\b/g;
  const compOpRegex = /(\+|\-|\*|\/|\%|\>|\<|\>\=|\<\=|\=\=|\=\=\=)/g;
  result.computation = (content.match(compWordRegex) || []).length + (content.match(compOpRegex) || []).length;

  return result;
}

export function extractRawDependencies(content: string, filePath: string): { path: string, type: string }[] {
  const dependencies: { path: string, type: string }[] = [];
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
    // Remove comments to avoid false positives
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // Match import ... from '...' or export ... from '...'
    const importFromRegex = /(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importFromRegex.exec(cleanContent)) !== null) {
      dependencies.push({ path: match[1], type: 'static' });
    }
    
    // Match import '...'
    const importSideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = importSideEffectRegex.exec(cleanContent)) !== null) {
      dependencies.push({ path: match[1], type: 'static' });
    }
    
    // Match require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(cleanContent)) !== null) {
      dependencies.push({ path: match[1], type: 'require' });
    }
    
    // Match import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(cleanContent)) !== null) {
      dependencies.push({ path: match[1], type: 'dynamic' });
    }
  } else if (ext === 'py') {
    const cleanContent = content.replace(/#.*$/gm, '');
    
    // Match import a, b, c
    const importRegex = /^import\s+(.+)$/gm;
    let match;
    while ((match = importRegex.exec(cleanContent)) !== null) {
      const modules = match[1].split(',').map(m => m.trim().split(/\s+/)[0]);
      for (const mod of modules) {
        if (mod) dependencies.push({ path: mod.replace(/\./g, '/'), type: 'import' });
      }
    }
    
    // Match from a.b import c
    const fromImportRegex = /^from\s+([a-zA-Z0-9_.]+)\s+import/gm;
    while ((match = fromImportRegex.exec(cleanContent)) !== null) {
      let modPath = match[1];
      if (modPath.startsWith('.')) {
        modPath = modPath.replace(/^\.+/, (m) => {
          return m.length === 1 ? './' : '../'.repeat(m.length - 1);
        });
        modPath = modPath.replace(/\./g, '/');
      } else {
        modPath = modPath.replace(/\./g, '/');
      }
      dependencies.push({ path: modPath, type: 'from-import' });
    }
  } else if (ext === 'go') {
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const importBlockRegex = /import\s+(?:\(([\s\S]*?)\)|(?:[a-zA-Z0-9_.]*\s*)?['"]([^'"]+)['"])/g;
    let match;
    while ((match = importBlockRegex.exec(cleanContent)) !== null) {
      if (match[1]) {
        const stringRegex = /['"]([^'"]+)['"]/g;
        let strMatch;
        while ((strMatch = stringRegex.exec(match[1])) !== null) {
          dependencies.push({ path: strMatch[1], type: 'import' });
        }
      } else if (match[2]) {
        dependencies.push({ path: match[2], type: 'import' });
      }
    }
  } else if (ext === 'rs') {
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const useRegex = /use\s+([^;]+);/g;
    let match;
    while ((match = useRegex.exec(cleanContent)) !== null) {
      const modPath = match[1].replace(/\{.*?\}/g, '').replace(/\s/g, '').replace(/::/g, '/');
      dependencies.push({ path: modPath, type: 'use' });
    }
  }

  // Unique dependencies by path
  const seen = new Set();
  return dependencies.filter(d => {
    if (seen.has(d.path)) return false;
    seen.add(d.path);
    return true;
  });
}

export function resolveDependencies(rawDependencies: { path: string, type: string }[], filePath: string, allFiles: string[], fileIndex?: Map<string, string[]>, allFilesSet?: Set<string>): { path: string, type: string }[] {
  const resolvedDeps: { path: string, type: string }[] = [];

  for (const dep of rawDependencies) {
    const depPath = dep.path;
    if (!depPath) continue;

    let resolvedPath = depPath;
    
    // Handle relative paths
    if (depPath.startsWith('.')) {
      const dir = filePath.split('/').slice(0, -1).join('/');
      const parts = (dir ? dir + '/' : '') + depPath;
      const resolvedParts: string[] = [];
      for (const part of parts.split('/')) {
        if (part === '..') resolvedParts.pop();
        else if (part !== '.' && part !== '') resolvedParts.push(part);
      }
      resolvedPath = resolvedParts.join('/');
    } else {
      // For absolute paths or aliases (e.g., @/utils/parser or src/utils/parser)
      resolvedPath = resolvedPath.replace(/^[@~]\//, '');
    }

    // Possible extensions to check
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '.py', '.go', '.rs', '.css', '.scss', '.json'];
    
    let found = false;

    // 1. Try exact match or exact match with extension
    for (const ext of extensions) {
      const p = resolvedPath + ext;
      if (p === filePath) continue; // Skip self-loops
      if (allFilesSet ? allFilesSet.has(p) : allFiles.includes(p)) {
        resolvedDeps.push({ path: p, type: dep.type });
        found = true;
        break;
      }
    }

    // 2. If not found, try fuzzy matching using pre-indexed file map
    if (!found && fileIndex) {
      const fileName = resolvedPath.split('/').pop() || '';
      const candidates = fileIndex.get(fileName) || [];
      
      for (const file of candidates) {
        if (file === filePath) continue; // Skip self-loops
        const suffix = '/' + resolvedPath.replace(/^[@~]\//, '');
        for (const ext of extensions) {
          if (file.endsWith(suffix + ext) || file === resolvedPath + ext) {
            resolvedDeps.push({ path: file, type: dep.type });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }

  // Unique by path
  const seen = new Set();
  return resolvedDeps.filter(d => {
    if (seen.has(d.path)) return false;
    seen.add(d.path);
    return true;
  });
}

export function detectCycles(graph: GraphData): { nodes: string[], edges: { from: string, to: string }[] }[] {
  const cycles: { nodes: string[], edges: { from: string, to: string }[] }[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const adj = new Map<string, string[]>();
  graph.links.forEach(link => {
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push(link.target);
  });

  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStart);
        const cycleEdges: { from: string, to: string }[] = [];
        for (let i = 0; i < cycleNodes.length; i++) {
          cycleEdges.push({
            from: cycleNodes[i],
            to: cycleNodes[(i + 1) % cycleNodes.length]
          });
        }
        cycles.push({ nodes: cycleNodes, edges: cycleEdges });
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  return cycles;
}

// Cache for expensive parsing operations
const parseCache = new Map<string, {
  contentHash: number;
  linesOfCode: number;
  complexity: number;
  physics: any;
  deps: { path: string, type: string }[];
}>();

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

export function buildGraphData(files: { path: string, content?: string, size?: number }[]): GraphData {
  const nodes: FileNode[] = [];
  const links: FileLink[] = [];
  const allPaths = files.map(f => f.path);
  const allPathsSet = new Set(allPaths);

  // Pre-index files by their name for faster fuzzy matching
  const fileIndex = new Map<string, string[]>();
  for (const path of allPaths) {
    const fileName = path.split('/').pop() || '';
    // Also index without extension
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

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
    const content = file.content || '';
    
    let linesOfCode = 0;
    let complexity = 1;
    let physics = { state_management: 0, side_effects: 0, data_flow: 0, computation: 0 };
    let rawDeps: { path: string, type: string }[] = [];
    let deps: { path: string, type: string }[] = [];

    if (content) {
      const hash = hashCode(content);
      const cached = parseCache.get(file.path);
      
      if (cached && cached.contentHash === hash) {
        linesOfCode = cached.linesOfCode;
        complexity = cached.complexity;
        physics = cached.physics;
        rawDeps = cached.deps; // We now cache raw dependencies
      } else {
        linesOfCode = content.split('\n').filter(l => l.trim().length > 0).length;
        complexity = calculateComplexity(content);
        physics = extractPhysicsLogic(content);
        rawDeps = extractRawDependencies(content, file.path);
        
        parseCache.set(file.path, {
          contentHash: hash,
          linesOfCode,
          complexity,
          physics,
          deps: rawDeps // Cache raw dependencies
        });
      }
      
      // Always resolve dependencies against the current set of files
      deps = resolveDependencies(rawDeps, file.path, allPaths, fileIndex, allPathsSet);
    }

    nodes.push({
      id: file.path,
      name: file.path.split('/').pop() || file.path,
      path: file.path,
      type: ext,
      content: file.content,
      val: 0, // Will be calculated after all nodes are added
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
        if (dep.path === file.path) continue; // Skip self-loops
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

  // Calculate final node sizes based on multiple strategies
  for (const node of nodes) {
    // Strategy 1: Content size (logarithmic)
    const contentScore = Math.log10((node.metrics?.linesOfCode || 0) + 1) * 2;
    
    // Strategy 2: Connectivity (degree)
    const connectivityScore = ((inDegree[node.id] || 0) * 2) + ((outDegree[node.id] || 0) * 0.5);
    
    // Strategy 3: Complexity
    const complexityScore = Math.log10((node.metrics?.complexity || 0) + 1) * 1.5;
    
    // Weighted combination
    node.val = contentScore + connectivityScore + complexityScore;
    
    // Ensure a minimum and maximum size for rendering sanity
    node.val = Math.max(3, Math.min(node.val, 60));
  }

  return { nodes, links };
}
