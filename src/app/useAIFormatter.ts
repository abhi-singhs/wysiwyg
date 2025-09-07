import { useCallback, useRef, useState } from 'react';

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
      const params = new URLSearchParams();
      params.set('stream', '1');
      if (orgOwner) params.set('orgOwner', orgOwner);
      if (modelId) params.set('modelId', modelId);
      const resp = await fetch(`/api/github/format-notes?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, modelId, systemPrompt }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`Streaming failed (${resp.status})`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = decoder.decode(value, { stream: true });
        // Split SSE events (blank line separated)
        const events = chunk.split(/\n\n/).filter(Boolean);
        for (const evt of events) {
          if (evt.startsWith('event: end')) break outer;
          if (evt.startsWith('event: error')) {
            const line = evt.split('\n').find(l => l.startsWith('data: '));
            if (line) setError(line.substring(6).trim());
            break outer;
          }
          if (!evt.startsWith('data: ')) continue; // ignore non-data lines
          let payload = evt.substring(6).trim();
          // Some upstream lines may already include an inner 'data: ' prefix; strip one more time.
          if (payload.startsWith('data: ')) payload = payload.substring(6).trim();
          if (payload === '[DONE]') break outer;
          let extracted = '';
          try {
            type DeltaLike = { content?: unknown; text?: unknown } | string;
            type ChoiceLike = { delta?: DeltaLike; message?: DeltaLike };
            interface ObjectLike { [k: string]: unknown; choices?: ChoiceLike[]; delta?: DeltaLike; message?: DeltaLike; content?: unknown; text?: unknown; }
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
            // Not JSON; ignore unless first accumulation (to avoid clutter)
            if (!acc) extracted += payload;
          }
          if (extracted) {
            acc += extracted;
            setFormatted(acc);
          }
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
