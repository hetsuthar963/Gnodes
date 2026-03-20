import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  const mockFiles = [
    { id: 'src/index.ts', name: 'index.ts', path: 'src/index.ts', type: 'file', content: 'hello', val: 1 },
    { id: 'src/utils/helper.ts', name: 'helper.ts', path: 'src/utils/helper.ts', type: 'file', content: 'world', val: 1 },
  ];

  it('renders file list', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} selectedFileId={null} />);
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    
    // Click the folder to expand it
    fireEvent.click(screen.getByText('src'));
    
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('utils')).toBeInTheDocument();
  });

  it('calls onFileSelect when a file is clicked', () => {
    const onFileSelect = vi.fn();
    render(<Sidebar files={mockFiles} onFileSelect={onFileSelect} selectedFileId={null} />);
    
    // Expand src
    fireEvent.click(screen.getByText('src'));
    
    fireEvent.click(screen.getByText('index.ts'));
    expect(onFileSelect).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('highlights selected file', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} selectedFileId="src/index.ts" />);
    
    // Should be automatically expanded because it contains the selected file
    const indexFile = screen.getByText('index.ts').closest('div.flex.items-center');
    expect(indexFile).toHaveClass('bg-zinc-200');
  });
});
