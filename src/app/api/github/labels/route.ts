import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { searchParams } = new URL(request.url);
    const repoOwner = searchParams.get('owner') || process.env.GITHUB_REPO_OWNER || 'github';
    const repoName = searchParams.get('repo') || process.env.GITHUB_REPO_NAME || 'solutions-engineering';

    const octokit = createOctokit(token);

    let labels;
    try {
      labels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
        owner: repoOwner,
        repo: repoName,
        per_page: 100,
      });
  } catch (err: unknown) {
      const mapped = mapGitHubError(err);
      if (mapped.status === 403) {
        return NextResponse.json({ error: 'Token lacks Issues: read access for this repository' }, { status: 403 });
      }
      if (mapped.status === 404) {
        return NextResponse.json({ error: 'Repository not found or inaccessible with this token' }, { status: 404 });
      }
      throw err;
    }

    const formattedLabels = labels.map(label => ({
      name: label.name,
      color: label.color,
      description: label.description,
    }));

    return NextResponse.json({ labels: formattedLabels });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}