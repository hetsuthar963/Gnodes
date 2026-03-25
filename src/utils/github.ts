export interface GitHubFile {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
  content?: string;
  size?: number;
}

export interface RepoTree {
  sha: string;
  url: string;
  tree: GitHubFile[];
}

export async function fetchRepoTree(owner: string, repo: string, pat?: string): Promise<{ tree: GitHubFile[], defaultBranch: string }> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (pat) {
    headers['Authorization'] = `token ${pat}`;
  }

  // Get default branch
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('Repository not found. Check the URL or provide a Personal Access Token if it is private.');
    if (repoRes.status === 403 || repoRes.status === 429) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
    throw new Error(`Failed to fetch repository details: ${repoRes.statusText}`);
  }
  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch;

  // Get commit SHA for the branch
  const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${defaultBranch}`, { headers });
  if (!branchRes.ok) throw new Error(`Failed to fetch branch details: ${branchRes.statusText}`);
  const branchData = await branchRes.json();
  const treeSha = branchData.commit.commit.tree.sha;

  async function fetchTreeRecursive(treeSha: string, basePath: string = ''): Promise<GitHubFile[]> {
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, { headers });
    if (!treeRes.ok) {
      if (treeRes.status === 403 || treeRes.status === 429) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
      throw new Error(`Failed to fetch repository tree: ${treeRes.statusText}`);
    }
    const treeData: any = await treeRes.json();
    
    if (!treeData.tree) return [];

    let files: GitHubFile[] = [];
    
    if (treeData.truncated) {
      // If recursive fetch was truncated, we must fetch the non-recursive tree 
      // to get all direct children, then recurse into each tree manually.
      const nonRecursiveRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}`, { headers });
      if (!nonRecursiveRes.ok) throw new Error(`Failed to fetch non-recursive tree: ${nonRecursiveRes.statusText}`);
      const nonRecursiveData = await nonRecursiveRes.json();
      
      const subTrees: any[] = [];
      for (const item of nonRecursiveData.tree) {
        const fullPath = basePath ? `${basePath}/${item.path}` : item.path;
        if (item.type === 'blob') {
          files.push({ ...item, path: fullPath });
        } else if (item.type === 'tree') {
          subTrees.push({ ...item, path: fullPath });
        }
      }

      // Fetch sub-trees in parallel with concurrency limit
      const concurrencyLimit = 5;
      for (let i = 0; i < subTrees.length; i += concurrencyLimit) {
        const batch = subTrees.slice(i, i + concurrencyLimit);
        const results = await Promise.all(batch.map(t => fetchTreeRecursive(t.sha, t.path)));
        for (const res of results) {
          files = files.concat(res);
        }
      }
    } else {
      // Not truncated, we have everything recursively
      for (const item of treeData.tree) {
        const fullPath = basePath ? `${basePath}/${item.path}` : item.path;
        if (item.type === 'blob') {
          files.push({ ...item, path: fullPath });
        }
      }
    }

    return files;
  }

  const allFiles = await fetchTreeRecursive(treeSha);
  const uniqueFiles = Array.from(new Map(allFiles.map(f => [f.path, f])).values());
  return { tree: uniqueFiles, defaultBranch };
}

export async function fetchFileContent(owner: string, repo: string, path: string, branch: string, pat?: string, retries = 3): Promise<string> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');

  for (let i = 0; i < retries; i++) {
    try {
      if (pat) {
        const apiHeaders: HeadersInit = {
          'Accept': 'application/vnd.github.v3.raw',
          'Authorization': `token ${pat}`
        };
        const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, { headers: apiHeaders });
        if (!apiRes.ok) {
          if (apiRes.status === 429 || apiRes.status === 403) throw new Error(`Rate limit`);
          throw new Error(`Failed to fetch file content for ${path}`);
        }
        return await apiRes.text();
      }

      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`);
      if (!res.ok) {
        if (res.status === 429) throw new Error(`Rate limit`);
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err: any) {
      if (i === retries - 1) {
        // Fallback to API if raw fails on last retry (and no PAT)
        if (!pat) {
          const apiHeaders: HeadersInit = {
            'Accept': 'application/vnd.github.v3.raw',
          };
          const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, { headers: apiHeaders });
          if (!apiRes.ok) throw new Error(`Failed to fetch file content for ${path}`);
          return await apiRes.text();
        }
        throw err;
      }
      // Wait before retrying (exponential backoff)
      await delay(1000 * Math.pow(2, i));
    }
  }
  throw new Error(`Failed to fetch file content for ${path}`);
}

export async function fetchCommits(owner: string, repo: string, pat?: string): Promise<any[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (pat) {
    headers['Authorization'] = `token ${pat}`;
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`, { headers });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
    throw new Error(`Failed to fetch commits: ${res.statusText}`);
  }
  const data = await res.json();
  return data.reverse();
}

export async function fetchContributors(owner: string, repo: string, pat?: string): Promise<any[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (pat) {
    headers['Authorization'] = `token ${pat}`;
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, { headers });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
    throw new Error(`Failed to fetch contributors: ${res.statusText}`);
  }
  return await res.json();
}
