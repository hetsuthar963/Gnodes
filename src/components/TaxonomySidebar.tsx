import React from 'react';
import { GitCommit, Users, FolderTree, Layers, Database, LayoutTemplate } from 'lucide-react';
import { clsx } from 'clsx';

export type GraphConfig = {
  model: 'dependency' | 'tree' | 'commit-linear' | 'commit-branch' | 'commit-merge' | 'contributor-activity' | 'contributor-collab' | 'contributor-bus' | 'raw-text' | 'token' | 'ast' | 'cfg' | 'dfg' | 'pdg' | 'call' | 'git-dag' | 'commit-file' | 'cpg' | 'knowledge';
  metric: 'none' | 'centrality' | 'cluster';
  encoding: 'force' | 'dag-td' | 'dag-lr' | 'radial' | 'circular';
};

interface Props {
  config: GraphConfig;
  setConfig: (config: GraphConfig) => void;
}

export default function TaxonomySidebar({ config, setConfig }: Props) {
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
        { label: "Bus Factor Graph", active: config.model === 'contributor-bus', onClick: () => updateConfig({ model: 'contributor-bus', encoding: 'circular' }) },
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
      title: "Advanced Features",
      icon: <Database size={16} />,
      options: [
        { label: "Layer 1: Raw Text Graph", active: config.model === 'raw-text', onClick: () => updateConfig({ model: 'raw-text' }) },
        { label: "Layer 8: Dependency Graph", active: config.model === 'dependency', onClick: () => updateConfig({ model: 'dependency' }) },
        { label: "Layer 9: Git DAG", active: config.model === 'git-dag', onClick: () => updateConfig({ model: 'git-dag' }) },
        { label: "Layer 10: Commit-File Graph", active: config.model === 'commit-file', onClick: () => updateConfig({ model: 'commit-file' }) },
      ]
    },
    {
      title: "Visual Encodings",
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

  return (
    <div className="w-72 h-full bg-white dark:bg-[#121212] border-l border-zinc-200 dark:border-white/5 flex flex-col overflow-hidden flex-shrink-0 transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b] transition-colors">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tracking-wide uppercase flex items-center gap-2">
          <Layers size={16} className="text-indigo-500 dark:text-indigo-400" />
          Graph Taxonomy
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
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
