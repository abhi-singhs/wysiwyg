"use client";
import { useMemo } from 'react';
import { markdownToHtml } from '../lib/markdown';

interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className = '' }: MarkdownProps) {
  const html = useMemo(() => markdownToHtml(source || ''), [source]);
  return (
    <div
      className={`markdown-body text-sm ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Markdown;
