import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface ImportInfo {
  source: string;
  specifiers: string[];
  type: 'static' | 'dynamic';
  line: number;
  column: number;
}

export class SafeASTParser {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_PARSE_TIME = 5000; // 5 seconds
  
  static parseImports(content: string, filePath: string): ImportInfo[] {
    if (content.length > this.MAX_FILE_SIZE) {
      console.warn(`File too large: ${filePath}, skipping parsing`);
      return [];
    }
    
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    if (this.shouldUseRegexFallback(extension)) {
      return this.safeRegexParseImports(content);
    }
    
    return this.parseASTImports(content);
  }
  
  private static parseASTImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    let ast;
    
    try {
      ast = acorn.parse(content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        locations: true
      });
    } catch {
      return this.safeRegexParseImports(content);
    }
    
    walk.simple(ast, {
      ImportDeclaration(node: any) {
        imports.push({
          source: node.source.value,
          specifiers: node.specifiers.map((spec: any) => spec.local?.name || 'default'),
          type: 'static',
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0
        });
      },
      CallExpression(node: any) {
        if (node.callee.type === 'Import' && node.arguments[0]?.type === 'Literal') {
          imports.push({
            source: node.arguments[0].value,
            specifiers: [],
            type: 'dynamic',
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0
          });
        }
      },
      ExportNamedDeclaration(node: any) {
        if (node.source) {
          imports.push({
            source: node.source.value,
            specifiers: node.specifiers.map((spec: any) => spec.exported?.name || ''),
            type: 'static',
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0
          });
        }
      }
    });
    
    return imports;
  }
  
  private static safeRegexParseImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    
    const patterns = [
      {
        regex: /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm,
        type: 'static' as const
      },
      {
        regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
        type: 'dynamic' as const
      },
      {
        regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
        type: 'static' as const
      }
    ];
    
    for (const pattern of patterns) {
      let match;
      let count = 0;
      const MAX_MATCHES = 1000;
      
      pattern.regex.lastIndex = 0;
      
      while ((match = pattern.regex.exec(content)) !== null && count < MAX_MATCHES) {
        if (match[1] && !match[1].startsWith('.') && !match[1].startsWith('/')) {
          imports.push({
            source: match[1],
            specifiers: [],
            type: pattern.type,
            line: this.getLineNumber(content, match.index),
            column: 0
          });
        }
        count++;
      }
    }
    
    return imports;
  }
  
  private static shouldUseRegexFallback(extension?: string): boolean {
    const astExtensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
    return !extension || !astExtensions.includes(extension);
  }
  
  private static getLineNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }
  
  static validateContent(content: string): boolean {
    const suspiciousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\.write/i,
      /innerHTML\s*=/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        console.warn('Suspicious pattern detected in file content');
        return false;
      }
    }
    
    return true;
  }
}
