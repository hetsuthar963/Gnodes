import React, { useState } from 'react';
import { GitCommit, Users, FolderTree, Layers, Database, LayoutTemplate, BarChart2, Target, AlertTriangle, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

export type GraphConfig = {
  model: 'dependency' | 'tree' | 'commit-linear' | 'commit-branch' | 'commit-merge' | 'contributor-activity' | 'contributor-collab' | 'raw-text' | 'token' | 'ast' | 'cfg' | 'dfg' | 'pdg' | 'call' | 'git-dag' | 'commit-file' | 'cpg' | 'knowledge';
  metric: 'none' | 'centrality' | 'cluster';
  encoding: 'force' | 'dag-td' | 'dag-lr' | 'radial' | 'circular';
};

interface Props {
  config: GraphConfig;
  setConfig: (config: GraphConfig) => void;
  stats?: any;
}

export default function TaxonomySidebar({ config, setConfig, stats }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const updateConfig = (updates: Partial<GraphConfig>) => setConfig({ ...config, ...updates });

  type Option = { label: string; active: boolean; onClick: () => void; disabled?: boolean };
  type Section = { title: string; icon: React.ReactNode; options: Option[] };

  const sections: Section[] = [
    {
      title: "1. Commit Graphs",
      icon: <GitCommit size={16} />,
      options: [
        { label: "Linear Commit Timeline", active: config.model === 'commit-linear', onClick: () => updateConfig({ model: 'commit-linear', encoding: 'dag-lr' }) },
        { label: "Branching Tree", active: config.model === 'commit-branch', onClick: () => updateConfig({ model: 'commit-branch', encoding: 'dag-td' }) },
        { label: "Merge Graph", active: config.model === 'commit-merge', onClick: () => updateConfig({ model: 'commit-merge', encoding: 'force' }) },
      ]
    },
    {
      title: "2. Contributor Graphs",
      icon: <Users size={16} />,
      options: [
        { label: "Activity Over Time", active: config.model === 'contributor-activity', onClick: () => updateConfig({ model: 'contributor-activity', encoding: 'force' }) },
        { label: "Collaboration Network", active: config.model === 'contributor-collab', onClick: () => updateConfig({ model: 'contributor-collab', encoding: 'force' }) },
      ]
    },
    {
      title: "3. File / Code Structure",
      icon: <FolderTree size={16} />,
      options: [
        { label: "Directory Tree Graph", active: config.model === 'tree', onClick: () => updateConfig({ model: 'tree' }) },
      ]
    },
    {
      title: "4. Advanced Features",
      icon: <Database size={16} />,
      options: [
        { label: "Layer 1: Raw Text Graph", active: config.model === 'raw-text', onClick: () => updateConfig({ model: 'raw-text' }) },
        { label: "Layer 2: Dependency Graph", active: config.model === 'dependency', onClick: () => updateConfig({ model: 'dependency' }) },
        { label: "Layer 3: Git DAG", active: config.model === 'git-dag', onClick: () => updateConfig({ model: 'git-dag' }) },
        { label: "Layer 4: Commit-File Graph", active: config.model === 'commit-file', onClick: () => updateConfig({ model: 'commit-file' }) },
      ]
    },
    {
      title: "5. Visual Encodings",
      icon: <LayoutTemplate size={16} />,
      options: [
        { label: "Force-Directed", active: config.encoding === 'force', onClick: () => updateConfig({ encoding: 'force' }) },
        { label: "Hierarchical (Top-Down)", active: config.encoding === 'dag-td', onClick: () => updateConfig({ encoding: 'dag-td' }) },
        { label: "Hierarchical (Left-Right)", active: config.encoding === 'dag-lr', onClick: () => updateConfig({ encoding: 'dag-lr' }) },
        { label: "Radial Tree", active: config.encoding === 'radial', onClick: () => updateConfig({ encoding: 'radial' }) },
        { label: "Circular Layout", active: config.encoding === 'circular', onClick: () => updateConfig({ encoding: 'circular' }) },
      ]
    }
  ];

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white dark:bg-[#121212] border-l border-zinc-200 dark:border-white/5 flex flex-col items-center py-4 flex-shrink-0 transition-colors">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Expand Sidebar"
        >
          <ChevronLeft size={16} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-white dark:bg-[#121212] border-l border-zinc-200 dark:border-white/5 flex flex-col overflow-hidden flex-shrink-0 transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b] transition-colors flex justify-between items-center">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tracking-wide uppercase flex items-center gap-2">
          <Layers size={16} className="text-indigo-500 dark:text-indigo-400" />
          Graph Taxonomy
        </h2>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          title="Collapse Sidebar"
        >
          <ChevronRight size={14} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {stats && (
          <div className="space-y-4">
            <button 
              onClick={() => setIsInsightsOpen(!isInsightsOpen)}
              className="w-full flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-indigo-500 dark:text-indigo-400" />
                Repo Insights
              </div>
              {isInsightsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {isInsightsOpen && (
              <div className="space-y-4 pt-2">
                {/* Overview */}
                <div>
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
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center">
                    <Target className="w-3.5 h-3.5 mr-1.5" /> Key Hubs (Most Imported)
                  </h3>
                  <div className="space-y-2">
                    {stats.topDependencies.map((node: any) => (
                      <div key={node.id} className="flex items-center justify-between bg-zinc-50 dark:bg-black/20 p-2 rounded border border-zinc-100 dark:border-white/5 transition-colors">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-2">{node.name}</span>
                        <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{stats.inDegree[node.id]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anomalies / Alerts */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center">
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
        )}

        {sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              {section.icon}
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.options.map((opt, oIdx) => (
                <button
                  key={oIdx}
                  onClick={opt.onClick}
                  disabled={opt.disabled}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between",
                    opt.disabled 
                      ? "opacity-50 cursor-not-allowed text-zinc-400 dark:text-zinc-600" 
                      : opt.active
                        ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-500/30"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                  title={opt.disabled ? "Requires full Git history / API integration" : ""}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.disabled && <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">WIP</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
