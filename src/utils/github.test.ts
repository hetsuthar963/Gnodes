import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRepoTree, fetchFileContent, fetchCommits, fetchContributors } from './github';

describe('github API', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should fetch repo tree', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ default_branch: 'main' })
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: 'src/index.ts', type: 'blob', sha: '123', url: 'url' },
          { path: 'src', type: 'tree', sha: '456', url: 'url2' }
        ]
      })
    });

    const result = await fetchRepoTree('owner', 'repo');
    expect(result.defaultBranch).toBe('main');
    expect(result.tree).toHaveLength(1); // Only blobs
    expect(result.tree[0].path).toBe('src/index.ts');
  });

  it('should handle fetch repo tree error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(fetchRepoTree('owner', 'repo')).rejects.toThrow('Repository not found');
  });

  it('should fetch file content via raw.githubusercontent.com', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => 'console.log("hello");'
    });

    const content = await fetchFileContent('owner', 'repo', 'src/index.ts', 'main');
    expect(content).toBe('console.log("hello");');
    expect(global.fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/main/src/index.ts');
  });

  it('should fetch commits', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ sha: '123', commit: { message: 'init' } }]
    });

    const commits = await fetchCommits('owner', 'repo');
    expect(commits).toHaveLength(1);
    expect(commits[0].sha).toBe('123');
  });

  it('should fetch contributors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: 'user1', contributions: 10 }]
    });

    const contributors = await fetchContributors('owner', 'repo');
    expect(contributors).toHaveLength(1);
    expect(contributors[0].login).toBe('user1');
  });
});
