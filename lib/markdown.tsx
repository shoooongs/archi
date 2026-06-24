import type { ReactNode } from 'react';

// ─── Strip HTML to plain text (for list previews) ────────────────────────────

export function stripHtml(html: string): string {
  if (!html.includes('<')) return html;
  if (typeof document !== 'undefined') {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || '';
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Strip markdown to plain text (legacy, kept for reference) ───────────────

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^-{3,}$|^\*{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Inline renderer: **bold**, *italic*, `code` ─────────────────────────────

function renderInline(text: string, key: string): ReactNode {
  const chunks: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0, n = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) chunks.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if      (m[1] !== undefined || m[2] !== undefined)
      chunks.push(<strong key={k}>{m[1] ?? m[2]}</strong>);
    else if (m[3] !== undefined)
      chunks.push(<code key={k} className="font-mono text-[0.87em] px-[0.35em] py-[0.1em] rounded bg-black/[0.07] dark:bg-white/10">{m[3]}</code>);
    else
      chunks.push(<em key={k}>{m[4] ?? m[5]}</em>);
    last = m.index + m[0].length;
  }

  if (last < text.length) chunks.push(text.slice(last));
  return chunks.length === 1 ? chunks[0] : chunks;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

export function Markdown({
  content,
  dk,
  className,
}: {
  content: string;
  dk: boolean;
  className?: string;
}) {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      const lvl  = hm[1].length;
      const text = hm[2];
      const base = `font-bold leading-tight ${dk ? 'text-white/90' : 'text-black/88'}`;
      const size = lvl === 1 ? 'text-[1.45em] mt-6 mb-2'
                 : lvl === 2 ? 'text-[1.2em] mt-5 mb-1.5'
                 :             'text-[1.05em] mt-4 mb-1';
      const el = lvl === 1
        ? <h1 key={i} className={`${base} ${size}`}>{renderInline(text, `h${i}`)}</h1>
        : lvl === 2
        ? <h2 key={i} className={`${base} ${size}`}>{renderInline(text, `h${i}`)}</h2>
        : <h3 key={i} className={`${base} ${size}`}>{renderInline(text, `h${i}`)}</h3>;
      nodes.push(el); i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className={`border-l-2 pl-4 my-3 italic leading-relaxed ${dk ? 'border-white/22 text-white/52' : 'border-black/18 text-black/50'}`}>
          {renderInline(line.slice(2), `bq${i}`)}
        </blockquote>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      nodes.push(<hr key={i} className={`my-5 ${dk ? 'border-white/10' : 'border-black/8'}`} />);
      i++; continue;
    }

    // Unordered list — collect consecutive
    if (/^[-*+]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].slice(2), `li${i}`)}</li>);
        i++;
      }
      nodes.push(
        <ul key={`ul${i}`} className={`my-2 ml-5 list-disc space-y-0.5 ${dk ? 'text-white/72' : 'text-black/68'}`}>
          {items}
        </ul>
      );
      continue;
    }

    // Ordered list — collect consecutive
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\.\s/, ''), `oli${i}`)}</li>);
        i++;
      }
      nodes.push(
        <ol key={`ol${i}`} className={`my-2 ml-5 list-decimal space-y-0.5 ${dk ? 'text-white/72' : 'text-black/68'}`}>
          {items}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (nodes.length > 0) nodes.push(<div key={`sp${i}`} className="h-3" />);
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className={`leading-[1.82] my-px ${dk ? 'text-white/72' : 'text-black/68'}`}>
        {renderInline(line, `p${i}`)}
      </p>
    );
    i++;
  }

  return <div className={className}>{nodes}</div>;
}
