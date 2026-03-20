import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import { FileNode } from '../utils/parser';

interface FileViewerProps {
  file: FileNode | null;
  theme?: 'dark' | 'light';
}

export default function FileViewer({ file, theme = 'dark' }: FileViewerProps) {
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5 transition-colors">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium">Select a file to view its contents</p>
      </div>
    );
  }

  const isMarkdown = file.type === 'md';

  const baseStyle = theme === 'dark' ? vscDarkPlus : vs;
  const customSyntaxStyle = { ...baseStyle };
  
  // Remove background properties from the pre tag style to avoid React warnings
  // about mixing shorthand and non-shorthand properties
  if (customSyntaxStyle['pre[class*="language-"]']) {
    customSyntaxStyle['pre[class*="language-"]'] = {
      ...customSyntaxStyle['pre[class*="language-"]']
    };
    delete customSyntaxStyle['pre[class*="language-"]'].background;
    delete customSyntaxStyle['pre[class*="language-"]'].backgroundColor;
  }
  
  if (customSyntaxStyle['code[class*="language-"]']) {
    customSyntaxStyle['code[class*="language-"]'] = {
      ...customSyntaxStyle['code[class*="language-"]']
    };
    delete customSyntaxStyle['code[class*="language-"]'].background;
    delete customSyntaxStyle['code[class*="language-"]'].backgroundColor;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] rounded-xl border border-zinc-200 dark:border-white/10 shadow-lg overflow-hidden transition-colors">
      <div className="flex items-center px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-white/10 transition-colors">
        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
        <div className="w-3 h-3 rounded-full bg-green-500 mr-4"></div>
        <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate">{file.path}</span>
      </div>
      
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {isMarkdown ? (
          <div className="prose dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown>{file.content || ''}</ReactMarkdown>
          </div>
        ) : (
          <SyntaxHighlighter
            language={file.type}
            style={customSyntaxStyle}
            customStyle={{
              margin: 0,
              padding: 0,
              backgroundColor: 'transparent',
              fontSize: '13px',
              lineHeight: '1.5',
            }}
            showLineNumbers={true}
            wrapLines={true}
          >
            {file.content || ''}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
