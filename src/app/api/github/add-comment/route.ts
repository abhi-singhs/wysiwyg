import { NextRequest, NextResponse } from 'next/server';
import { createOctokit, mapGitHubError } from '@/lib/octokit';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  const { issueNumber, body, repoOwner, repoName, projectNodeId, projectStatus } = await request.json();

    if (!issueNumber || !body) {
      return NextResponse.json(
        { error: 'Issue number and body are required' },
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

    // Add timestamp and author info to the comment
    const timestamp = new Date().toISOString();
    const enhancedBody = `${body}\n\n---\n*Added via Quick Notes by ${userInfo} at ${timestamp}*`;

    let response;
    try {
      response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: enhancedBody,
      });
    } catch (err: unknown) {
      const mapped = mapGitHubError(err);
      if (mapped.status === 403) {
        return NextResponse.json({ error: 'Token lacks Issues: write access for this repository' }, { status: 403 });
      }
      if (mapped.status === 404) {
        return NextResponse.json({ error: 'Repository or issue not found or inaccessible with this token' }, { status: 404 });
      }
      throw err;
    }

    // Optionally add to project if projectNodeId provided (best-effort, ignore errors)
    if (projectNodeId) {
      try {
        const issueNodeQuery = `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) { issue(number: $number) { id } }
          }
        `;
        const issueNodeData = await octokit.graphql<{ repository?: { issue?: { id: string } | null } | null }>(issueNodeQuery, {
          owner,
          repo,
          number: issueNumber,
        });
        const issueId = issueNodeData.repository?.issue?.id;
        if (issueId) {
          const addIssueMutation = `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
            }
          `;
          const addResult = await octokit.graphql<{ addProjectV2ItemById?: { item?: { id: string } } }>(addIssueMutation, { projectId: projectNodeId, contentId: issueId });
          if (projectStatus && addResult?.addProjectV2ItemById?.item?.id) {
            try {
              const projectFieldsQuery = `
                query($projectId: ID!) {
                  node(id: $projectId) {
                    ... on ProjectV2 { fields(first: 50) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } }
                  }
                }
              `;
              type SingleSelectField = { id: string; name?: string; options?: Array<{ id: string; name: string }> };
              const fieldsData = await octokit.graphql<{ node?: { fields?: { nodes?: SingleSelectField[] } } }>(projectFieldsQuery, { projectId: projectNodeId });
              const selectField = fieldsData.node?.fields?.nodes?.find(f => f.name === 'Status' && f.options && Array.isArray(f.options));
              const optionValue = projectStatus === 'in-progress' ? 'In Progress' : projectStatus === 'done' ? 'Done' : 'No Status';
              if (selectField && selectField.options) {
                const option = selectField.options.find(o => o.name.toLowerCase() === optionValue.toLowerCase());
                if (option) {
                  const setStatusMutation = `
                    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                      updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
                    }
                  `;
                  await octokit.graphql(setStatusMutation, { projectId: projectNodeId, itemId: addResult.addProjectV2ItemById.item.id, fieldId: selectField.id, optionId: option.id });
                }
              }
            } catch (e) {
              console.warn('Failed to set project status on comment:', e);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to add existing issue to project on comment:', err);
      }
    }

    return NextResponse.json({
      id: response.data.id,
      url: response.data.html_url,
      created_at: response.data.created_at,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}