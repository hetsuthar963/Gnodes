export interface FileNode {
  id: string;
  type: 'FILE';
  language: string;
  size: number;
  lastModified: Date;
  metrics: {
    complexity: number;
    commentRatio: number;
  };
}

export interface SymbolNode {
  id: string;
  type: 'FUNCTION' | 'CLASS' | 'INTERFACE' | 'VARIABLE' | 'TYPE';
  name: string;
  file: string;
  location: any;
  visibility: 'public' | 'private' | 'protected' | 'internal';
}

export interface CodeGraph {
  nodes: Map<string, FileNode | SymbolNode>;
  edges: Array<any>;
  index: {
    filesByLanguage: Map<string, Set<string>>;
    symbolsByName: Map<string, Set<string>>;
    incomingEdges: Map<string, Set<string>>;
    outgoingEdges: Map<string, Set<string>>;
  };
}
