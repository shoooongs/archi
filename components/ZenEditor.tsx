'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useStore } from '@/lib/store';
import { Markdown } from '@/lib/markdown';
import type { MemoItem } from '@/lib/types';

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// ─── ZenEditor ───────────────────────────────────────────────────────────────

export interface ZenEditorProps {
  memo: MemoItem;
  onBack: () => void;
  onSave: (title: string, body: string) => void;
}

export default function ZenEditor({ memo, onBack, onSave }: ZenEditorProps) {
  const { state } = useStore();
  const dk = state.settings.darkMode;

  const [title,      setTitle]     = useState(memo.title ?? '');
  const [body,       setBody]      = useState(memo.text);
  const [savedTitle, setSavedTitle] = useState(memo.title ?? '');
  const [savedBody,  setSavedBody]  = useState(memo.text);
  const [mode,       setMode]      = useState<'write' | 'preview'>('write');
  const [entered,    setEntered]   = useState(false);
  const [exiting,    setExiting]   = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = title !== savedTitle || body !== savedBody;

  // Slide-in from right
  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  // Resize textarea when switching back to write mode
  useEffect(() => {
    if (mode !== 'write') return;
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [mode]);

  function handleBodyChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function handleSave() {
    const t = title.trim(), b = body.trim();
    if (!b) return;
    onSave(t, b);
    setSavedTitle(t);
    setSavedBody(b);
  }

  function handleBack() {
    if (dirty) handleSave();
    // Slide-out, then call onBack
    setExiting(true);
    setTimeout(onBack, 270);
  }

  const transform = exiting
    ? 'translateX(100%)'
    : entered
      ? 'translateX(0)'
      : 'translateX(100%)';

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
        {/* Back */}
        <button
          onClick={handleBack}
          className={`flex items-center gap-1.5 text-sm transition-colors ${dk ? 'text-white/42 hover:text-white/72' : 'text-black/38 hover:text-black/65'}`}
        >
          <BackIcon />
          <span>뒤로</span>
        </button>

        {/* Save status — centered absolutely */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 text-[0.67rem] font-medium pointer-events-none transition-colors duration-300 ${
            dirty
              ? dk ? 'text-amber-400/80' : 'text-amber-600/75'
              : dk ? 'text-emerald-400/72' : 'text-emerald-600/68'
          }`}
        >
          {dirty ? '수정 중' : '저장됨'}
        </span>

        {/* Preview toggle + Save */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setMode(m => m === 'write' ? 'preview' : 'write')}
            className={`text-xs transition-colors ${
              mode === 'preview'
                ? dk ? 'text-white/68' : 'text-black/62'
                : dk ? 'text-white/30 hover:text-white/58' : 'text-black/28 hover:text-black/52'
            }`}
          >
            {mode === 'write' ? '미리보기' : '편집'}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || !body.trim()}
            className={`text-sm font-semibold transition-all ${
              dirty && body.trim()
                ? dk ? 'text-white/80 hover:text-white' : 'text-black/70 hover:text-black'
                : dk ? 'text-white/18 cursor-not-allowed' : 'text-black/16 cursor-not-allowed'
            }`}
          >
            저장
          </button>
        </div>
      </div>

      {/* ── Editor / Preview ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-6 pt-8 pb-20">

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요..."
            spellCheck={false}
            autoComplete="off"
            readOnly={mode === 'preview'}
            className={[
              'w-full bg-transparent outline-none font-bold leading-[1.2] tracking-[-0.02em] mb-7 block',
              'text-[1.72rem]',
              mode === 'preview' ? 'pointer-events-none' : '',
              dk ? 'text-white/92 placeholder:text-white/18' : 'text-black/90 placeholder:text-black/16',
            ].join(' ')}
          />

          {/* Divider */}
          <div className={`mb-6 border-t ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`} />

          {mode === 'write' ? (
            // ── Write mode ────────────────────────────────────────────────
            <textarea
              ref={bodyRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); } }}
              spellCheck={false}
              autoComplete="off"
              placeholder={`마크다운으로 글을 작성하세요...\n\n# 제목  ## 소제목  ### 소소제목\n**굵게**  *기울게*  \`코드\`\n- 목록 항목\n> 인용구\n---`}
              className={[
                'w-full bg-transparent outline-none leading-[1.9] resize-none',
                'text-[1.02rem] tracking-[0.005em]',
                dk ? 'text-white/72 placeholder:text-white/15' : 'text-black/68 placeholder:text-black/13',
              ].join(' ')}
              style={{ minHeight: '60vh' }}
            />
          ) : (
            // ── Preview mode ─────────────────────────────────────────────
            body.trim()
              ? <Markdown content={body} dk={dk} />
              : <p className={`italic text-sm ${dk ? 'text-white/22' : 'text-black/18'}`}>(내용 없음)</p>
          )}

        </div>
      </div>

      {/* ── Markdown hint (write mode only) ─────────────────────────────── */}
      {mode === 'write' && (
        <div
          className={`flex-shrink-0 px-6 py-2 border-t text-[0.68rem] tracking-wide flex gap-4 overflow-x-auto ${
            dk ? 'border-white/[0.06] text-white/18' : 'border-black/[0.05] text-black/16'
          }`}
        >
          {['# 제목', '**굵게**', '*기울게*', '`코드`', '- 목록', '> 인용'].map((hint) => (
            <span key={hint} className="whitespace-nowrap font-mono">{hint}</span>
          ))}
        </div>
      )}
    </div>
  );
}
