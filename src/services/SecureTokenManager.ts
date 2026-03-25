import CryptoJS from 'crypto-js';

export interface TokenMetadata {
  createdAt: number;
  expiresAt?: number;
  scopes: string[];
  lastUsed?: number;
  useCount: number;
}

class SecureTokenManager {
  private static instance: SecureTokenManager;
  private encryptionKey: string;
  private tokenCache: Map<string, { token: string; metadata: TokenMetadata }> = new Map();
  private readonly SESSION_KEY = 'github_token_encrypted';
  private readonly METADATA_KEY = 'github_token_metadata';

  private constructor() {
    this.encryptionKey = this.getOrCreateEncryptionKey();
    this.loadFromSession();
  }

  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  private getOrCreateEncryptionKey(): string {
    let key = sessionStorage.getItem('repo_graph_encryption_key');
    
    if (!key) {
      key = CryptoJS.lib.WordArray.random(256 / 8).toString();
      sessionStorage.setItem('repo_graph_encryption_key', key);
    }
    
    return key;
  }

  private encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
  }

  private decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  async storeToken(token: string, scopes: string[] = []): Promise<void> {
    if (!token || token.length < 40) {
      throw new Error('Invalid token format');
    }

    const encrypted = this.encryptToken(token);
    sessionStorage.setItem(this.SESSION_KEY, encrypted);

    const metadata: TokenMetadata = {
      createdAt: Date.now(),
      scopes,
      useCount: 0
    };
    sessionStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));

    this.tokenCache.set('current', { token: encrypted, metadata });
  }

  getToken(): string | null {
    const cached = this.tokenCache.get('current');
    if (cached) {
      try {
        const token = this.decryptToken(cached.token);
        const metadata = JSON.parse(sessionStorage.getItem(this.METADATA_KEY) || '{}');
        metadata.lastUsed = Date.now();
        metadata.useCount = (metadata.useCount || 0) + 1;
        sessionStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
        
        return token;
      } catch {
        return null;
      }
    }
    
    const encrypted = sessionStorage.getItem(this.SESSION_KEY);
    if (!encrypted) return null;
    
    try {
      const token = this.decryptToken(encrypted);
      return token;
    } catch {
      this.clearToken();
      return null;
    }
  }

  getTokenMetadata(): TokenMetadata | null {
    const metadata = sessionStorage.getItem(this.METADATA_KEY);
    if (!metadata) return null;
    
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }

  clearToken(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.METADATA_KEY);
    this.tokenCache.clear();
  }

  private loadFromSession(): void {
    const encrypted = sessionStorage.getItem(this.SESSION_KEY);
    if (encrypted) {
      this.tokenCache.set('current', {
        token: encrypted,
        metadata: JSON.parse(sessionStorage.getItem(this.METADATA_KEY) || '{}')
      });
    }
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    const metadata = this.getTokenMetadata();
    if (!metadata) return false;
    
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      this.clearToken();
      return false;
    }
    
    return true;
  }

  getMaskedToken(): string {
    const token = this.getToken();
    if (!token) return '';
    
    const length = token.length;
    if (length <= 8) return '•'.repeat(length);
    
    return token.substring(0, 4) + '•'.repeat(length - 8) + token.substring(length - 4);
  }

  async fetchTokenScopes(token: string): Promise<string[]> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'RepoGraph'
        }
      });
      
      const scopes = response.headers.get('X-OAuth-Scopes');
      return scopes ? scopes.split(', ') : [];
    } catch {
      return [];
    }
  }
}

export const tokenManager = SecureTokenManager.getInstance();
