import React, { useState, useEffect } from 'react';
import { fetchRepoTree, fetchFileContent, GitHubFile } from './utils/github';
import { buildGraphData, GraphData, FileNode } from './utils/parser';
import GraphView from './components/GraphView';
import FileViewer from './components/FileViewer';
import Sidebar from './components/Sidebar';
import TaxonomySidebar, { GraphConfig } from './components/TaxonomySidebar';
import { Github, Key, Search, Loader2, AlertCircle, Columns, Maximize2, FileCode2, Sun, Moon } from 'lucide-react';

export default function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'graph' | 'file'>('graph');
  const [graphConfig, setGraphConfig] = useState<GraphConfig>({
    model: 'dependency',
    metric: 'none',
    encoding: 'force'
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
      
      // Filter out non-code files to keep graph manageable
      const codeFiles = tree.filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase();
        // Exclude json, md, html, css if they are causing issues, or just keep them but ignore errors
        return ['js', 'jsx', 'ts', 'tsx', 'py', 'go'].includes(ext || '');
      });

      // Fetch contents in parallel (with a limit to avoid rate limits)
      const BATCH_SIZE = 10;
      const filesWithContent: { path: string, content?: string }[] = [];
      
      setProgress({ current: 0, total: codeFiles.length });
      
      for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
        const batch = codeFiles.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (file) => {
          try {
            const content = await fetchFileContent(owner, repo, file.path, defaultBranch, pat);
            return { path: file.path, content };
          } catch (e) {
            // Silently ignore fetch errors for individual files to prevent console spam
            return { path: file.path };
          }
        });
        const results = await Promise.all(promises);
        filesWithContent.push(...results);
        setProgress({ current: Math.min(i + BATCH_SIZE, codeFiles.length), total: codeFiles.length });
      }

      const data = buildGraphData(filesWithContent);
      setGraphData(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the repository');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-700 dark:text-zinc-300 font-sans overflow-hidden transition-colors">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#121212] border-b border-zinc-200 dark:border-white/5 shadow-sm z-10 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Github className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">RepoGraph</h1>
        </div>
        
        <div className="flex items-center space-x-4 flex-1 max-w-3xl ml-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            />
          </div>
          <div className="relative w-64">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="password"
              placeholder="Personal Access Token (Optional)"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
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
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {graphData && (
            <div className="flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-white/5">
              <button
                onClick={() => setViewMode('graph')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'graph' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                title="Graph View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'split' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                title="Split View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('file')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'file' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                title="File View"
              >
                <FileCode2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg shadow-lg backdrop-blur-sm">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {!graphData && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <div className="w-24 h-24 mb-6 rounded-full bg-zinc-200 dark:bg-zinc-800/50 flex items-center justify-center border border-zinc-300 dark:border-white/5">
              <Github className="w-10 h-10 opacity-50" />
            </div>
            <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-300 mb-2">Enter a GitHub repository URL</h2>
            <p className="max-w-md text-center text-sm leading-relaxed">
              RepoGraph will clone the repository, parse the code files, and generate an interactive dependency graph similar to Obsidian.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm font-medium animate-pulse">Cloning and analyzing repository...</p>
            {progress && (
              <div className="mt-6 w-64">
                <div className="flex justify-between text-xs mb-1 text-zinc-500 dark:text-zinc-400">
                  <span>Fetching files</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-xs mt-4 opacity-60">This might take a minute for large repositories.</p>
          </div>
        )}

        {graphData && (
          <>
            {viewMode !== 'graph' && (
              <Sidebar 
                files={graphData.nodes} 
                onFileSelect={setSelectedNode} 
                selectedFileId={selectedNode?.id} 
              />
            )}
            
            <div className="flex-1 flex p-4 gap-4 overflow-hidden bg-zinc-50 dark:bg-[#0a0a0a] transition-colors">
              {viewMode !== 'file' && (
                <div className={`transition-all duration-300 h-full ${viewMode === 'graph' ? 'w-full' : 'flex-1'}`}>
                  <GraphView 
                    data={graphData} 
                    commits={commits}
                    contributors={contributors}
                    onNodeClick={setSelectedNode} 
                    selectedNodeId={selectedNode?.id} 
                    config={graphConfig}
                    theme={theme}
                  />
                </div>
              )}
              
              {viewMode !== 'graph' && (
                <div className={`transition-all duration-300 h-full ${viewMode === 'file' ? 'w-full' : 'flex-1'}`}>
                  <FileViewer file={selectedNode} theme={theme} />
                </div>
              )}
            </div>
            
            <TaxonomySidebar config={graphConfig} setConfig={setGraphConfig} />
          </>
        )}
      </main>
    </div>
  );
}
