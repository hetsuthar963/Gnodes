export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: string;
  content?: string;
  val: number; // node size
}

export interface FileLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: FileNode[];
  links: FileLink[];
}

export function parseDependencies(content: string, filePath: string, allFiles: string[]): string[] {
  const dependencies: string[] = [];
  const ext = filePath.split('.').pop()?.toLowerCase();

  const addDependency = (depPath: string) => {
    if (!depPath) return;

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
      if (allFiles.includes(p)) {
        dependencies.push(p);
        found = true;
        break;
      }
    }

    // 2. If not found, try fuzzy matching (e.g., matching the end of the path)
    // This helps with aliases like `components/Button` matching `src/components/Button.tsx`
    if (!found) {
      // Create a suffix to match against
      const suffix = '/' + resolvedPath.replace(/^[@~]\//, '');
      
      for (const file of allFiles) {
        for (const ext of extensions) {
          if (file.endsWith(suffix + ext) || file === resolvedPath + ext) {
            dependencies.push(file);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  };

  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
    // Remove comments to avoid false positives
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // Match import ... from '...' or export ... from '...'
    const importFromRegex = /(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importFromRegex.exec(cleanContent)) !== null) {
      addDependency(match[1]);
    }
    
    // Match import '...'
    const importSideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = importSideEffectRegex.exec(cleanContent)) !== null) {
      addDependency(match[1]);
    }
    
    // Match require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(cleanContent)) !== null) {
      addDependency(match[1]);
    }
    
    // Match import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(cleanContent)) !== null) {
      addDependency(match[1]);
    }
  } else if (ext === 'py') {
    const cleanContent = content.replace(/#.*$/gm, '');
    
    // Match import a, b, c
    const importRegex = /^import\s+(.+)$/gm;
    let match;
    while ((match = importRegex.exec(cleanContent)) !== null) {
      const modules = match[1].split(',').map(m => m.trim().split(/\s+/)[0]);
      for (const mod of modules) {
        if (mod) addDependency(mod.replace(/\./g, '/'));
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
      addDependency(modPath);
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
          addDependency(strMatch[1]);
        }
      } else if (match[2]) {
        addDependency(match[2]);
      }
    }
  } else if (ext === 'rs') {
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const useRegex = /use\s+([^;]+);/g;
    let match;
    while ((match = useRegex.exec(cleanContent)) !== null) {
      const modPath = match[1].replace(/\{.*?\}/g, '').replace(/\s/g, '').replace(/::/g, '/');
      addDependency(modPath);
    }
  }

  return [...new Set(dependencies)]; // Unique dependencies
}

export function buildGraphData(files: { path: string, content?: string }[]): GraphData {
  const nodes: FileNode[] = [];
  const links: FileLink[] = [];
  const allPaths = files.map(f => f.path);

  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
    
    // Base size based on file length (logarithmic to prevent massive nodes)
    const contentLength = file.content ? file.content.length : 0;
    const lengthScore = Math.max(1, Math.log10(contentLength + 1));

    nodes.push({
      id: file.path,
      name: file.path.split('/').pop() || file.path,
      path: file.path,
      type: ext,
      content: file.content,
      val: lengthScore, // Initial size based on length
    });

    inDegree[file.path] = 0;
    outDegree[file.path] = 0;

    if (file.content) {
      const deps = parseDependencies(file.content, file.path, allPaths);
      for (const dep of deps) {
        links.push({
          source: file.path,
          target: dep,
        });
        outDegree[file.path] = (outDegree[file.path] || 0) + 1;
        inDegree[dep] = (inDegree[dep] || 0) + 1;
      }
    }
  }

  // Calculate final node sizes based on length AND interconnectedness
  for (const node of nodes) {
    const totalConnections = (inDegree[node.id] || 0) + (outDegree[node.id] || 0);
    // Add connection score (each connection adds to the size, scaled down)
    node.val += (totalConnections * 1.5);
    
    // Ensure a minimum and maximum size for rendering sanity
    node.val = Math.max(2, Math.min(node.val, 50));
  }

  return { nodes, links };
}
