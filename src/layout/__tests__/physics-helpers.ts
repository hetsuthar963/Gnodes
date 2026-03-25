// src/layout/__tests__/physics-helpers.ts

export interface Node {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius?: number;
  fx?: number;
  fy?: number;
  [key: string]: any;
}

export interface Link {
  source: string;
  target: string;
  distance?: number;
  strength?: number;
}

export interface Simulation {
  tick: () => void;
  stabilize: (options: { energyThreshold?: number; maxTicks?: number }) => void;
  alpha: () => number;
  alphaMin: () => number;
  nodes: Node[];
  links: Link[];
}

export interface SimulationConfig {
  nodes: Node[];
  links?: Link[];
  forces: {
    charge?: { strength: number } | false;
    link?: { distance?: number; strength?: number } | boolean;
    center?: { x: number; y: number; strength: number } | false;
    collide?: { radius: number | ((d: any) => number); strength?: number; iterations?: number } | false;
  };
  velocityDecay?: number;
  alphaDecay?: number;
  alphaMin?: number;
}

export function createSimulation(config: SimulationConfig): Simulation {
  // Mock implementation for test structure
  return {
    tick: () => {},
    stabilize: () => {},
    alpha: () => 0,
    alphaMin: () => 0.001,
    nodes: config.nodes,
    links: config.links || [],
  };
}

export function calculateDistance(a: Node, b: Node): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function calculateAngle(a: Node, b: Node): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function calculateCentroid(nodes: Node[]): { x: number; y: number } {
  return {
    x: nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length,
    y: nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length,
  };
}

export function generateRandomGraph(nodeCount: number, linkCount: number): Node[] {
  return Array.from({ length: nodeCount }, (_, i) => ({
    id: `node-${i}`,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
  }));
}

export function generateLinks(nodes: Node[], count: number): Link[] {
  return Array.from({ length: count }, (_, i) => ({
    source: nodes[i % nodes.length].id,
    target: nodes[(i + 1) % nodes.length].id,
  }));
}
