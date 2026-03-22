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

  // Get tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
  if (!treeRes.ok) {
    if (treeRes.status === 403 || treeRes.status === 429) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
    throw new Error(`Failed to fetch repository tree: ${treeRes.statusText}`);
  }
  const treeData: RepoTree = await treeRes.json();

  if (!treeData.tree) {
    return { tree: [], defaultBranch };
  }

  return { tree: treeData.tree.filter(item => item.type === 'blob'), defaultBranch };
}

export async function fetchFileContent(owner: string, repo: string, path: string, branch: string, pat?: string): Promise<string> {
  if (pat) {
    // raw.githubusercontent.com does not support CORS with Authorization headers.
    // We must use the GitHub API for authenticated requests.
    const apiHeaders: HeadersInit = {
      'Accept': 'application/vnd.github.v3.raw',
      'Authorization': `token ${pat}`
    };
    const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers: apiHeaders });
    if (!apiRes.ok) throw new Error(`Failed to fetch file content for ${path}`);
    return await apiRes.text();
  }

  try {
    // Use raw.githubusercontent.com to avoid API rate limits for public repos
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    // Fallback to API if raw fails
    const apiHeaders: HeadersInit = {
      'Accept': 'application/vnd.github.v3.raw',
    };
    const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers: apiHeaders });
    if (!apiRes.ok) throw new Error(`Failed to fetch file content for ${path}`);
    return await apiRes.text();
  }
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
