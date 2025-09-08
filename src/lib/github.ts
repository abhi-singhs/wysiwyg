// Client-side GitHub helper functions converting former server route logic
// NOTE: Personal Access Token (PAT) is supplied by user in browser; all requests
// run directly against GitHub REST / GraphQL / Models endpoints (CORS-enabled).
import { createOctokit } from './octokit';
import { AVAILABLE_MODELS as CURATED_MODELS } from './modelClient';

export interface Label { name: string; color: string; description?: string | null }
export interface IssueLite { number: number; title: string; url: string; state?: string; updated_at?: string }
export interface UserInfo { login: string; name?: string | null; email?: string | null; avatar_url?: string | null }
export interface ProjectInfo { id: string; name: string; body: string | null; number?: number | null }

function requireToken(token: string | null | undefined): asserts token is string {
  if (!token) throw new Error('Missing token');
}

export async function fetchUser(token: string): Promise<UserInfo> {
  requireToken(token);
  const octokit = createOctokit(token);
  const resp = await octokit.rest.users.getAuthenticated();
  return {
    login: resp.data.login,
    name: resp.data.name,
    email: resp.data.email || null,
    avatar_url: resp.data.avatar_url,
  };
}

export async function fetchLabels(token: string, owner: string, repo: string): Promise<Label[]> {
  requireToken(token);
  const octokit = createOctokit(token);
  const labels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, { owner, repo, per_page: 100 });
  return labels.map(l => ({ name: l.name, color: l.color, description: l.description }));
}

export async function searchIssues(token: string, owner: string, repo: string, query: string): Promise<IssueLite[]> {
  requireToken(token);
  const octokit = createOctokit(token);
  let searchQuery = `repo:${owner}/${repo} ${query} in:title,body`;
  if (!/\bis:(issue|pull-request)\b/.test(searchQuery)) searchQuery += ' is:issue';
  const gql = `
    query($searchQuery: String!, $first: Int!) {
      search(type: ISSUE, query: $searchQuery, first: $first) {
        edges { node { ... on Issue { number title url state updatedAt } } }
      }
    }
  `;
  interface GqlIssueNode { number: number; title: string; url: string; state: string; updatedAt: string }
  const data = await octokit.graphql<{ search?: { edges?: Array<{ node?: GqlIssueNode }> } }>(gql, { searchQuery, first: 5 });
  const edges = data.search?.edges || [];
  return edges.map(e => e.node).filter(Boolean).map(n => ({ number: n!.number, title: n!.title, url: n!.url, state: n!.state, updated_at: n!.updatedAt }));
}

export interface CreateIssueOptions {
  title: string; body: string; labels?: string[]; owner: string; repo: string; projectNodeId?: string | null; projectStatus?: 'in-progress' | 'no-status' | 'done';
}

