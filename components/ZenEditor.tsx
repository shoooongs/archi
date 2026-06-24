'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { MemoItem } from '@/lib/types';

// ─── Icon ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHtml(text: string): string {
  if (!text.trim()) return '';
  if (text.includes('<')) return text;
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function getAncestorBlockTag(editor: HTMLDivElement | null): string {
  if (!editor) return 'p';
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 'p';
  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'blockquote', 'p'].includes(tag)) return tag;
    }
    node = node.parentNode;
  }
  return 'p';
}

// ─── Toolbar config ───────────────────────────────────────────────────────────

interface ToolbarItem {
  id: string;
  label: string;
  tag: string;
  title: string;
  cmd?: string; // execCommand for inline formats (bold, underline, etc.)
}

const TOOLBAR: ToolbarItem[] = [
  { id: 'p',    label: 'P',  tag: 'p',          title: '본문'   },
  { id: 'h1',   label: 'H1', tag: 'h1',         title: '제목 1' },
  { id: 'h2',   label: 'H2', tag: 'h2',         title: '제목 2' },
  { id: 'h3',   label: 'H3', tag: 'h3',         title: '제목 3' },
  { id: 'sep1', label: '|',  tag: '',            title: ''       },
  { id: 'bq',   label: '❝',  tag: 'blockquote', title: '인용구' },
  { id: 'hr',   label: '—',  tag: 'hr',         title: '구분선' },
  { id: 'sep2', label: '|',  tag: '',            title: ''       },
  { id: 'bold', label: 'B',  tag: '',            title: '굵게',   cmd: 'bold'                  },
  { id: 'ul',   label: 'U',  tag: '',            title: '밑줄',   cmd: 'underline'             },
  { id: 'list', label: '•',  tag: '',            title: '목록',   cmd: 'insertUnorderedList'   },
];

// ─── ZenEditor ───────────────────────────────────────────────────────────────

export interface ZenEditorProps {
  memo: MemoItem;
  onBack: () => void;
  onSave: (title: string, body: string) => void;
}

