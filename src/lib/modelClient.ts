import ModelClient from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';

const DEFAULT_MODEL_ID = 'openai/gpt-4.1';

export interface ModelClientConfig {
  token: string;
  modelId?: string;
  orgOwner?: string; // maps to GitHub org/owner for multi-org endpoints
}

export function createModelClient({ token, modelId, orgOwner }: ModelClientConfig) {
  const owner = orgOwner || process.env.GITHUB_REPO_OWNER || 'github';
  const endpoint = `https://models.github.ai/orgs/${owner}/inference`;
  const client = ModelClient(endpoint, new AzureKeyCredential(token));
  return { client, model: modelId || DEFAULT_MODEL_ID, endpoint };
}

export const MODEL_SYSTEM_PROMPT = `You are an assistant that reformats raw, messy engineering meeting or troubleshooting notes into clean, concise, well-structured GitHub issue/comment ready Markdown.

Guidelines:
1. Preserve ALL technical details (commands, error messages, versions, URLs, code, logs).
2. Organize using clear sections: Summary, Context, Steps Performed, Findings / Observations, Root Cause (if known), Next Actions, References.
3. Convert ad-hoc bullets into consistent markdown lists.
4. Use fenced code blocks for multiline commands or logs; specify language when obvious (bash, json, diff, ts).
5. Never fabricate information; if something is ambiguous, note it under an 'Open Questions' section.
6. Keep line width reasonable (< 100 chars) and remove trailing spaces.
7. Do not add decorative emojis or marketing tone.
8. If content already looks structured, lightly improve without drastic restructuring.

Return ONLY the Markdown body; no surrounding commentary.`;

export function buildMessages(content: string) {
  return [
    { role: 'system', content: MODEL_SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}
