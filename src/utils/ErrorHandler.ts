export class ErrorHandler {
  private static readonly SENSITIVE_PATTERNS = [
    /token[=:]\s*[a-f0-9]{40}/gi,
    /ghp_[a-zA-Z0-9]{36}/gi,
    /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/gi,
    /password[=:]\s*[^\s]+/gi,
    /secret[=:]\s*[^\s]+/gi,
    /api[_-]?key[=:]\s*[^\s]+/gi,
    /authorization[=:]\s*Bearer\s+[^\s]+/gi
  ];
  
  static sanitizeError(error: unknown): string {
    let message = '';
    
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = 'An unexpected error occurred';
    }
    
    for (const pattern of this.SENSITIVE_PATTERNS) {
      message = message.replace(pattern, '[REDACTED]');
    }
    
    if (message.length > 500) {
      message = message.substring(0, 500) + '...';
    }
    
    return message;
  }
  
  static getUserFriendlyError(error: unknown): string {
    const sanitized = this.sanitizeError(error);
    
    if (sanitized.includes('rate limit')) {
      return 'GitHub API rate limit exceeded. Please wait a few minutes or provide a Personal Access Token.';
    }
    
    if (sanitized.includes('404') || sanitized.includes('Not Found')) {
      return 'Repository or file not found. Please check the URL and try again.';
    }
    
    if (sanitized.includes('401') || sanitized.includes('Unauthorized')) {
      return 'Authentication failed. Please check your GitHub token.';
    }
    
    if (sanitized.includes('403')) {
      return 'Access denied. You may not have permission to view this repository.';
    }
    
    if (sanitized.includes('timeout') || sanitized.includes('NetworkError')) {
      return 'Network timeout. Please check your internet connection.';
    }
    
    return `Error: ${sanitized}`;
  }
  
  static logError(error: unknown, context?: Record<string, any>): void {
    const sanitizedContext: Record<string, any> = {};
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string') {
          sanitizedContext[key] = this.sanitizeError(value);
        } else {
          sanitizedContext[key] = value;
        }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.error('[Error]', {
        error: this.sanitizeError(error),
        context: sanitizedContext,
        timestamp: new Date().toISOString()
      });
    }
  }
}
