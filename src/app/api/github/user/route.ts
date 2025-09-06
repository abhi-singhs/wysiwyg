import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const octokit = createOctokit(token);

    try {
      const response = await octokit.rest.users.getAuthenticated();
      return NextResponse.json({
        login: response.data.login,
        name: response.data.name,
        email: response.data.email || null,
        avatar_url: response.data.avatar_url,
      });
  } catch (err: unknown) {
      // Fine-grained tokens without user:read may 403. We still want to signal token validity (can't truly verify).
      const mapped = mapGitHubError(err);
      if (mapped.status === 403) {
        return NextResponse.json({
          error: 'Token valid but lacks user:read scope. Please grant "User permissions: Email addresses (read)" to display profile.',
        }, { status: 403 });
      }
      throw err; // fall through to generic handler
    }
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { error: 'Invalid token or failed to authenticate' },
      { status: 401 }
    );
  }
}