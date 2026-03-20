import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GraphView from './GraphView';
import { GraphData } from '../utils/parser';

// Mock react-force-graph-2d
vi.mock('react-force-graph-2d', () => {
  return {
    default: vi.fn((props) => {
      // We can simulate node click by exposing a button
      return (
        <div data-testid="force-graph">
          <button 
            data-testid="mock-node-click" 
            onClick={() => props.onNodeClick({ id: 'node1', name: 'Node 1', type: 'ts', val: 10 })}
          >
            Click Node
          </button>
          <button
            data-testid="mock-bg-click"
            onClick={() => props.onBackgroundClick()}
          >
            Click BG
          </button>
        </div>
      );
    })
  };
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('GraphView', () => {
  const mockData: GraphData = {
    nodes: [
      { id: 'node1', name: 'Node 1', type: 'ts', val: 10, path: 'src/node1.ts' },
      { id: 'node2', name: 'Node 2', type: 'js', val: 5, path: 'src/node2.js' }
    ],
    links: [
      { source: 'node1', target: 'node2' }
    ]
  };

  const mockConfig = {
    model: 'dependency' as const,
    metric: 'none' as const,
    encoding: 'force' as const
  };

  const mockOnNodeClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
  });

  it('calls onNodeClick when a node is clicked', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    fireEvent.click(screen.getByTestId('mock-node-click'));
    expect(mockOnNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'node1' }));
  });

  it('calls onNodeClick with null when background is clicked', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    fireEvent.click(screen.getByTestId('mock-bg-click'));
    expect(mockOnNodeClick).toHaveBeenCalledWith(null);
  });

  it('shows repo insights when toggle is clicked', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    const toggleBtn = screen.getByText('Repo Insights');
    fireEvent.click(toggleBtn);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Files')).toBeInTheDocument();
  });

  it('shows node details when a node is selected', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
        selectedNodeId="node1"
      />
    );
    
    expect(screen.getByText('Node Details')).toBeInTheDocument();
    expect(screen.getByText('src/node1.ts')).toBeInTheDocument();
  });

  it('handles export to json', () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = vi.fn();
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document.createElement and a.click
    const mockClick = vi.fn();
    const mockA = { click: mockClick, href: '', download: '' };
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'a') return mockA as any;
      return originalCreateElement(tagName, options);
    });
    
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node === mockA as unknown as Node) return node;
      return HTMLElement.prototype.appendChild.call(document.body, node);
    });
    
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
      if (node === mockA as unknown as Node) return node;
      return HTMLElement.prototype.removeChild.call(document.body, node);
    });

    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    const exportJsonBtn = screen.getByTitle('Export JSON');
    fireEvent.click(exportJsonBtn);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockA.download).toBe('graph-export.json');
    
    // Restore mocks
    vi.restoreAllMocks();
  });

  it('handles export to graphml', () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = vi.fn();
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document.createElement and a.click
    const mockClick = vi.fn();
    const mockA = { click: mockClick, href: '', download: '' };
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'a') return mockA as any;
      return originalCreateElement(tagName, options);
    });
    
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node === mockA as unknown as Node) return node;
      return HTMLElement.prototype.appendChild.call(document.body, node);
    });
    
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
      if (node === mockA as unknown as Node) return node;
      return HTMLElement.prototype.removeChild.call(document.body, node);
    });

    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    const exportGmlBtn = screen.getByTitle('Export GraphML');
    fireEvent.click(exportGmlBtn);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockA.download).toBe('graph-export.graphml');
    
    // Restore mocks
    vi.restoreAllMocks();
  });

  it('renders with different models', () => {
    const { rerender } = render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={{ ...mockConfig, model: 'raw-text' }} 
      />
    );
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();

    rerender(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={{ ...mockConfig, model: 'tree' }} 
      />
    );
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();

    rerender(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={{ ...mockConfig, model: 'commit-file' }} 
        commits={[{ sha: '123', commit: { message: 'test' } }]}
      />
    );
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();

    rerender(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={{ ...mockConfig, model: 'contributor-collab' }} 
        contributors={[{ login: 'user1', contributions: 10 }]}
      />
    );
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
  });

  it('handles search input', () => {
    render(
      <GraphView 
        data={mockData} 
        onNodeClick={mockOnNodeClick} 
        config={mockConfig} 
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search nodes by name or path...');
    fireEvent.change(searchInput, { target: { value: 'node1' } });
    
    expect(searchInput).toHaveValue('node1');
  });
});
