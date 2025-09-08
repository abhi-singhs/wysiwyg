import { useCallback, useRef, useState } from 'react';
import { DEFAULT_MODEL_ID, buildMessages } from '@/lib/modelClient';

interface UseAIFormatterOptions {
  token: string | null;
  orgOwner?: string; // GitHub org/owner for multi-org endpoints
  modelId?: string;
  systemPrompt?: string;
}

export interface AIFormatterState {
  formatted: string;
  isFormatting: boolean;
  error: string | null;
  start: (content: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

export function useAIFormatter({ token, orgOwner, modelId, systemPrompt }: UseAIFormatterOptions): AIFormatterState {
  const [formatted, setFormatted] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setFormatted('');
    setIsFormatting(false);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async (content: string) => {
    if (!token) {
      setError('Missing token');
      return;
    }
    if (!content.trim()) {
      setError('Nothing to format');
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFormatted('');
    setError(null);
    setIsFormatting(true);
    try {
      const owner = orgOwner || 'github';
      const model = (modelId || DEFAULT_MODEL_ID).trim();
      const endpoint = `https://models.github.ai/orgs/${owner}/inference/chat/completions`;
      const resp = await fetch(endpoint, {
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
          messages: buildMessages(content, systemPrompt),
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`Streaming failed (${resp.status})`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split(/\n/).filter(Boolean);
  for (const rawLine of lines) {
          let line = rawLine.trim();
          if (!line) continue;
          const doneSignal = line === '[DONE]';
          // OpenAI / GitHub Models style SSE sometimes prefixes 'data: '
          if (line.startsWith('data: ')) line = line.substring(6).trim();
          if (line === '[DONE]') break outer;
          let extracted = '';
          try {
            type DeltaLike = { content?: unknown; text?: unknown } | string;
            type ChoiceLike = { delta?: DeltaLike; message?: DeltaLike };
            interface ObjectLike { [k: string]: unknown; choices?: ChoiceLike[]; delta?: DeltaLike; message?: DeltaLike; content?: unknown; text?: unknown; }
            const payload = line;
            const json = JSON.parse(payload) as unknown;
            const pushDelta = (d: unknown) => {
              if (!d) return;
              if (typeof d === 'string') { extracted += d; return; }
              if (typeof d === 'object') {
                const obj = d as ObjectLike;
                if (typeof obj.content === 'string') extracted += obj.content;
                else if (Array.isArray(obj.content)) {
                  extracted += obj.content.map((c) => {
                    if (typeof c === 'string') return c;
                    if (typeof c === 'object' && c && 'text' in c && typeof (c as { text?: unknown }).text === 'string') return (c as { text: string }).text;
                    return '';
                  }).join('');
                } else if (typeof obj.text === 'string') extracted += obj.text;
              }
            };
            if (Array.isArray(json)) {
              for (const item of json) {
                if (item && typeof item === 'object' && 'delta' in item) {
                  pushDelta((item as { delta?: DeltaLike }).delta);
                } else if (item && typeof item === 'object' && 'choices' in item) {
                  const choices = (item as { choices?: ChoiceLike[] }).choices;
                  if (Array.isArray(choices)) {
                    for (const c of choices) pushDelta(c.delta || c.message);
                  }
                } else pushDelta(item);
              }
            } else if (json && typeof json === 'object') {
              const obj = json as ObjectLike;
              if (Array.isArray(obj.choices)) {
                for (const c of obj.choices) pushDelta(c.delta || c.message);
              } else if ('delta' in obj) pushDelta(obj.delta);
              else if ('message' in obj) pushDelta(obj.message);
              else pushDelta(obj);
            } else if (typeof json === 'string') extracted += json;
          } catch {
            if (!acc) extracted += line; // raw fallback
          }
          if (extracted) { acc += extracted; setFormatted(acc); }
          if (doneSignal) break outer;
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message || 'Formatting failed');
      }
    } finally {
      setIsFormatting(false);
    }
  }, [token, orgOwner, modelId, systemPrompt]);

  return { formatted, isFormatting, error, start, abort, reset };
}
