export interface ValidationError {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  location: any;
}

export class GraphValidator {
  validateImportResolution(graph: any): ValidationError[] {
    return [];
  }
  
  validateCircularDependencies(graph: any): ValidationError[] {
    return [];
  }
}
