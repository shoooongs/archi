'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type FocusEvent,
  type RefObject,
} from 'react';
import { useStore } from '@/lib/store';
import type { FontFamily, MemoItem } from '@/lib/types';
import SettingsPanel from '@/components/SettingsPanel';

// ─── Icons ───────────────────────────────────────────────────────────────────

function GearIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.3s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

type ViewMode = 'ALL' | 'PUBLISHED_ONLY';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금';
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${min}`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}.${mm}.${dd} ${time}`;
  }
  return `${mm}.${dd} ${time}`;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// Stops gesture-related events from bubbling out of input/textarea elements.
function sp(e: { stopPropagation(): void }) { e.stopPropagation(); }
const INPUT_GUARD = {
  onPointerDown: sp, onMouseDown: sp,
  onTouchStart:  sp, onTouchMove: sp, onTouchEnd: sp,
} as const;

// ─── Canvas export ───────────────────────────────────────────────────────────

const CANVAS_FONT: Record<FontFamily, string> = {
  sans:  'system-ui, -apple-system, sans-serif',
  serif: '"Nanum Myeongjo", serif',
  mono:  '"Courier New", monospace',
};

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, startY: number,
  maxWidth: number, lineHeight: number,
): number {
  let y = startY;
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const ch of [...paragraph]) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, y); line = ch; y += lineHeight;
      } else { line = test; }
    }
    if (line) { ctx.fillText(line, x, y); y += lineHeight; }
    y += lineHeight * 0.25;
  }
  return y;
}

