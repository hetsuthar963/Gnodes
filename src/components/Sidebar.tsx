import React, { useState, useMemo } from 'react';
import { FileNode } from '../utils/parser';
import { ChevronRight, ChevronDown, File, Folder, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SidebarProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFileId?: string;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: FileNode;
}

function buildTree(files: FileNode[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const existingNode = currentLevel.find(n => n.name === part);

      if (existingNode) {
        if (existingNode.children) {
          currentLevel = existingNode.children;
        }
      } else {
        const newNode: TreeNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        currentLevel.push(newNode);
        if (!isFile) {
          currentLevel = newNode.children!;
        }
      }
    }
  }

  return root;
}

function TreeItem({ node, level, onSelect, selectedId }: { node: TreeNode, level: number, onSelect: (file: FileNode) => void, selectedId?: string }) {
  const containsSelected = selectedId?.startsWith(node.path + '/');
  const [isOpen, setIsOpen] = useState(containsSelected || false);
  const isSelected = selectedId === node.file?.id;

  React.useEffect(() => {
    if (containsSelected) {
      setIsOpen(true);
    }
  }, [containsSelected]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (node.type === 'file' && node.file) {
      onSelect(node.file);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div>
      <div
        className={twMerge(
          clsx(
            "flex items-center py-1 px-2 cursor-pointer hover:bg-zinc-100 rounded-md transition-colors text-sm",
            isSelected && "bg-zinc-200 text-zinc-900 font-medium",
            containsSelected && !isSelected && "text-indigo-600"
          )
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' ? (
          <div onClick={toggleOpen} className={clsx("mr-1 hover:text-zinc-800", containsSelected ? "text-indigo-500" : "text-zinc-500")}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        ) : (
          <div className={clsx("w-4 mr-1 flex justify-center", isSelected ? "text-indigo-500" : "text-zinc-400")}>
            <File size={12} />
          </div>
        )}
        
        {node.type === 'folder' && (
          <Folder size={14} className={clsx("mr-2", containsSelected ? "text-indigo-500" : "text-zinc-500")} />
        )}
        
        <span className={clsx("truncate", 
          node.type === 'folder' ? (containsSelected ? "text-indigo-700 font-medium" : "text-zinc-700") : 
          (isSelected ? "text-zinc-900" : "text-zinc-600")
        )}>
          {node.name}
        </span>
      </div>
      
      {node.type === 'folder' && isOpen && node.children && (
        <div className="flex flex-col">
          {node.children.map((child, idx) => (
            <TreeItem key={idx} node={child} level={level + 1} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ files, onFileSelect, selectedFileId, searchQuery = '', setSearchQuery }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const tree = buildTree(files);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return files.filter(f => 
      f.name.toLowerCase().includes(query) || 
      (f.path && f.path.toLowerCase().includes(query))
    );
  }, [files, searchQuery]);

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-zinc-50 border-r border-zinc-200 flex flex-col items-center py-4 flex-shrink-0 gap-4">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
          title="Expand Sidebar"
        >
          <ChevronRight size={16} className="text-zinc-600" />
        </button>
        {setSearchQuery && (
          <button 
            onClick={() => setIsCollapsed(false)}
            className="p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
            title="Search Files"
          >
            <Search size={16} className="text-zinc-600" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-zinc-800 tracking-wide uppercase">Explorer</h2>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 bg-zinc-200 rounded-md hover:bg-zinc-300 transition-colors"
          title="Collapse Sidebar"
        >
          <ChevronRight size={14} className="rotate-180 text-zinc-600" />
        </button>
      </div>
      
      {setSearchQuery && (
        <div className="p-3 border-b border-zinc-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {searchQuery.trim() ? (
          <div className="px-2">
            <div className="text-xs font-medium text-zinc-500 mb-2 px-2 uppercase tracking-wider">Search Results</div>
            {searchResults.length === 0 ? (
              <div className="text-sm text-zinc-500 px-2">No files found</div>
            ) : (
              searchResults.map(file => (
                <div
                  key={file.id}
                  onClick={() => onFileSelect(file)}
                  className={clsx(
                    "flex items-center py-1.5 px-2 cursor-pointer hover:bg-zinc-100 rounded-md transition-colors text-sm mb-1",
                    selectedFileId === file.id && "bg-zinc-200 text-zinc-900 font-medium"
                  )}
                >
                  <File size={14} className={clsx("mr-2 flex-shrink-0", selectedFileId === file.id ? "text-indigo-500" : "text-zinc-400")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-zinc-800">{file.name}</span>
                    <span className="truncate text-xs text-zinc-500">{file.path}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          tree.map((node, idx) => (
            <TreeItem key={idx} node={node} level={0} onSelect={onFileSelect} selectedId={selectedFileId} />
          ))
        )}
      </div>
    </div>
  );
}
