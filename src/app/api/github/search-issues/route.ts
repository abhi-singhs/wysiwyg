import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

interface GqlIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  updatedAt: string;
}
interface GqlSearchEdge { node?: GqlIssueNode }
interface GqlSearchResult { search?: { edges?: GqlSearchEdge[] } }

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const repoOwner = searchParams.get('owner') || process.env.GITHUB_REPO_OWNER || 'github';
    const repoName = searchParams.get('repo') || process.env.GITHUB_REPO_NAME || 'solutions-engineering';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    const octokit = createOctokit(token);

    let searchQuery = `repo:${repoOwner}/${repoName} ${query} in:title,body`;
    if (!/\bis:(issue|pull-request)\b/.test(searchQuery)) {
      searchQuery += ' is:issue';
    }
    const gql = `
      query($searchQuery: String!, $first: Int!) {
        search(type: ISSUE, query: $searchQuery, first: $first) {
          edges {
            node {
              ... on Issue {
                number
                title
                url
                state
                updatedAt
              }
            }
          }
        }
      }
    `;
    try {
  const data = await octokit.graphql<GqlSearchResult>(gql, { searchQuery, first: 5 });
      const edges = data.search?.edges ?? [];
      const issues = edges
        .map(e => e.node)
        .filter((n): n is GqlIssueNode => !!n)
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          url: issue.url,
          state: issue.state,
          updated_at: issue.updatedAt,
        }));
      return NextResponse.json({ issues });
    } catch (err: unknown) {
      const mapped = mapGitHubError(err);
      // GraphQL returns 200 with errors array sometimes; if so, treat as 422 when query invalid
      if (typeof err === 'object' && err && 'errors' in err) {
        return NextResponse.json({ error: 'Invalid search query.' }, { status: 422 });
      }
      if (mapped.status === 403) {
        return NextResponse.json({ error: 'Token lacks Issues: read access for this repository' }, { status: 403 });
      }
      if (mapped.status === 404) {
        return NextResponse.json({ error: 'Repository not found or inaccessible with this token' }, { status: 404 });
      }
      if (mapped.status === 422) {
        return NextResponse.json({ error: 'Invalid search query.' }, { status: 422 });
      }
      throw err;
    }
    // early return occurs in try above
  } catch (error) {
    console.error('Error searching issues:', error);
    return NextResponse.json(
      { error: 'Failed to search issues' },
      { status: 500 }
    );
  }
}