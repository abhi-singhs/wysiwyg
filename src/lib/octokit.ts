import { Octokit } from '@octokit/rest';

/**
 * Factory for Octokit instances configured for fine-grained PATs.
 * Adds recommended preview + API version headers. Centralizes future tweaks (e.g. retry, throttling).
 */
export function createOctokit(token: string) {
  return new Octokit({
    auth: token,
    userAgent: 'quick-notes-app',
    request: {
      // Explicit API version header for forward compatibility
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        // Accept header ensures we get consistent fields (especially for fine-grained tokens)
        Accept: 'application/vnd.github+json',
      },
    },
  });
}

export function mapGitHubError(err: unknown): { status: number; message: string } {
  const status = typeof err === 'object' && err && 'status' in err ? (err as { status?: number }).status || 500 : 500;
  if (status === 401) return { status, message: 'Unauthorized: token invalid or expired' };
  if (status === 403) return { status, message: 'Forbidden: token lacks required repository permissions' };
  if (status === 404) return { status, message: 'Not found: repository or resource inaccessible with this token' };
  if (status === 422) return { status, message: 'Unprocessable: invalid query or payload' };
  return { status: 500, message: 'GitHub API request failed' };
}
