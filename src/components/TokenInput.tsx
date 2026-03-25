import React, { useState } from 'react';
import { tokenManager } from '../services/SecureTokenManager';
import { GitHubClient } from '../services/GitHubClient';
import { ErrorHandler } from '../utils/ErrorHandler';

export const TokenInput: React.FC = () => {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [scopes, setScopes] = useState<string[]>([]);
  
  const hasToken = tokenManager.isTokenValid();
  const tokenMetadata = tokenManager.getTokenMetadata();
  const maskedToken = tokenManager.getMaskedToken();
  
  const validateToken = async (tokenValue: string) => {
    setIsValidating(true);
    setError(null);
    
    try {
      if (!tokenValue || tokenValue.length < 40) {
        throw new Error('Token appears to be invalid');
      }
      
      const client = GitHubClient.getInstance();
      await client.fetchWithAuth('https://api.github.com/user');
      
      const tokenScopes = await tokenManager.fetchTokenScopes(tokenValue);
      setScopes(tokenScopes);
      
      await tokenManager.storeToken(tokenValue, tokenScopes);
      setToken('');
      
      setError(null);
      
    } catch (err) {
      setError(ErrorHandler.getUserFriendlyError(err));
      setToken('');
    } finally {
      setIsValidating(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      validateToken(token.trim());
    }
  };
  
  const handleClearToken = () => {
    tokenManager.clearToken();
    setScopes([]);
    setError(null);
  };
  
  if (hasToken) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-green-800">
              ✓ GitHub Token Active
            </h3>
            <p className="text-xs text-green-700 mt-1">
              Token: {maskedToken}
            </p>
            {tokenMetadata && (
              <p className="text-xs text-green-600 mt-2">
                Used {tokenMetadata.useCount} times • Created {new Date(tokenMetadata.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={handleClearToken}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear Token
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-yellow-800 mb-2">
        GitHub Personal Access Token (Optional)
      </h3>
      <p className="text-xs text-yellow-700 mb-3">
        Provide a token for higher rate limits and private repository access.
        Token is encrypted and stored only for this session.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            disabled={isValidating}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500"
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={!token.trim() || isValidating}
            className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Add Token'}
          </button>
          
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,public_repo,read:org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-yellow-700 hover:text-yellow-800"
          >
            Create new token →
          </a>
        </div>
      </form>
    </div>
  );
};
