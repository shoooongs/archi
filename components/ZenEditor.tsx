'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { MemoItem } from '@/lib/types';

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

// ─── HTML → Markdown ─────────────────────────────────────────────────────────

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = () => Array.from(el.childNodes).map(nodeToMd).join('');

  switch (tag) {
    case 'h1': return `# ${inner().trim()}\n\n`;
    case 'h2': return `## ${inner().trim()}\n\n`;
    case 'h3': return `### ${inner().trim()}\n\n`;
    case 'hr': return `---\n\n`;
    case 'br': return '\n';
    case 'blockquote': return `> ${inner().trim()}\n\n`;
    case 'p': { const c = inner(); return c.trim() ? `${c}\n\n` : ''; }
    case 'b':
    case 'strong': return `**${inner()}**`;
    case 'u': return `<u>${inner()}</u>`;
    case 'i':
    case 'em': return `*${inner()}*`;
    case 'ul':
      return Array.from(el.children).map(li => `- ${li.textContent?.trim() ?? ''}\n`).join('') + '\n';
    case 'ol':
      return Array.from(el.children).map((li, i) => `${i + 1}. ${li.textContent?.trim() ?? ''}\n`).join('') + '\n';
    case 'li': return inner();
    default:   return inner();
  }
}

function htmlToMarkdown(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return Array.from(div.childNodes).map(nodeToMd).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Toolbar config ───────────────────────────────────────────────────────────

interface ToolbarItem {
  id: string;
  label: string;
  tag: string;
  title: string;
  cmd?: string;
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
  { id: 'bold', label: 'B',  tag: '',            title: '굵게',   cmd: 'bold'                },
  { id: 'ul',   label: 'U',  tag: '',            title: '밑줄',   cmd: 'underline'           },
  { id: 'list', label: '•',  tag: '',            title: '목록',   cmd: 'insertUnorderedList' },
];

// ─── ZenEditor ───────────────────────────────────────────────────────────────

export interface ZenEditorProps {
  memo: MemoItem;
  onBack: () => void;
  onSave: (title: string, body: string) => void;
}

const FONT_SIZE_MAP: Record<string, string> = {
  sm:   '0.75rem',
  base: '0.875rem',
  lg:   '1rem',
  xl:   '1.125rem',
};

export default function ZenEditor({ memo, onBack, onSave }: ZenEditorProps) {
  const { state } = useStore();
  const dk       = state.settings.darkMode;
  const fontSize = FONT_SIZE_MAP[state.settings.fontSize] ?? '0.875rem';

  const [title,          setTitle]          = useState(memo.title ?? '');
  const [isDirty,        setIsDirty]        = useState(false);
  const [entered,        setEntered]        = useState(false);
  const [exiting,        setExiting]        = useState(false);
  const [activeBlock,    setActiveBlock]    = useState<string>('p');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toastMsg,       setToastMsg]       = useState<string | null>(null);
  const [toastVisible,   setToastVisible]   = useState(false);

  const editorRef      = useRef<HTMLDivElement>(null);
  const savedHtmlRef   = useRef(toHtml(memo.text));
  const savedTitleRef  = useRef(memo.title ?? '');
  const exportMenuRef  = useRef<HTMLDivElement>(null);
  const toastTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    function onPointerDown(e: PointerEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showExportMenu]);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    setToastVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setToastVisible(true));
    });
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToastMsg(null), 300);
    }, 2000);
  }

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

    const sel   = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    el.focus();

    if (range && sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    if (item.cmd) {
      document.execCommand(item.cmd, false);
    } else if (item.tag === 'hr') {
      document.execCommand('insertHorizontalRule', false);
    } else {
      const current = getAncestorBlockTag(el);
      const target = current === item.tag && item.tag !== 'p' ? 'p' : item.tag;
      document.execCommand('formatBlock', false, target);
    }

    requestAnimationFrame(() => {
      if (!el) return;
      setActiveBlock(getAncestorBlockTag(el));
      recomputeDirty();
    });
  }

  // ─── Export actions ──────────────────────────────────────────────────────

  function handleCopyText() {
    setShowExportMenu(false);
    const html = editorRef.current?.innerHTML ?? '';
    const body = htmlToPlainText(html);
    const plain = [title.trim(), body].filter(Boolean).join('\n\n');
    if (!plain) return;
    navigator.clipboard.writeText(plain).then(() => {
      showToast('클립보드에 복사되었습니다.');
    }).catch(() => {
      // Fallback for environments that block clipboard API
      const ta = document.createElement('textarea');
      ta.value = plain;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('클립보드에 복사되었습니다.');
    });
  }

  function handleSaveMd() {
    setShowExportMenu(false);
    const html = editorRef.current?.innerHTML ?? '';
    const md   = htmlToMarkdown(html);
    const safeTitle = (title.trim() || '메모').replace(/[/\\:*?"<>|]/g, '_');
    const blob = new Blob([`# ${title.trim() || '메모'}\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${safeTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('마크다운 파일이 저장되었습니다.');
  }

  function handleEmail() {
    setShowExportMenu(false);
    const html  = editorRef.current?.innerHTML ?? '';
    const plain = htmlToPlainText(html);
    const subject = encodeURIComponent(`[Archi] ${title.trim() || '메모'}`);
    const body    = encodeURIComponent(plain);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // ─── Styles ──────────────────────────────────────────────────────────────

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

  const menuItemCls = `flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs transition-colors ${
    dk
      ? 'text-white/72 hover:bg-white/8 active:bg-white/12'
      : 'text-black/65 hover:bg-black/5 active:bg-black/8'
  }`;

  return (
    <div
      className={`fixed inset-x-0 top-0 h-dvh z-[80] flex flex-col overflow-hidden ${dk ? 'bg-neutral-950' : 'bg-[#fafaf8]'}`}
      style={{ transform, transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
    >
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div
        className={`flex-shrink-0 border-b ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="relative flex items-center justify-between px-3 py-1.5">
          <button
            onClick={handleBack}
            className={`flex items-center gap-1.5 p-2 rounded-xl text-sm transition-colors ${dk ? 'text-white/42 hover:text-white/72 hover:bg-white/8' : 'text-black/38 hover:text-black/65 hover:bg-black/6'}`}
          >
            <BackIcon />
            <span>뒤로</span>
          </button>

          <span className={`absolute left-1/2 -translate-x-1/2 text-xs font-medium pointer-events-none transition-colors duration-300 ${
            isDirty
              ? dk ? 'text-amber-400/80' : 'text-amber-600/76'
              : dk ? 'text-emerald-400/68' : 'text-emerald-600/68'
          }`}>
            {isDirty ? '수정 중' : '저장됨'}
          </span>

          {/* Right actions */}
          <div className="flex items-center gap-0.5">
            {/* Export button + dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                title="내보내기"
                className={`p-2 rounded-xl transition-all ${
                  showExportMenu
                    ? dk ? 'text-white/80 bg-white/8' : 'text-black/70 bg-black/6'
                    : dk ? 'text-white/30 hover:text-white/62 hover:bg-white/8' : 'text-black/28 hover:text-black/58 hover:bg-black/6'
                }`}
              >
                <ExportIcon />
              </button>

              {showExportMenu && (
                <div className={`absolute right-0 top-full mt-1.5 z-50 min-w-[148px] rounded-xl overflow-hidden shadow-lg ${
                  dk
                    ? 'bg-neutral-900 border border-white/[0.09]'
                    : 'bg-white border border-black/[0.08]'
                }`}>
                  <button onClick={handleCopyText} className={menuItemCls}>텍스트 복사</button>
                  <div className={`mx-3 border-t ${dk ? 'border-white/[0.06]' : 'border-black/[0.05]'}`} />
                  <button onClick={handleSaveMd} className={menuItemCls}>MD 파일 저장</button>
                  <div className={`mx-3 border-t ${dk ? 'border-white/[0.06]' : 'border-black/[0.05]'}`} />
                  <button onClick={handleEmail} className={menuItemCls}>이메일로 보내기</button>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`p-2 rounded-xl text-sm font-semibold transition-all ${
                isDirty
                  ? dk ? 'text-white/80 hover:text-white hover:bg-white/8' : 'text-black/70 hover:text-black hover:bg-black/6'
                  : dk ? 'text-white/16 cursor-not-allowed' : 'text-black/14 cursor-not-allowed'
              }`}
            >
              저장
            </button>
          </div>
        </div>
      </div>

      {/* ── Formatting toolbar ────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 flex items-center px-2.5 py-1 border-b overflow-x-auto gap-0.5 ${dk ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
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

      {/* ── Editor content ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ fontSize, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-16">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); recomputeDirty(e.target.value); }}
            placeholder="제목"
            spellCheck={false}
            autoComplete="off"
            className={[
              'w-full bg-transparent outline-none font-bold tracking-tight mb-4 block',
              'text-[1.4em] leading-snug',
              dk ? 'text-white/92 placeholder:text-white/16' : 'text-black/90 placeholder:text-black/14',
            ].join(' ')}
          />

          <div className={`mb-4 border-t ${dk ? 'border-white/[0.07]' : 'border-black/[0.06]'}`} />

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
          />
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg pointer-events-none transition-all duration-300 ${
            dk ? 'bg-white/10 text-white/88 border border-white/[0.1] backdrop-blur-md' : 'bg-black/[0.82] text-white/90 backdrop-blur-md'
          }`}
          style={{
            opacity: toastVisible ? 1 : 0,
            transform: `translateX(-50%) translateY(${toastVisible ? '0px' : '8px'})`,
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
