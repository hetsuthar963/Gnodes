import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as github from './utils/github';

vi.mock('./utils/github', () => ({
  fetchRepoTree: vi.fn(),
  fetchFileContent: vi.fn(),
  fetchCommits: vi.fn(),
  fetchContributors: vi.fn(),
}));

vi.mock('./workers/data.worker?worker', () => {
  return {
    default: class MockWorker {
      listeners: any = {};
      addEventListener(event: string, callback: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
      }
      removeEventListener(event: string, callback: Function) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter((cb: any) => cb !== callback);
        }
      }
      postMessage(data: any) {
        if (data.type === 'BUILD_GRAPH') {
          const listeners = this.listeners['message'] || [];
          setTimeout(() => {
            listeners.forEach((cb: any) => cb({ data: { type: 'GRAPH_BUILT', payload: { nodes: [], links: [] } } }));
          }, 0);
        }
      }
      terminate = vi.fn();
    }
  };
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state', () => {
    render(<App />);
    expect(screen.getByText('Enter a GitHub repository URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://github.com/owner/repo')).toBeInTheDocument();
  });

  it('handles invalid repo URL', async () => {
    render(<App />);
    const input = screen.getByPlaceholderText('https://github.com/owner/repo');
    const button = screen.getByText('Generate Graph');

    fireEvent.change(input, { target: { value: 'invalid-url' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Invalid GitHub repository URL. Use format: owner/repo or https://github.com/owner/repo')).toBeInTheDocument();
    });
  });

  it('fetches and displays graph data', async () => {
    (github.fetchRepoTree as any).mockResolvedValue({
      tree: [{ path: 'src/index.ts', type: 'blob' }],
      defaultBranch: 'main'
    });
    (github.fetchCommits as any).mockResolvedValue([]);
    (github.fetchContributors as any).mockResolvedValue([]);
    (github.fetchFileContent as any).mockResolvedValue('console.log("hello");');

    render(<App />);
    const input = screen.getByPlaceholderText('https://github.com/owner/repo');
    const button = screen.getByText('Generate Graph');

    fireEvent.change(input, { target: { value: 'owner/repo' } });
    fireEvent.click(button);

    expect(screen.getByText('Cloning and analyzing repository...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Cloning and analyzing repository...')).not.toBeInTheDocument();
    });

    // TaxonomySidebar should be visible
    expect(screen.getByText('1. Commit Graphs')).toBeInTheDocument();
  });

  it('toggles view modes', async () => {
    (github.fetchRepoTree as any).mockResolvedValue({
      tree: [{ path: 'src/index.ts', type: 'blob' }],
      defaultBranch: 'main'
    });
    (github.fetchCommits as any).mockResolvedValue([]);
    (github.fetchContributors as any).mockResolvedValue([]);
    (github.fetchFileContent as any).mockResolvedValue('console.log("hello");');

    render(<App />);
    const input = screen.getByPlaceholderText('https://github.com/owner/repo');
    const button = screen.getByText('Generate Graph');

    fireEvent.change(input, { target: { value: 'owner/repo' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByText('Cloning and analyzing repository...')).not.toBeInTheDocument();
    });

    // Default is 'graph' mode, so Sidebar is not visible
    expect(screen.queryByText('Explorer')).not.toBeInTheDocument();

    // Click 'split' mode
    const splitButton = screen.getByTitle('Split View');
    fireEvent.click(splitButton);

    // Sidebar should now be visible
    expect(screen.getByText('Explorer')).toBeInTheDocument();

    // Click 'file' mode
    const fileButton = screen.getByTitle('File View');
    fireEvent.click(fileButton);

    // GraphView should not be visible
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
  });
});
