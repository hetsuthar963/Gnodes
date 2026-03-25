import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import { FileNode } from '../utils/parser';
import { Info } from 'lucide-react';
import { clsx } from 'clsx';

interface FileViewerProps {
  file: FileNode | null;
  highlightString?: string | null;
  stats?: any;
}

export default function FileViewer({ file, highlightString, stats }: FileViewerProps) {
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-zinc-100 rounded-xl border border-zinc-200 transition-colors">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium">Select a file to view its contents</p>
      </div>
    );
  }

  const isMarkdown = file.type === 'md';

  const customSyntaxStyle = { ...vs };
  
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
    <div className="flex h-full bg-white border border-zinc-200 overflow-hidden transition-colors">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200 transition-colors">
          <div className="flex items-center min-w-0">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2 shrink-0"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2 shrink-0"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 mr-4 shrink-0"></div>
            <span className="text-sm font-semibold text-zinc-900 truncate">{file.name}</span>
            <span className="text-sm text-zinc-500 ml-2 truncate hidden sm:block">{file.path}</span>
          </div>
          {file.size !== undefined && file.type !== 'commit' && file.type !== 'contributor' && (
            <span className="text-xs text-zinc-500 font-mono shrink-0 ml-4">
              {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
            </span>
          )}
        </div>

        {/* Details and AI Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-zinc-200 text-sm">
          <div className="flex items-center gap-4">
            {file.type === 'commit' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Author:</span>
                  <span className="font-medium text-zinc-900">{(file as any).author}</span>
                </div>
                {(file as any).date && (
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500">Date:</span>
                    <span className="font-medium text-zinc-900">{new Date((file as any).date).toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
            {stats && file.type !== 'commit' && file.type !== 'contributor' && file.type !== 'repo' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Imported By:</span>
                  <span className="font-medium text-zinc-900">{stats.inDegree?.[file.id] || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Dependencies:</span>
                  <span className="font-medium text-zinc-900">{stats.outDegree?.[file.id] || 0}</span>
                </div>
              </>
            )}
            {file.physics && (
              <div className="flex items-center gap-3 ml-4 border-l border-zinc-200 pl-4">
                <div className="flex items-center gap-1" title="State Management">
                  <span className="text-zinc-500">State:</span>
                  <span className="font-medium text-zinc-900">{file.physics.state_management}</span>
                </div>
                <div className="flex items-center gap-1" title="Side Effects">
                  <span className="text-zinc-500">Effects:</span>
                  <span className="font-medium text-zinc-900">{file.physics.side_effects}</span>
                </div>
                <div className="flex items-center gap-1" title="Data Flow">
                  <span className="text-zinc-500">Data:</span>
                  <span className="font-medium text-zinc-900">{file.physics.data_flow}</span>
                </div>
                <div className="flex items-center gap-1" title="Computation">
                  <span className="text-zinc-500">Comp:</span>
                  <span className="font-medium text-zinc-900">{file.physics.computation}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-white">
          {isMarkdown ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{file.content || ''}</ReactMarkdown>
            </div>
          ) : (
            <SyntaxHighlighter
              language={file.type}
              style={vs}
              customStyle={{
                margin: 0,
                padding: 0,
                backgroundColor: 'transparent',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
              showLineNumbers={true}
              wrapLines={true}
              lineProps={(lineNumber) => {
                const line = file.content?.split('\n')[lineNumber - 1] || '';
                if (highlightString && line.includes(highlightString)) {
                  return { style: { display: 'block', backgroundColor: 'rgba(0, 0, 0, 0.1)' } };
                }
                return {};
              }}
            >
              {file.content || ''}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
}
