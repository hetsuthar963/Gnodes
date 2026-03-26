import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

class MockWorker {
  listeners: any = {};
  onmessage: any = null;
  onerror: any = null;
  
  constructor(stringUrl: string | URL, options?: WorkerOptions) {}
  
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
    // Mock minimal responses if needed, or do nothing
  }
  
  terminate() {}
}

global.Worker = MockWorker as any;

// Mock react-force-graph-2d
vi.mock('react-force-graph-2d', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="force-graph-2d" />
  };
});