async function setProjectStatus(octokit: ReturnType<typeof createOctokit>, projectId: string, itemId: string, projectStatus: 'in-progress' | 'no-status' | 'done') {
  try {
    const fieldsQuery = `
      query($projectId: ID!) {
        node(id: $projectId) { ... on ProjectV2 { fields(first: 50) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } }
      }
    `;
    type SingleSelectField = { id: string; name?: string; options?: Array<{ id: string; name: string }> };
    const data = await octokit.graphql<{ node?: { fields?: { nodes?: SingleSelectField[] } } }>(fieldsQuery, { projectId });
    const select = data.node?.fields?.nodes?.find(f => f.name === 'Status' && f.options);
    if (!select || !select.options) return;
    const optionValue = projectStatus === 'in-progress' ? 'In Progress' : projectStatus === 'done' ? 'Done' : 'No Status';
    const opt = select.options.find(o => o.name.toLowerCase() === optionValue.toLowerCase());
    if (!opt) return;
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
      }
    `;
    await octokit.graphql(mutation, { projectId, itemId, fieldId: select.id, optionId: opt.id });
  } catch (e) {
    console.warn('Failed to set project status:', e);
  }
}

export async function createIssue(token: string, opts: CreateIssueOptions): Promise<{ number: number; url: string; title: string }> {
  requireToken(token);
  const { title, body, labels = [], owner, repo, projectNodeId, projectStatus } = opts;
  const octokit = createOctokit(token);
  // Attribution footer
  let userInfo = 'Unknown User';
  try { const me = await octokit.rest.users.getAuthenticated(); userInfo = me.data.name || me.data.login; } catch {}
  const timestamp = new Date().toISOString();
  const enhancedBody = `${body}\n\n---\n*Created via Quick Notes by ${userInfo} at ${timestamp}*`;
  const resp = await octokit.rest.issues.create({ owner, repo, title, body: enhancedBody, labels });
  // Self-assign best-effort
  try { const me = await octokit.rest.users.getAuthenticated(); await octokit.rest.issues.addAssignees({ owner, repo, issue_number: resp.data.number, assignees: [me.data.login] }); } catch {}
  // Add to project if requested
  if (projectNodeId) {
    try {
      const issueNodeQuery = `
        query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { issue(number: $number) { id } } }
      `;
      const issueNodeData = await octokit.graphql<{ repository?: { issue?: { id: string } | null } | null }>(issueNodeQuery, { owner, repo, number: resp.data.number });
      const issueId = issueNodeData.repository?.issue?.id;
      if (issueId) {
        const addMutation = `
          mutation($projectId: ID!, $contentId: ID!) { addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } } }
        `;
        const addResult = await octokit.graphql<{ addProjectV2ItemById?: { item?: { id: string } } }>(addMutation, { projectId: projectNodeId, contentId: issueId });
        if (projectStatus && addResult.addProjectV2ItemById?.item?.id) {
          await setProjectStatus(octokit, projectNodeId, addResult.addProjectV2ItemById.item.id, projectStatus);
        }
      }
    } catch (e) { console.warn('Failed to add issue to project:', e); }
  }
  return { number: resp.data.number, url: resp.data.html_url, title: resp.data.title };
}

export interface AddCommentOptions { issueNumber: number; body: string; owner: string; repo: string; projectNodeId?: string | null; projectStatus?: 'in-progress' | 'no-status' | 'done'; }
export async function addComment(token: string, opts: AddCommentOptions): Promise<{ id: number; url: string; created_at: string }> {
  requireToken(token);
  const { issueNumber, body, owner, repo, projectNodeId, projectStatus } = opts;
  const octokit = createOctokit(token);
  let userInfo = 'Unknown User';
  try { const me = await octokit.rest.users.getAuthenticated(); userInfo = me.data.name || me.data.login; } catch {}
  const timestamp = new Date().toISOString();
  const enhancedBody = `${body}\n\n---\n*Added via Quick Notes by ${userInfo} at ${timestamp}*`;
  const resp = await octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: enhancedBody });
  if (projectNodeId) {
    try {
      const issueNodeQuery = `
        query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { issue(number: $number) { id } } }
      `;
      const issueNodeData = await octokit.graphql<{ repository?: { issue?: { id: string } | null } | null }>(issueNodeQuery, { owner, repo, number: issueNumber });
      const issueId = issueNodeData.repository?.issue?.id;
      if (issueId) {
        const addMutation = `
          mutation($projectId: ID!, $contentId: ID!) { addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } } }
        `;
        const addResult = await octokit.graphql<{ addProjectV2ItemById?: { item?: { id: string } } }>(addMutation, { projectId: projectNodeId, contentId: issueId });
        if (projectStatus && addResult.addProjectV2ItemById?.item?.id) {
          await setProjectStatus(octokit, projectNodeId, addResult.addProjectV2ItemById.item.id, projectStatus);
        }
      }
    } catch (e) { console.warn('Failed to add existing issue to project on comment:', e); }
  }
  return { id: resp.data.id, url: resp.data.html_url, created_at: resp.data.created_at };
}

export async function fetchProject(token: string, org: string, number: number): Promise<ProjectInfo> {
  requireToken(token);
  const octokit = createOctokit(token);
  const query = `
    query($login: String!, $number: Int!) { organization(login: $login) { projectV2(number: $number) { id title shortDescription number } } }
  `;
  const data = await octokit.graphql<{ organization?: { projectV2?: { id: string; title?: string; shortDescription?: string | null; number?: number } | null } }>(query, { login: org, number });
  const p = data.organization?.projectV2;
  if (!p) throw new Error('Project not found');
  return { id: p.id, name: p.title || 'Untitled Project', body: p.shortDescription || null, number: p.number };
}

// Public model catalog (no org scoping needed but keep signature stable)
export async function listModels(token: string): Promise<{ id: string; label: string }[]> {
  requireToken(token); // keep signature parity even though token not needed for static file
  try {
    // Use current URL origin for fetch
    const url = `${window.location.origin}/models-catalog.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`local catalog status ${res.status}`);
    const data: unknown = await res.json();
    // Narrow unknown JSON shape to expected catalog structure without using 'any'
    type CatalogData = { models?: unknown };
    const catalog: CatalogData = (data && typeof data === 'object') ? (data as CatalogData) : {};
    const rawList: Array<{ id?: string; label?: string }> = Array.isArray(catalog.models)
      ? catalog.models.filter((m): m is { id?: string; label?: string } => !!m && typeof m === 'object')
      : [];
    const cleaned = rawList
      .filter(m => (m.id || m.label))
      .map(m => ({ id: (m.id || '').trim(), label: (m.label || m.id || '').trim() }))
      .filter(m => m.id);
    if (cleaned.length) return cleaned;
    throw new Error('empty snapshot');
  } catch (e) {
    console.warn('Using curated fallback models (snapshot unavailable):', e);
    return CURATED_MODELS;
  }
}
