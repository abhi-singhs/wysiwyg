import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

interface ProjectV2Node { id: string; title?: string; shortDescription?: string | null; number?: number }

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const { searchParams } = new URL(request.url);
    const org = searchParams.get('org');
    const numberParam = searchParams.get('number');

    if (!org || !numberParam) {
      return NextResponse.json({ error: 'Missing org or number parameter' }, { status: 400 });
    }
    const number = parseInt(numberParam, 10);
    if (Number.isNaN(number)) {
      return NextResponse.json({ error: 'Invalid project number' }, { status: 400 });
    }

    const octokit = createOctokit(token);
    const query = `
      query($login: String!, $number: Int!) {
        organization(login: $login) {
          projectV2(number: $number) { id title shortDescription number }
        }
      }
    `;

    try {
      const data = await octokit.graphql<{ organization?: { projectV2?: ProjectV2Node | null } }>(query, { login: org, number });
      const project = data.organization?.projectV2;
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json({ project: { id: project.id, name: project.title || 'Untitled Project', body: project.shortDescription || null, number: project.number } });
    } catch (err: unknown) {
      const mapped = mapGitHubError(err);
      if (mapped.status === 403) {
        return NextResponse.json({ error: 'Token lacks project read access' }, { status: 403 });
      }
      if (mapped.status === 404) {
        return NextResponse.json({ error: 'Organization or project not found' }, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
