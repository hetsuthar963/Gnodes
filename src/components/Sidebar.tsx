import React, { useState } from 'react';
import { FileNode } from '../utils/parser';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SidebarProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFileId?: string;
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
            "flex items-center py-1 px-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md transition-colors text-sm",
            isSelected && "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium",
            containsSelected && !isSelected && "text-indigo-600 dark:text-indigo-300"
          )
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' ? (
          <div onClick={toggleOpen} className={clsx("mr-1 hover:text-zinc-800 dark:hover:text-zinc-200", containsSelected ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400")}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        ) : (
          <div className={clsx("w-4 mr-1 flex justify-center", isSelected ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500")}>
            <File size={12} />
          </div>
        )}
        
        {node.type === 'folder' && (
          <Folder size={14} className={clsx("mr-2", containsSelected ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400")} />
        )}
        
        <span className={clsx("truncate", 
          node.type === 'folder' ? (containsSelected ? "text-indigo-700 dark:text-indigo-200 font-medium" : "text-zinc-700 dark:text-zinc-300") : 
          (isSelected ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400")
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

export default function Sidebar({ files, onFileSelect, selectedFileId }: SidebarProps) {
  const tree = buildTree(files);

  return (
    <div className="w-64 h-full bg-zinc-50 dark:bg-[#18181b] border-r border-zinc-200 dark:border-white/5 flex flex-col overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-white/5 transition-colors">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tracking-wide uppercase">Explorer</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {tree.map((node, idx) => (
          <TreeItem key={idx} node={node} level={0} onSelect={onFileSelect} selectedId={selectedFileId} />
        ))}
      </div>
    </div>
  );
}