export default function ZenEditor({ memo, onBack, onSave }: ZenEditorProps) {
  const { state } = useStore();
  const dk = state.settings.darkMode;

  const [title,       setTitle]       = useState(memo.title ?? '');
  const [isDirty,     setIsDirty]     = useState(false);
  const [entered,     setEntered]     = useState(false);
  const [exiting,     setExiting]     = useState(false);
  const [activeBlock, setActiveBlock] = useState<string>('p');

  const editorRef     = useRef<HTMLDivElement>(null);
  const savedHtmlRef  = useRef(toHtml(memo.text));
  const savedTitleRef = useRef(memo.title ?? '');

  // Slide-in from right
  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  // Seed contentEditable once on mount (uncontrolled after this)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = savedHtmlRef.current;
    if (!el.innerHTML) el.innerHTML = '<p><br></p>';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track current block format on selection change
  useEffect(() => {
    function onSelChange() {
      if (!editorRef.current) return;
      setActiveBlock(getAncestorBlockTag(editorRef.current));
    }
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  function recomputeDirty(overrideTitle?: string) {
    const html = editorRef.current?.innerHTML ?? '';
    const t    = overrideTitle !== undefined ? overrideTitle : title;
    setIsDirty(html !== savedHtmlRef.current || t !== savedTitleRef.current);
  }

  function handleSave() {
    const html = editorRef.current?.innerHTML ?? '';
    const t    = title.trim();
    const hasText = html.replace(/<[^>]*>/g, '').trim();
    if (!hasText) return;
    onSave(t, html);
    savedHtmlRef.current  = html;
    savedTitleRef.current = t;
    setIsDirty(false);
  }

  function handleBack() {
    if (isDirty) handleSave();
    setExiting(true);
    setTimeout(onBack, 270);
  }

  function applyFormat(item: ToolbarItem) {
    const el = editorRef.current;
    if (!el) return;

    // Preserve selection across focus call
    const sel   = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    el.focus();

    if (range && sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    if (item.cmd) {
      // Inline formats: bold, underline, insertUnorderedList
      document.execCommand(item.cmd, false);
    } else if (item.tag === 'hr') {
      document.execCommand('insertHorizontalRule', false);
    } else {
      const current = getAncestorBlockTag(el);
      // Toggle: if already this block type (except P), revert to P
      const target = current === item.tag && item.tag !== 'p' ? 'p' : item.tag;
      document.execCommand('formatBlock', false, target);
    }

    requestAnimationFrame(() => {
      if (!el) return;
      setActiveBlock(getAncestorBlockTag(el));
      recomputeDirty();
    });
  }

  const transform = exiting ? 'translateX(100%)' : entered ? 'translateX(0)' : 'translateX(100%)';
  const textBase  = dk ? 'text-white/72' : 'text-black/68';

  function toolbarBtnCls(isActive: boolean) {
    const base = 'px-2 py-1.5 rounded text-xs transition-colors flex-shrink-0 font-medium';
    if (isActive) {
      return `${base} ${dk ? 'bg-white/14 text-white/85' : 'bg-black/8 text-black/75'}`;
    }
    return `${base} ${dk
      ? 'text-white/35 hover:text-white/68 hover:bg-white/8 active:bg-white/14'
      : 'text-black/32 hover:text-black/65 hover:bg-black/5 active:bg-black/10'}`;
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col overflow-hidden ${dk ? 'bg-neutral-950' : 'bg-[#fafaf8]'}`}
      style={{
        paddingTop:    'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform,
        transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={`relative flex items-center justify-between px-4 py-2 flex-shrink-0 border-b ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`}>
        <button
          onClick={handleBack}
          className={`flex items-center gap-1.5 text-xs transition-colors ${dk ? 'text-white/42 hover:text-white/72' : 'text-black/38 hover:text-black/65'}`}
        >
          <BackIcon />
          <span>뒤로</span>
        </button>

        {/* Save status — centered */}
        <span className={`absolute left-1/2 -translate-x-1/2 text-[0.64rem] font-medium pointer-events-none transition-colors duration-300 ${
          isDirty
            ? dk ? 'text-amber-400/80' : 'text-amber-600/76'
            : dk ? 'text-emerald-400/68' : 'text-emerald-600/68'
        }`}>
          {isDirty ? '수정 중' : '저장됨'}
        </span>

        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`text-xs font-semibold transition-all ${
            isDirty
              ? dk ? 'text-white/80 hover:text-white' : 'text-black/70 hover:text-black'
              : dk ? 'text-white/16 cursor-not-allowed' : 'text-black/14 cursor-not-allowed'
          }`}
        >
          저장
        </button>
      </div>

      {/* ── Formatting toolbar ──────────────────────────────────────────── */}
      <div className={`flex items-center px-2.5 py-1 flex-shrink-0 border-b overflow-x-auto gap-0.5 ${dk ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
        {TOOLBAR.map((item) => {
          const { id, label, tag, title: tip, cmd } = item;
          if (label === '|') {
            return (
              <span key={id} className={`w-px h-3.5 mx-1 flex-shrink-0 ${dk ? 'bg-white/12' : 'bg-black/10'}`} />
            );
          }
          const isActive = cmd ? false : tag !== 'hr' && activeBlock === tag;
          return (
            <button
              key={id}
              title={tip}
              onMouseDown={(e) => { e.preventDefault(); applyFormat(item); }}
              onTouchStart={(e) => { e.preventDefault(); applyFormat(item); }}
              className={[
                toolbarBtnCls(isActive),
                id === 'bold' ? 'font-bold' : '',
                id === 'ul'   ? 'underline' : '',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Editor content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-16">

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); recomputeDirty(e.target.value); }}
            placeholder="제목"
            spellCheck={false}
            autoComplete="off"
            className={[
              'w-full bg-transparent outline-none font-bold tracking-tight mb-4 block',
              'text-[1.08rem] leading-snug',
              dk ? 'text-white/92 placeholder:text-white/16' : 'text-black/90 placeholder:text-black/14',
            ].join(' ')}
          />

          <div className={`mb-4 border-t ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`} />

          {/* contentEditable body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => recomputeDirty()}
            data-placeholder="내용을 입력하세요..."
            className={[
              'rich-editor',
              'leading-relaxed tracking-tight',
              dk ? `${textBase} rich-editor-dk` : textBase,
            ].join(' ')}
            style={{ fontSize: '0.75rem' }}
          />

        </div>
      </div>
    </div>
  );
}
