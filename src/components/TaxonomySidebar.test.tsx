import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaxonomySidebar, { GraphConfig } from './TaxonomySidebar';

describe('TaxonomySidebar', () => {
  const defaultConfig: GraphConfig = {
    model: 'dependency',
    metric: 'none',
    encoding: 'force'
  };

  it('renders all sections', () => {
    render(<TaxonomySidebar config={defaultConfig} setConfig={() => {}} />);
    
    expect(screen.getByText('1. Commit Graphs')).toBeInTheDocument();
    expect(screen.getByText('2. Contributor Graphs')).toBeInTheDocument();
    expect(screen.getByText('3. File / Code Structure')).toBeInTheDocument();
  });

  it('calls setConfig when an option is clicked', () => {
    const setConfig = vi.fn();
    render(<TaxonomySidebar config={defaultConfig} setConfig={setConfig} />);
    
    // Click "Linear Commit Timeline"
    fireEvent.click(screen.getByText('Linear Commit Timeline'));
    
    expect(setConfig).toHaveBeenCalledWith({
      model: 'commit-linear',
      metric: 'none',
      encoding: 'dag-lr'
    });
  });

  it('highlights active options', () => {
    const config: GraphConfig = {
      model: 'commit-linear',
      metric: 'none',
      encoding: 'dag-lr'
    };
    
    render(<TaxonomySidebar config={config} setConfig={() => {}} />);
    
    const option = screen.getByText('Linear Commit Timeline').closest('button');
    expect(option).toHaveClass('bg-indigo-50');
  });

  it('calls setConfig for all options', () => {
    const setConfig = vi.fn();
    render(<TaxonomySidebar config={defaultConfig} setConfig={setConfig} />);
    
    fireEvent.click(screen.getByText('Branching Tree'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'commit-branch', encoding: 'dag-td' });
    
    fireEvent.click(screen.getByText('Merge Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'commit-merge', encoding: 'force' });

    fireEvent.click(screen.getByText('Activity Over Time'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'contributor-activity', encoding: 'force' });

    fireEvent.click(screen.getByText('Collaboration Network'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'contributor-collab', encoding: 'force' });

    fireEvent.click(screen.getByText('Bus Factor Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'contributor-bus', encoding: 'circular' });

    fireEvent.click(screen.getByText('Directory Tree Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'tree' });

    fireEvent.click(screen.getByText('Layer 1: Raw Text Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'raw-text' });

    fireEvent.click(screen.getByText('Layer 8: Dependency Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'dependency' });

    fireEvent.click(screen.getByText('Layer 9: Git DAG'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'git-dag' });

    fireEvent.click(screen.getByText('Layer 10: Commit-File Graph'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, model: 'commit-file' });

    fireEvent.click(screen.getByText('Force-Directed'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, encoding: 'force' });

    fireEvent.click(screen.getByText('Hierarchical (Top-Down)'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, encoding: 'dag-td' });

    fireEvent.click(screen.getByText('Hierarchical (Left-Right)'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, encoding: 'dag-lr' });

    fireEvent.click(screen.getByText('Radial Tree'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, encoding: 'radial' });

    fireEvent.click(screen.getByText('Circular Layout'));
    expect(setConfig).toHaveBeenCalledWith({ ...defaultConfig, encoding: 'circular' });
  });
});