async function exportMemoAsCard(memo: MemoItem, fontFamilyKey: FontFamily) {
  await document.fonts.ready;
  const W = 800, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const font = CANVAS_FONT[fontFamilyKey];
  const padX = 88, textW = W - padX - 72;
  ctx.fillStyle = '#f9f9f8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(58, 80, 2, H - 160);
  let y = 148;
  if (memo.status === 'PUBLISH' && memo.title) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.font = `600 26px ${font}`;
    y = drawWrappedText(ctx, memo.title, padX, y, textW, 38);
    y += 16;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(padX, y, 36, 1);
    y += 26;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = `18px ${font}`;
    drawWrappedText(ctx, memo.text, padX, y, textW, 30);
  } else {
    const fontSize = memo.text.length < 80 ? 24 : memo.text.length < 180 ? 20 : 17;
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.font = `${fontSize}px ${font}`;
    drawWrappedText(ctx, memo.text, padX, y, textW, fontSize * 1.65);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.font = `11px ${font}`;
  const brand = 'MIND DUMP';
  ctx.fillText(brand, W - 72 - ctx.measureText(brand).width, H - 68);
  const a = document.createElement('a');
  a.download = `mind-dump-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ─── MemoRow ─────────────────────────────────────────────────────────────────

interface MemoRowProps {
  memo: MemoItem;
  fontFamily: FontFamily;
  darkMode: boolean;
  isEditing: boolean;
  editTitle: string;
  editBody: string;
  setEditTitle: (v: string) => void;
  setEditBody: (v: string) => void;
  titleRef: RefObject<HTMLInputElement>;
  bodyRef: RefObject<HTMLTextAreaElement>;
  onEditorBlur: (e: FocusEvent<HTMLDivElement>) => void;
  onTitleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBodyKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBodyFocus: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onStartEdit: () => void;
  onToggleOff: () => void;
}

const LONG_PRESS_MS = 600;

function MemoRow({
  memo, fontFamily, darkMode, isEditing,
  editTitle, editBody, setEditTitle, setEditBody,
  titleRef, bodyRef,
  onEditorBlur, onTitleKeyDown, onBodyKeyDown, onBodyFocus,
  onStartEdit, onToggleOff,
}: MemoRowProps) {
  const dk = darkMode;
  const contentRef = useRef<HTMLDivElement>(null);
  const actionRef  = useRef<HTMLDivElement>(null);
  const startXRef  = useRef(0);
  const startYRef  = useRef(0);
  const draggingRef = useRef(false);
  const swipingRef  = useRef(false);
  const longPressTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isMounted, setIsMounted]   = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const isOff = memo.status === 'OFF';

  function applyOffset(offset: number) {
    if (contentRef.current) contentRef.current.style.transform = `translateX(${offset}px)`;
    if (actionRef.current)  actionRef.current.style.width = `${-offset}px`;
  }

  function springBack() {
    const ease = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    if (contentRef.current) {
      contentRef.current.style.transition = `transform 0.28s ${ease}`;
      contentRef.current.style.transform  = 'translateX(0)';
    }
    if (actionRef.current) {
      actionRef.current.style.transition = `width 0.28s ${ease}`;
      actionRef.current.style.width = '0px';
    }
  }

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    const active = document.activeElement;
    if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
    draggingRef.current = true;
    swipingRef.current  = false;
    longPressActivated.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    if (contentRef.current) contentRef.current.style.transition = 'none';
    if (actionRef.current)  actionRef.current.style.transition  = 'none';
    setIsPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      longPressActivated.current = true;
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = Math.abs(e.clientY - startYRef.current);
    if ((Math.abs(dx) > 6 || dy > 6) && longPressTimerRef.current !== null) {
      cancelLongPress(); setIsPressing(false);
    }
    if (!swipingRef.current) {
      if (dy > Math.abs(dx) + 3) { draggingRef.current = false; setIsPressing(false); return; }
      if (Math.abs(dx) > 6) {
        swipingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else { return; }
    }
    applyOffset(Math.max(-120, Math.min(0, dx)));
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    draggingRef.current = false; swipingRef.current = false;
    cancelLongPress(); setIsPressing(false);
    if (longPressActivated.current) {
      longPressActivated.current = false;
      exportMemoAsCard(memo, fontFamily);
      return;
    }
    if (Math.abs(dx) < 10) { onStartEdit(); return; }
    if (dx < -60) onToggleOff();
    springBack();
  }

  function handlePointerCancel() {
    draggingRef.current = false; swipingRef.current = false;
    cancelLongPress(); setIsPressing(false); springBack();
  }

  const innerCls = [
    'transition-all ease-in-out',
    isPressing ? 'duration-500' : 'duration-150',
    isPressing
      ? `scale-[0.98] ${isOff ? 'opacity-25' : 'opacity-70'}`
      : `scale-100 ${isOff ? 'opacity-30' : 'opacity-100'}`,
  ].join(' ');

  return (
    <div className={`relative overflow-hidden border-b ${dk ? 'border-white/10' : 'border-black/8'}`}>

      {/* Action reveal panel */}
      <div
        ref={actionRef}
        className={`absolute right-0 top-0 bottom-0 flex items-center justify-end pr-4 overflow-hidden ${dk ? 'bg-white/[0.07]' : 'bg-black/[0.055]'}`}
        style={{ width: 0 }}
      >
        <span className={`text-[0.75em] tracking-wide select-none whitespace-nowrap ${dk ? 'text-white/50' : 'text-black/40'}`}>
          {isOff ? '되살리기' : '끄기'}
        </span>
      </div>

      {/* Swipeable outer layer */}
      <div
        ref={contentRef}
        className={['px-5', isEditing ? 'py-4' : 'py-5 cursor-text'].join(' ')}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={isEditing ? undefined : handlePointerDown}
        onPointerMove={isEditing ? undefined : handlePointerMove}
        onPointerUp={isEditing ? undefined : handlePointerUp}
        onPointerCancel={isEditing ? undefined : handlePointerCancel}
        onContextMenu={(e) => { if (!isEditing) e.preventDefault(); }}
      >
        {/* Inner layer — long-press feedback + isOff dimming */}
        <div className={innerCls}>
          {isEditing ? (
            // ── Editor ──
            <div onBlur={onEditorBlur} className="flex flex-col gap-2">
              <input
                ref={titleRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={onTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                {...INPUT_GUARD}
                placeholder="제목을 입력하세요..."
                spellCheck={false}
                autoComplete="off"
                className={`w-full bg-transparent outline-none font-semibold leading-snug ${dk ? 'text-white/90 placeholder:text-white/25' : 'text-black/90 placeholder:text-black/20'}`}
              />
              <div className={`border-t ${dk ? 'border-white/15' : 'border-black/10'}`} />
              <textarea
                ref={bodyRef}
                rows={1}
                value={editBody}
                onChange={(e) => { setEditBody(e.target.value); autoResize(e.target); }}
                onKeyDown={onBodyKeyDown}
                onFocus={onBodyFocus}
                onClick={(e) => e.stopPropagation()}
                {...INPUT_GUARD}
                spellCheck={false}
                autoComplete="off"
                className={`w-full resize-none overflow-hidden bg-transparent outline-none leading-relaxed ${dk ? 'text-white/75' : 'text-black/70'}`}
              />
            </div>

          ) : memo.status === 'PUBLISH' ? (
            // ── Published ──
            // Font size: both title and body inherit the parent (set by settings).
            // Title is visually distinguished by font-weight only, not size.
            <>
              <p className={`font-semibold leading-snug tracking-tight ${dk ? 'text-white/90' : 'text-black/90'}`}>
                {memo.title}
              </p>
              <p className={`mt-1.5 text-[0.9em] leading-relaxed whitespace-pre-wrap break-words ${dk ? 'text-white/60' : 'text-black/55'}`}>
                {memo.text}
              </p>
            </>

          ) : (
            // ── DUMP / OFF ──
            <p className={`leading-relaxed whitespace-pre-wrap break-words ${dk ? 'text-white/80' : 'text-black/75'}`}>
              {memo.text}
            </p>
          )}

          {/* Empty on server; filled after client mount to avoid hydration mismatch */}
          <p className={`mt-2 text-[0.75em] ${dk ? 'text-white/35' : 'text-black/25'}`}>
            {isMounted ? formatTimestamp(memo.createdAt) : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MemoList ────────────────────────────────────────────────────────────────

export default function MemoList() {
  const { state, addMemo, updateMemo, updateSettings } = useStore();
  const { memos, settings, isHydrated } = state;
  const dk = settings.darkMode;

  // ── View mode & settings panel ────────────────────────────────────────
  const [viewMode, setViewMode]     = useState<ViewMode>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Add-new row ───────────────────────────────────────────────────────
  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const addRef = useRef<HTMLTextAreaElement>(null);

  // ── Publish editor ────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody]   = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLTextAreaElement>(null);
  const editCancelledRef = useRef(false);

  // ── Scroll ────────────────────────────────────────────────────────────
  const listRef        = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef  = useRef(memos.length);

  const scrollToBottom = useCallback((smooth: boolean) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior),
      block: 'end',
    });
  }, []);

  useEffect(() => { scrollToBottom(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (memos.length > prevLengthRef.current) scrollToBottom(true);
    prevLengthRef.current = memos.length;
  }, [memos.length, scrollToBottom]);
  useEffect(() => {
    if (viewMode === 'PUBLISHED_ONLY') { setIsAdding(false); setAddDraft(''); }
    scrollToBottom(true);
  }, [viewMode, scrollToBottom]);

  useEffect(() => {
    if (!editingId || !titleRef.current) return;
    const el = titleRef.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    if (bodyRef.current) autoResize(bodyRef.current);
  }, [editingId]);

  useEffect(() => {
    if (isAdding && addRef.current) addRef.current.focus();
  }, [isAdding]);

  // ── Filtered memos ────────────────────────────────────────────────────
  const displayedMemos = memos.filter((m) => {
    if (settings.hideOff && m.status === 'OFF') return false;
    if (viewMode === 'PUBLISHED_ONLY') return m.status === 'PUBLISH';
    return true;
  });

  // ── Add-new handlers ──────────────────────────────────────────────────
  function handleAddChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setAddDraft(e.target.value); autoResize(e.target);
  }
  function handleAddKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const trimmed = addDraft.trim();
      if (trimmed) { addMemo(trimmed); setAddDraft(''); }
    }
    if (e.key === 'Escape') { setIsAdding(false); setAddDraft(''); }
  }
  function handleAddBlur() {
    const trimmed = addDraft.trim();
    if (trimmed) addMemo(trimmed);
    setAddDraft(''); setIsAdding(false);
  }

  // ── Edit handlers ─────────────────────────────────────────────────────
  function startEdit(id: string, title: string | null, body: string) {
    if (editingId === id) return;
    setEditingId(id); setEditTitle(title ?? ''); setEditBody(body);
  }
  function commitEdit() {
    if (!editingId) return;
    const text = editBody.trim(), title = editTitle.trim();
    if (text) {
      const current = memos.find((m) => m.id === editingId);
      const nextStatus = current?.status === 'OFF' ? 'OFF' : (title ? 'PUBLISH' : 'DUMP');
      updateMemo(editingId, { text, title: title || null, status: nextStatus });
    }
    setEditingId(null); setEditTitle(''); setEditBody('');
  }
  function cancelEdit() {
    editCancelledRef.current = true;
    setEditingId(null); setEditTitle(''); setEditBody('');
  }
  function handleEditorBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (editCancelledRef.current) { editCancelledRef.current = false; return; }
    commitEdit();
  }
  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
    if (e.key === 'Enter')  { e.preventDefault(); bodyRef.current?.focus(); }
  }
  function handleBodyKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }
  function handleBodyFocus(e: FocusEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.setSelectionRange(el.value.length, el.value.length);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">

      {/* Nav bar: [ All  Published ........... 🌙  ⚙️ ]
          SettingsPanel renders inside this sticky block so it sticks below
          the tab row when open, without disrupting the scroll container. */}
      <div
        className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors duration-200 ${dk ? 'bg-neutral-900/80 border-white/10' : 'bg-white/70 border-black/8'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-5 flex items-center py-2.5">
          {/* Tab buttons */}
          <div className="flex items-center gap-6">
            {(['ALL', 'PUBLISHED_ONLY'] as ViewMode[]).map((mode) => {
              const label  = mode === 'ALL' ? 'All' : 'Published';
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={[
                    'text-xs tracking-wide transition-all duration-200 pb-px',
                    active
                      ? `font-semibold border-b ${dk ? 'text-white/80 border-white/55' : 'text-black/75 border-black/50'}`
                      : `font-normal border-b border-transparent ${dk ? 'text-white/35 hover:text-white/60' : 'text-black/30 hover:text-black/50'}`,
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Dark mode toggle + gear — pushed to the far right */}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => updateSettings({ darkMode: !dk })}
              aria-label={dk ? '라이트 모드로 전환' : '다크 모드로 전환'}
              className={`p-1.5 rounded-full transition-colors ${dk ? 'text-white/45 hover:text-white/80 hover:bg-white/10' : 'text-black/30 hover:text-black/60 hover:bg-black/5'}`}
            >
              {dk ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label={settingsOpen ? '설정 닫기' : '설정 열기'}
              className={`p-1.5 rounded-full transition-colors ${dk ? 'text-white/40 hover:text-white/70 hover:bg-white/10' : 'text-black/35 hover:text-black/65 hover:bg-black/5'}`}
            >
              <GearIcon open={settingsOpen} />
            </button>
          </div>
        </div>
        {settingsOpen && <SettingsPanel />}
      </div>

      <div className="max-w-2xl mx-auto">

        {isHydrated && displayedMemos.length === 0 && !isAdding && (
          <div className="px-5 py-12 text-center">
            <p className={`text-sm ${dk ? 'text-white/30' : 'text-black/25'}`}>
              {viewMode === 'PUBLISHED_ONLY' ? '아직 작성된 글이 없어요.' : '첫 생각을 아래에 적어보세요.'}
            </p>
          </div>
        )}

        {isHydrated && displayedMemos.map((memo) => (
          <MemoRow
            key={memo.id}
            memo={memo}
            fontFamily={settings.fontFamily}
            darkMode={dk}
            isEditing={editingId === memo.id}
            editTitle={editTitle}
            editBody={editBody}
            setEditTitle={setEditTitle}
            setEditBody={setEditBody}
            titleRef={titleRef as RefObject<HTMLInputElement>}
            bodyRef={bodyRef as RefObject<HTMLTextAreaElement>}
            onEditorBlur={handleEditorBlur}
            onTitleKeyDown={handleTitleKeyDown}
            onBodyKeyDown={handleBodyKeyDown}
            onBodyFocus={handleBodyFocus}
            onStartEdit={() => startEdit(memo.id, memo.title, memo.text)}
            onToggleOff={() => {
              const next = memo.status === 'OFF'
                ? (memo.title ? 'PUBLISH' : 'DUMP')
                : 'OFF';
              updateMemo(memo.id, { status: next });
            }}
          />
        ))}

        {/* Add-new row — fades out in PUBLISHED_ONLY (magazine) mode */}
        <div
          className={[
            'overflow-hidden transition-all duration-300 ease-in-out',
            viewMode === 'PUBLISHED_ONLY'
              ? 'max-h-0 opacity-0 pointer-events-none'
              : 'max-h-48 opacity-100',
          ].join(' ')}
        >
          <div
            className="px-5 py-5 cursor-text"
            onClick={!isAdding ? () => setIsAdding(true) : undefined}
          >
            {isAdding ? (
              <textarea
                ref={addRef}
                rows={1}
                value={addDraft}
                onChange={handleAddChange}
                onKeyDown={handleAddKeyDown}
                onBlur={handleAddBlur}
                onClick={(e) => e.stopPropagation()}
                {...INPUT_GUARD}
                placeholder=""
                spellCheck={false}
                autoComplete="off"
                className={`w-full resize-none overflow-hidden bg-transparent outline-none leading-relaxed ${dk ? 'text-white/80' : 'text-black/80'}`}
              />
            ) : (
              <span className={`leading-relaxed select-none ${dk ? 'text-white/30' : 'text-black/25'}`}>
                + 새로운 생각 적기...
              </span>
            )}
          </div>
        </div>

        {/* Sentinel: scrollIntoView targets this to land at the very bottom */}
        <div ref={messagesEndRef} />

      </div>
    </div>
  );
}
