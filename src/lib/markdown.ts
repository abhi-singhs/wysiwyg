import { marked, Renderer, Tokens } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Basic slugify function (no external dep) matching GitHub-ish behavior
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Configure marked once
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer for GitHub-flavored structure & extra semantics
const renderer = new Renderer();

renderer.heading = (token: Tokens.Heading) => {
  const raw = token.raw?.replace(/^#+\s*/, '') || token.text;
  const id = slugify(raw);
  const base = `h${token.depth}`;
  const inner = marked.parser(token.tokens ?? []);
  return `<${base} id="${id}" class="md-heading md-h${token.depth}"><a href="#${id}" class="md-anchor" aria-hidden="true">#</a>${inner}</${base}>`;
};

renderer.code = (token: Tokens.Code) => {
  const lang = token.lang || '';
  const cls = lang ? `language-${lang}` : 'no-lang';
  const escaped = token.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre class="md-code-block"><code class="${cls}">${escaped}\n</code></pre>`;
};

renderer.table = (token: Tokens.Table) => {
  const header = `<thead>${token.header.map(h => `<th>${marked.parser(h.tokens)}</th>`).join('')}</thead>`;
  const body = `<tbody>${token.rows.map(r => `<tr>${r.map(c => `<td>${marked.parser(c.tokens)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="md-table-wrapper"><table>${header}${body}</table></div>`;
};

renderer.blockquote = (token: Tokens.Blockquote) => {
  const inner = marked.parser(token.tokens);
  return `<blockquote class="md-blockquote">${inner}</blockquote>`;
};

renderer.list = (token: Tokens.List) => {
  const tag = token.ordered ? 'ol' : 'ul';
  const startAttr = token.ordered && token.start && token.start > 1 ? ` start="${token.start}"` : '';
  const body = token.items.map(it => renderer.listitem!(it)).join('');
  return `<${tag} class="md-list"${startAttr}>${body}</${tag}>`;
};

renderer.listitem = (item: Tokens.ListItem) => `<li class=\"md-li\">${marked.parser(item.tokens)}</li>`;

renderer.codespan = (token: Tokens.Codespan) => `<code class=\"md-inline-code\">${token.text}</code>`;

renderer.hr = () => '<hr class=\"md-hr\" />';

renderer.link = (token: Tokens.Link) => {
  const safeHref = token.href || '#';
  const t = token.title ? ` title=\"${token.title}\"` : '';
  const inner = marked.parser(token.tokens ?? []);
  const isExternal = /^https?:\/\//i.test(safeHref);
  const rel = isExternal ? ' rel=\"noopener noreferrer\"' : '';
  const target = isExternal ? ' target=\"_blank\"' : '';
  return `<a class=\"md-link\" href=\"${safeHref}\"${t}${rel}${target}>${inner}</a>`;
};

renderer.image = (token: Tokens.Image) => {
  const safeHref = token.href || '';
  const t = token.title ? ` title=\"${token.title}\"` : '';
  const alt = token.text || '';
  return `<figure class=\"md-image-wrapper\"><img src=\"${safeHref}\" alt=\"${alt}\"${t} /><figcaption class=\"md-image-caption\">${alt}</figcaption></figure>`;
};

export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { renderer });
  return DOMPurify.sanitize(raw as string, { USE_PROFILES: { html: true } });
}

export function markdownToHtml(markdown: string): string {
  return renderMarkdown(markdown);
}
