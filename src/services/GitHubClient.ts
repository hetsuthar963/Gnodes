import { tokenManager } from './SecureTokenManager';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export class GitHubClient {
  private static instance: GitHubClient;
  private rateLimitCache: Map<string, RateLimitInfo> = new Map();
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests
  
  static getInstance(): GitHubClient {
    if (!GitHubClient.instance) {
      GitHubClient.instance = new GitHubClient();
    }
    return GitHubClient.instance;
  }
  
  private async rateLimit<T>(
    fn: () => Promise<T>,
    endpoint: string
  ): Promise<T> {
    const rateLimit = this.rateLimitCache.get(endpoint);
    if (rateLimit && rateLimit.remaining <= 0) {
      const waitTime = rateLimit.reset.getTime() - Date.now();
      if (waitTime > 0) {
        throw new Error(`Rate limit exceeded. Resets at ${rateLimit.reset.toLocaleTimeString()}`);
      }
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    try {
      const result = await fn();
      this.lastRequestTime = Date.now();
      return result;
    } catch (error: any) {
      if (error.status === 403 && error.headers?.['x-ratelimit-remaining'] === '0') {
        const resetTime = parseInt(error.headers['x-ratelimit-reset']) * 1000;
        const rateLimitInfo: RateLimitInfo = {
          limit: parseInt(error.headers['x-ratelimit-limit']),
          remaining: 0,
          reset: new Date(resetTime),
          used: parseInt(error.headers['x-ratelimit-used'])
        };
        this.rateLimitCache.set(endpoint, rateLimitInfo);
        throw new Error(`GitHub API rate limit exceeded. Resets at ${new Date(resetTime).toLocaleTimeString()}`);
      }
      throw error;
    }
  }
  
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = tokenManager.getToken();
    const headers: HeadersInit = {
      'User-Agent': 'RepoGraph',
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    
    return this.rateLimit(
      async () => {
        const response = await fetch(url, { ...options, headers });
        
        const rateLimit: RateLimitInfo = {
          limit: parseInt(response.headers.get('x-ratelimit-limit') || '60'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
          reset: new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000),
          used: parseInt(response.headers.get('x-ratelimit-used') || '0')
        };
        
        const endpoint = new URL(url).pathname;
        this.rateLimitCache.set(endpoint, rateLimit);
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        return response;
      },
      new URL(url).pathname
    );
  }
  
  async getRepository(owner: string, repo: string) {
    const response = await this.fetchWithAuth(
      `https://api.github.com/repos/${owner}/${repo}`
    );
    return response.json();
  }
  
  async getFileContent(owner: string, repo: string, path: string, ref?: string) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}` +
                (ref ? `?ref=${ref}` : '');
    const response = await this.fetchWithAuth(url);
    const data = await response.json();
    
    if (data.content) {
      data.content = atob(data.content.replace(/\n/g, ''));
    }
    
    return data;
  }
  
  async getRepositoryTree(owner: string, repo: string, sha: string) {
    const response = await this.fetchWithAuth(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
    );
    return response.json();
  }
}
