import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock react-force-graph-2d
vi.mock('react-force-graph-2d', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="force-graph-2d" />
  };
});