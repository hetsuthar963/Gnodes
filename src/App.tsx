import React, { useState, useEffect, useRef } from 'react';
import DataWorker from './workers/data.worker?worker';
import { fetchRepoTree, fetchFileContent, GitHubFile } from './utils/github';
import { buildGraphData, GraphData, FileNode } from './utils/parser';
import GraphView from './components/GraphView';
import FileViewer from './components/FileViewer';
import TaxonomySidebar, { GraphConfig } from './components/TaxonomySidebar';
import Sidebar from './components/Sidebar';
import AIAssistant from './components/AIAssistant';
import { Github, Key, Search, Loader2, AlertCircle, Columns, Maximize2, FileCode2, Sparkles } from 'lucide-react';

export default function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; status?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'graph' | 'file' | 'chat'>('graph');
  const [graphConfig, setGraphConfig] = useState<GraphConfig>({
    model: 'dependency',
    metric: 'none',
    encoding: 'force'
  });
  const [stats, setStats] = useState<any>(null);
  const [highlightString, setHighlightString] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new DataWorker();
    workerRef.current = worker;
    return () => {
      worker.terminate();
    };
  }, []);

  const buildGraphDataAsync = (files: any[]): Promise<GraphData> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        resolve(buildGraphData(files));
        return;
      }
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'GRAPH_BUILT') {
          workerRef.current?.removeEventListener('message', handleMessage);
          resolve(e.data.payload);
        } else if (e.data.type === 'ERROR') {
          workerRef.current?.removeEventListener('message', handleMessage);
          reject(new Error(e.data.payload));
        }
      };
      
      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.postMessage({ type: 'BUILD_GRAPH', payload: files });
    });
  };

  const handleFetch = async () => {
    if (!repoUrl) return;
    
    setLoading(true);
    setProgress(null);
    setError(null);
    setGraphData(null);
    setCommits([]);
    setContributors([]);
    setSelectedNode(null);

    try {
      let owner, repo;
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        owner = match[1];
        repo = match[2];
      } else {
        const parts = repoUrl.split('/');
        if (parts.length === 2) {
          owner = parts[0];
          repo = parts[1];
        } else {
          throw new Error('Invalid GitHub repository URL. Use format: owner/repo or https://github.com/owner/repo');
        }
      }

      // Fetch commits and contributors in parallel with tree
      const [treeData, commitsData, contributorsData] = await Promise.all([
        fetchRepoTree(owner, repo, pat),
        import('./utils/github').then(m => m.fetchCommits(owner, repo, pat).catch(() => [])),
        import('./utils/github').then(m => m.fetchContributors(owner, repo, pat).catch(() => []))
      ]);
      
      const tree = treeData.tree;
      const defaultBranch = treeData.defaultBranch;

      setCommits(commitsData);
      setContributors(contributorsData);
      
      // 1. All files should be in the graph nodes to avoid "missing data"
      // 2. But only fetch content for code files to keep it fast
      const allFiles = tree.filter(f => {
        const pathParts = f.path.split('/');
        return !pathParts.includes('node_modules') && !pathParts.includes('.git');
      });

      const codeFiles = allFiles.filter(f => {
        const pathParts = f.path.split('/');
        if (
          pathParts.includes('dist') || 
          pathParts.includes('build') ||
          pathParts.includes('__tests__') || 
          f.path.includes('.test.') || 
          f.path.includes('.spec.')
        ) {
          return false;
        }
        const ext = f.path.split('.').pop()?.toLowerCase();
        const excludedExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite', 'sqlite3', 'woff', 'woff2', 'ttf', 'eot', 'otf'];
        return !excludedExts.includes(ext || '');
      });

      // Fetch contents in parallel (with a limit to avoid rate limits)
      const BATCH_SIZE = 50; 
      const filesWithContent: { path: string, content?: string, size?: number }[] = [];
      
      // Initialize with all files (no content yet)
      const initialFiles = allFiles.map(f => ({ path: f.path, size: f.size }));
      filesWithContent.push(...initialFiles);
      
      setProgress({ current: 0, total: codeFiles.length, status: 'Initializing Graph...' });
      
      // Initial graph build with all files (no links yet as no content)
      let currentGraphData = await buildGraphDataAsync(filesWithContent);
      setGraphData(currentGraphData);
      
      for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
        setProgress({ current: i, total: codeFiles.length, status: `Analyzing code batch ${Math.floor(i/BATCH_SIZE) + 1}...` });
        
        const batch = codeFiles.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (file) => {
          try {
            const content = await fetchFileContent(owner, repo, file.path, defaultBranch, pat);
            return { path: file.path, content, size: file.size };
          } catch (e) {
            return { path: file.path, size: file.size };
          }
        });
        const results = await Promise.all(promises);
        
        // Update the filesWithContent array with the new content
        results.forEach(res => {
          const idx = filesWithContent.findIndex(f => f.path === res.path);
          if (idx !== -1) {
            filesWithContent[idx] = res;
          }
        });
        
        setProgress({ current: Math.min(i + BATCH_SIZE, codeFiles.length), total: codeFiles.length, status: 'Updating Dependencies...' });
        
        // Incremental update - build graph as we go
        currentGraphData = await buildGraphDataAsync(filesWithContent);
        setGraphData(currentGraphData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the repository');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-zinc-700 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Github className="w-6 h-6 text-indigo-500" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">RepoGraph</h1>
        </div>
        
        <div className="flex items-center space-x-4 flex-1 max-w-3xl ml-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            />
          </div>
          <div className="relative w-64">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="password"
              placeholder="Personal Access Token (Optional)"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading || !repoUrl}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading ? 'Analyzing...' : 'Generate Graph'}
          </button>
        </div>
        
        <div className="flex items-center space-x-4 ml-4">
          {graphData && (
            <div className="flex items-center space-x-2 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={() => setViewMode('graph')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'graph' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title="Graph View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'split' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title="Split View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('file')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'file' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title="File View"
              >
                <FileCode2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('chat')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'chat' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title="AI Architect"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-lg shadow-lg backdrop-blur-sm">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {!graphData && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <div className="w-24 h-24 mb-6 rounded-full bg-zinc-200 flex items-center justify-center border border-zinc-300">
              <Github className="w-10 h-10 opacity-50" />
            </div>
            <h2 className="text-xl font-medium text-zinc-900 mb-2">Enter a GitHub repository URL</h2>
            <p className="max-w-md text-center text-sm leading-relaxed">
              RepoGraph will clone the repository, parse the code files, and generate an interactive dependency graph.
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-zinc-200 flex flex-col items-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
              <p className="text-sm font-medium text-zinc-900">Cloning and analyzing repository...</p>
              {progress && (
                <div className="mt-6 w-64">
                  <div className="flex justify-between text-xs mb-1 text-zinc-500">
                    <span>{progress.status || 'Fetching files'}</span>
                    <span>{progress.current} / {progress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs mt-4 text-zinc-500">This might take a minute for large repositories.</p>
            </div>
          </div>
        )}

        {graphData && (
          <>
            {viewMode !== 'chat' && viewMode !== 'file' && (
              <TaxonomySidebar config={graphConfig} setConfig={setGraphConfig} stats={stats} />
            )}
            {(viewMode === 'split' || viewMode === 'file') && (
              <Sidebar 
                files={graphData.nodes}
                onFileSelect={(node) => {
                  setSelectedNode(node);
                  setHighlightString(null);
                }}
                selectedFileId={selectedNode?.id}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            <div className={`flex-1 flex overflow-hidden bg-white ${viewMode === 'graph' ? 'p-0 gap-0' : 'p-4 gap-4'}`}>
              {viewMode === 'chat' ? (
                <div className="flex-1 h-full">
                  <AIAssistant graphData={graphData} repoUrl={repoUrl} />
                </div>
              ) : (
                <>
                  {viewMode !== 'file' && (
                    <div className="transition-all duration-300 h-full flex-1 min-w-0">
                      <GraphView 
                        data={graphData} 
                          commits={commits}
                          contributors={contributors}
                          searchQuery={searchQuery}
                          onConfigChange={setGraphConfig}
                          onNodeClick={(node) => {
                            setSelectedNode(node);
                            setHighlightString(null);
                            if (node) {
                              setViewMode('split');
                            }
                          }} 
                          onLinkClick={(link) => {
                            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                            const sourceNode = graphData.nodes.find(n => n.id === sourceId);
                            const targetNode = graphData.nodes.find(n => n.id === targetId);
                            if (sourceNode && targetNode) {
                              setSelectedNode(sourceNode);
                              const targetName = targetNode.name.split('.')[0];
                              setHighlightString(targetName);
                              setViewMode('split');
                            }
                          }}
                          selectedNodeId={selectedNode?.id} 
                          config={graphConfig}
                          onStatsChange={setStats}
                          viewMode={viewMode}
                        />
                      </div>
                    )}
                    
                    {viewMode !== 'graph' && (
                      <div className="transition-all duration-300 h-full flex-1 min-w-0">
                        <FileViewer file={selectedNode} highlightString={highlightString} stats={stats} />
                      </div>
                    )}
                </>
              )}
            </div>
            
          </>
        )}
      </main>
    </div>
  );
}
