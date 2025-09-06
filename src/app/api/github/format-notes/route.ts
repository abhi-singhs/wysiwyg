import { NextRequest, NextResponse } from 'next/server';
import { isUnexpected, ChatCompletionsOutput } from '@azure-rest/ai-inference';
import { createModelClient, buildMessages } from '@/lib/modelClient';

// Model id centralized in createModelClient

// buildMessages imported from lib

function extractMarkdown(body: ChatCompletionsOutput): string | null {
  const choice = body.choices && body.choices.length > 0 ? body.choices[0] : undefined;
  const rawContent: unknown = choice?.message?.content as unknown;
  if (typeof rawContent === 'string') return rawContent;
  if (Array.isArray(rawContent)) {
    type TextPart = { text?: string } | string;
    const parts: string[] = [];
    for (const part of rawContent as TextPart[]) {
      if (typeof part === 'string') parts.push(part);
      else if (part && typeof part === 'object' && typeof part.text === 'string') parts.push(part.text);
    }
    return parts.join('\n');
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    const { content } = await request.json();
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Basic size guard (model cost/perf)
    if (content.length > 8000) {
      return NextResponse.json({ error: 'Notes too long (limit ~8000 chars before formatting).' }, { status: 413 });
    }
    const { searchParams } = new URL(request.url);
    const wantsStream = searchParams.get('stream') === '1';
  const owner = searchParams.get('orgOwner') || process.env.GITHUB_REPO_OWNER || 'github';
  
  const { client, model, endpoint } = createModelClient({ token, orgOwner: owner });

    if (!wantsStream) {
      const response = await client.path('/chat/completions').post({
        body: {
          model,
          temperature: 0.2,
          top_p: 1,
          messages: buildMessages(content),
        },
      });
      if (isUnexpected(response)) {
        const respUnknown = response as unknown as { status?: number | string };
        const rawStatus = respUnknown.status;
        const statusCode = typeof rawStatus === 'number' ? rawStatus : 500;
        console.error('Model API error status', rawStatus, response.body);
        return NextResponse.json({ error: 'Model request failed' }, { status: statusCode });
      }
      const markdown = extractMarkdown(response.body as ChatCompletionsOutput);
      if (!markdown) return NextResponse.json({ error: 'Empty model response' }, { status: 502 });
      return NextResponse.json({ markdown });
    }

    // Streaming mode: we can't rely on SDK high-level; use fetch to raw endpoint with stream=true if supported.
    // Fallback approach: call same endpoint and progressively enqueue the full response once (pseudo-stream) if true streaming unsupported.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
  const resp = await fetch(`${endpoint}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                model,
                temperature: 0.2,
                top_p: 1,
                stream: true,
        messages: buildMessages(content),
              }),
            });

            if (!resp.ok || !resp.body) {
              controller.enqueue(encoder.encode(`event: error\ndata: Model request failed (${resp.status})\n\n`));
              controller.close();
              return;
            }

            const reader = resp.body.getReader();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                buffer += new TextDecoder().decode(value, { stream: true });
                // Split by newlines for SSE-like events
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  // Forward as generic chunk; client will accumulate plain text
                  controller.enqueue(encoder.encode(`data: ${trimmed}\n\n`));
                }
              }
            }
            if (buffer.trim()) {
              controller.enqueue(encoder.encode(`data: ${buffer.trim()}\n\n`));
            }
            controller.enqueue(encoder.encode('event: end\n\n'));
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${(e as Error).message}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    console.error('Error formatting notes:', err);
    return NextResponse.json({ error: 'Failed to format notes' }, { status: 500 });
  }
}
