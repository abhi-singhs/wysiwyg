import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { title, body, labels, repoOwner, repoName } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    const owner = repoOwner || process.env.GITHUB_REPO_OWNER || 'github';
    const repo = repoName || process.env.GITHUB_REPO_NAME || 'solutions-engineering';

  const octokit = createOctokit(token);

    // Get user info for attribution
    let userInfo = 'Unknown User';
    try {
      const userResponse = await octokit.rest.users.getAuthenticated();
      userInfo = userResponse.data.name || userResponse.data.login;
    } catch (error) {
      console.warn('Could not get user info (likely missing user scope on fine-grained PAT):', error);
    }

    // Add timestamp and author info to the body
    const timestamp = new Date().toISOString();
    const enhancedBody = `${body}\n\n---\n*Created via Quick Notes by ${userInfo} at ${timestamp}*`;

    let response;
    try {
      response = await octokit.rest.issues.create({
        owner,
        repo,
        title,
        body: enhancedBody,
        labels: labels || [],
      });
    } catch (err: unknown) {
      const mapped = mapGitHubError(err);
      if (mapped.status === 403) {
        return NextResponse.json({ error: 'Token lacks Issues: write access for this repository' }, { status: 403 });
      }
      if (mapped.status === 404) {
        return NextResponse.json({ error: 'Repository not found or inaccessible with this token' }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({
      number: response.data.number,
      url: response.data.html_url,
      title: response.data.title,
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}