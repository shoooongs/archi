'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { MemoItem } from '@/lib/types';

// ─── Icon ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert legacy plain text into HTML paragraphs on first open. */
function toHtml(text: string): string {
  if (!text.trim()) return '';
  if (text.includes('<')) return text;               // already HTML from a prior edit
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ─── Toolbar config ───────────────────────────────────────────────────────────

interface ToolbarItem {
  id: string;
  label: string;
  title: string;
  cmd: string;
  val?: string;
}

const TOOLBAR: ToolbarItem[] = [
  { id: 'p',    label: 'P',  title: '본문',  cmd: 'formatBlock',        val: 'p'  },
  { id: 'h2',   label: 'H2', title: '제목2', cmd: 'formatBlock',        val: 'h2' },
  { id: 'h3',   label: 'H3', title: '제목3', cmd: 'formatBlock',        val: 'h3' },
  { id: 'sep1', label: '|',  title: '',       cmd: ''                              },
  { id: 'bold', label: 'B',  title: '굵게',  cmd: 'bold'                          },
  { id: 'ital', label: 'I',  title: '기울게',cmd: 'italic'                        },
  { id: 'ul',   label: '•',  title: '목록',  cmd: 'insertUnorderedList'           },
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

  const [title,   setTitle]   = useState(memo.title ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);

  const editorRef    = useRef<HTMLDivElement>(null);
  const savedHtmlRef = useRef(toHtml(memo.text));
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
    // Ensure editor starts with at least an empty <p> for cursor
    if (!el.innerHTML) {
      el.innerHTML = '<p><br></p>';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function recomputeDirty(overrideTitle?: string) {
    const html = editorRef.current?.innerHTML ?? '';
    const t    = overrideTitle !== undefined ? overrideTitle : title;
    setIsDirty(html !== savedHtmlRef.current || t !== savedTitleRef.current);
  }

  function handleSave() {
    const html = editorRef.current?.innerHTML ?? '';
    const t    = title.trim();
    // Strip tags to check if there's real content
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

  function applyFormat(cmd: string, val?: string) {
    if (!cmd) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false, val);
    el.focus();
    recomputeDirty();
  }

  const transform = exiting ? 'translateX(100%)' : entered ? 'translateX(0)' : 'translateX(100%)';

  const textBase  = dk ? 'text-white/72'  : 'text-black/68';
  const subtleBtn = dk
    ? 'text-white/38 hover:text-white/72 hover:bg-white/8 active:bg-white/15'
    : 'text-black/36 hover:text-black/68 hover:bg-black/6 active:bg-black/12';

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
      <div className={`relative flex items-center justify-between px-4 py-2.5 flex-shrink-0 border-b ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`}>
        <button
          onClick={handleBack}
          className={`flex items-center gap-1.5 text-sm transition-colors ${dk ? 'text-white/42 hover:text-white/72' : 'text-black/38 hover:text-black/65'}`}
        >
          <BackIcon />
          <span>뒤로</span>
        </button>

        {/* Save status — centered */}
        <span className={`absolute left-1/2 -translate-x-1/2 text-[0.67rem] font-medium pointer-events-none transition-colors duration-300 ${
          isDirty
            ? dk ? 'text-amber-400/82' : 'text-amber-600/78'
            : dk ? 'text-emerald-400/72' : 'text-emerald-600/70'
        }`}>
          {isDirty ? '수정 중' : '저장됨'}
        </span>

        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`text-sm font-semibold transition-all ${
            isDirty
              ? dk ? 'text-white/80 hover:text-white' : 'text-black/70 hover:text-black'
              : dk ? 'text-white/18 cursor-not-allowed' : 'text-black/15 cursor-not-allowed'
          }`}
        >
          저장
        </button>
      </div>

      {/* ── Formatting toolbar ──────────────────────────────────────────── */}
      <div className={`flex items-center px-3 py-1.5 flex-shrink-0 border-b overflow-x-auto gap-0.5 ${dk ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
        {TOOLBAR.map(({ id, label, title: tip, cmd, val }) => {
          if (label === '|') {
            return (
              <span key={id} className={`w-px h-4 mx-1 flex-shrink-0 ${dk ? 'bg-white/14' : 'bg-black/12'}`} />
            );
          }
          return (
            <button
              key={id}
              title={tip}
              onMouseDown={(e) => { e.preventDefault(); applyFormat(cmd, val ?? undefined); }}
              onTouchStart={(e) => { e.preventDefault(); applyFormat(cmd, val ?? undefined); }}
              className={[
                'px-2.5 py-1.5 rounded text-xs transition-colors flex-shrink-0',
                id === 'bold' ? 'font-bold'   : '',
                id === 'ital' ? 'italic'       : '',
                id === 'h2'   ? 'font-bold text-[0.68rem]' : '',
                id === 'h3'   ? 'font-semibold text-[0.68rem]' : '',
                subtleBtn,
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Editor content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[660px] mx-auto px-5 pt-6 pb-16">

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); recomputeDirty(e.target.value); }}
            placeholder="제목"
            spellCheck={false}
            autoComplete="off"
            className={[
              'w-full bg-transparent outline-none font-bold tracking-tight mb-5 block',
              'text-[1.32rem] leading-snug',
              dk ? 'text-white/92 placeholder:text-white/18' : 'text-black/90 placeholder:text-black/16',
            ].join(' ')}
          />

          <div className={`mb-5 border-t ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`} />

          {/* contentEditable body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => recomputeDirty()}
            data-placeholder="내용을 입력하세요..."
            className={[
              'rich-editor',
              'leading-[1.82] text-[0.9375rem]',
              dk ? `${textBase} rich-editor-dk` : textBase,
            ].join(' ')}
          />

        </div>
      </div>
    </div>
  );
}
