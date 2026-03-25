export interface ImportNode {
  path: string;
  line: number;
}

export interface ExportNode {
  name: string;
  type: 'named' | 'default' | 're-export';
}

export interface SymbolNode {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable';
  location: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface AST {
  root: any;
}

export interface TreeSitterEngine {
  initializeParsers(): Promise<Map<string, any>>;
  parseFile(filePath: string, content: string): AST;
  extractImports(ast: AST, language: string): ImportNode[];
  extractExports(ast: AST, language: string): ExportNode[];
  extractSymbols(ast: AST, language: string): SymbolNode[];
}
