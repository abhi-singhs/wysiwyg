// Default model id used throughout the app
export const DEFAULT_MODEL_ID = 'openai/gpt-4.1';

// Default system prompt (exported so UI can show & reset)
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

export function buildMessages(content: string, systemPrompt?: string) {
  return [
    { role: 'system', content: systemPrompt || MODEL_SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}

// Curated list of common model ids (could later be fetched dynamically from models API)
export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: 'openai/gpt-4.1', label: 'OpenAI GPT-4.1' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'LLaMA 3.1 70B Instruct' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'LLaMA 3.1 8B Instruct' },
  { id: 'mistral/mistral-large', label: 'Mistral Large' },
];
