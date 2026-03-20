import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FileViewer from './FileViewer';

describe('FileViewer', () => {
  it('renders placeholder when no file is selected', () => {
    render(<FileViewer file={null} theme="light" />);
    expect(screen.getByText('Select a file to view its contents')).toBeInTheDocument();
  });

  it('renders file content when a file is selected', () => {
    const mockFile = {
      id: 'src/index.ts',
      name: 'index.ts',
      path: 'src/index.ts',
      type: 'file',
      content: 'console.log("hello");',
      val: 1
    };

    render(<FileViewer file={mockFile} theme="light" />);
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('console.log("hello");')).toBeInTheDocument();
  });
});
