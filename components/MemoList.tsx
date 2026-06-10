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

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
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
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const LONG_PRESS_MS = 600;

function MemoRow({
  memo, fontFamily, darkMode, isEditing,
  editTitle, editBody, setEditTitle, setEditBody,
  titleRef, bodyRef,
  onEditorBlur, onTitleKeyDown, onBodyKeyDown, onBodyFocus,
  onStartEdit, onSwipeLeft, onSwipeRight,
}: MemoRowProps) {
  const dk = darkMode;
  const contentRef      = useRef<HTMLDivElement>(null);
  const rightActionRef  = useRef<HTMLDivElement>(null); // revealed on left swipe
  const leftActionRef   = useRef<HTMLDivElement>(null); // revealed on right swipe (OFF only)
  const startXRef       = useRef(0);
  const startYRef       = useRef(0);
  const draggingRef     = useRef(false);
  const swipingRef      = useRef(false);
  const longPressTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isMounted, setIsMounted]   = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const isOff = memo.status === 'OFF';

  function applyOffset(offset: number) {
    if (contentRef.current) contentRef.current.style.transform = `translateX(${offset}px)`;
    if (offset < 0) {
      if (rightActionRef.current) {
        rightActionRef.current.style.width   = `${-offset}px`;
        rightActionRef.current.style.opacity = '1';
      }
      if (leftActionRef.current) {
        leftActionRef.current.style.width   = '0px';
        leftActionRef.current.style.opacity = '0';
      }
    } else if (offset > 0) {
      if (leftActionRef.current) {
        leftActionRef.current.style.width   = `${offset}px`;
        leftActionRef.current.style.opacity = '1';
      }
      if (rightActionRef.current) {
        rightActionRef.current.style.width   = '0px';
        rightActionRef.current.style.opacity = '0';
      }
    }
  }

  function springBack() {
    const ease = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    if (contentRef.current) {
      contentRef.current.style.transition = `transform 0.28s ${ease}`;
      contentRef.current.style.transform  = 'translateX(0)';
    }
    if (rightActionRef.current) {
      rightActionRef.current.style.transition = `width 0.28s ${ease}, opacity 0.28s ${ease}`;
      rightActionRef.current.style.width   = '0px';
      rightActionRef.current.style.opacity = '0';
    }
    if (leftActionRef.current) {
      leftActionRef.current.style.transition = `width 0.28s ${ease}, opacity 0.28s ${ease}`;
      leftActionRef.current.style.width   = '0px';
      leftActionRef.current.style.opacity = '0';
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
    if (contentRef.current)     contentRef.current.style.transition     = 'none';
    if (rightActionRef.current) rightActionRef.current.style.transition = 'none';
    if (leftActionRef.current)  leftActionRef.current.style.transition  = 'none';
    setIsPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      longPressActivated.current = true;
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = Math.abs(e.clientY - startYRef.current);
    if ((Math.abs(dx) > 8 || dy > 8) && longPressTimerRef.current !== null) {
      cancelLongPress(); setIsPressing(false);
    }
    if (!swipingRef.current) {
      const absDx = Math.abs(dx);
      // Wait for enough displacement before deciding direction
      if (absDx < 8 && dy < 8) return;
      // Cancel only when clearly vertical (1.5× ratio), not on slight diagonals
      if (dy > absDx * 1.5) { draggingRef.current = false; setIsPressing(false); return; }
      swipingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    // Right swipe only allowed for OFF memos
    const maxRight = isOff ? 120 : 0;
    applyOffset(Math.max(-120, Math.min(maxRight, dx)));
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
    if (dx < -40) onSwipeLeft();
    else if (dx > 40) onSwipeRight();
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

  // Right action panel label (left swipe)
  const rightActionLabel = isOff ? '삭제하기' : '끄기';
  // Left action panel label (right swipe — only for OFF memos)
  const leftActionLabel  = '되살리기';

  return (
    <div className={`relative overflow-hidden border-b ${dk ? 'border-white/10' : 'border-black/8'}`}>

      {/* Left action panel — 되살리기 (right swipe, OFF only) */}
      <div
        ref={leftActionRef}
        className="absolute left-0 top-0 bottom-0 flex items-center justify-start pl-5 overflow-hidden bg-emerald-500"
        style={{ width: 0, opacity: 0 }}
      >
        <span className="text-[0.75em] tracking-wide select-none whitespace-nowrap text-white">
          {leftActionLabel}
        </span>
      </div>

      {/* Right action panel — 끄기 or 삭제하기 (left swipe) */}
      <div
        ref={rightActionRef}
        className={`absolute right-0 top-0 bottom-0 flex items-center justify-end pr-5 overflow-hidden ${isOff ? 'bg-red-500' : 'bg-neutral-400'}`}
        style={{ width: 0, opacity: 0 }}
      >
        <span className="text-[0.75em] tracking-wide select-none whitespace-nowrap text-white">
          {rightActionLabel}
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
            // Title bold, body same font-size as DUMP memos — no size reduction.
            <>
              <p className={`font-semibold leading-snug tracking-tight ${dk ? 'text-white/90' : 'text-black/90'}`}>
                {memo.title}
              </p>
              <p className={`mt-1.5 leading-relaxed whitespace-pre-wrap break-words ${dk ? 'text-white/60' : 'text-black/55'}`}>
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
  const { state, addMemo, updateMemo, deleteMemo, updateSettings } = useStore();
  const { memos, settings, isHydrated } = state;
  const dk = settings.darkMode;

  // ── View mode & settings panel ────────────────────────────────────────
  const [viewMode, setViewMode]         = useState<ViewMode>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Add-new draft (always-visible input bar) ──────────────────────────
  const [addDraft, setAddDraft] = useState('');
  const addRef           = useRef<HTMLTextAreaElement>(null);
  const inputCardRef     = useRef<HTMLDivElement>(null);
  const isTypingRef      = useRef(false);
  const typingEndTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Publish editor ────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody]   = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLTextAreaElement>(null);
  const editCancelledRef = useRef(false);

  // ── Scroll ────────────────────────────────────────────────────────────
  const listRef        = useRef<HTMLDivElement>(null);
  const prevLengthRef  = useRef(memos.length);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // double-rAF: first frame commits layout, second frame reads correct scrollHeight
  const scrollToBottomDeferred = useCallback(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => scrollToBottom(false));
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToBottom]);

  // Scroll to bottom once after hydration (initial load)
  useEffect(() => {
    if (!isHydrated) return;
    return scrollToBottomDeferred();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // Scroll to bottom when a new memo is added
  useEffect(() => {
    if (memos.length > prevLengthRef.current) scrollToBottom(true);
    prevLengthRef.current = memos.length;
  }, [memos.length, scrollToBottom]);

  // Scroll to bottom on tab switch
  useEffect(() => {
    return scrollToBottomDeferred();
  }, [viewMode, scrollToBottomDeferred]);

  useEffect(() => {
    if (!editingId || !bodyRef.current) return;
    const el = bodyRef.current;
    autoResize(el);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  // ── Filtered memos ────────────────────────────────────────────────────
  const displayedMemos = memos.filter((m) => {
    if (settings.hideOff && m.status === 'OFF') return false;
    if (viewMode === 'PUBLISHED_ONLY') return m.status === 'PUBLISH';
    return true;
  });

  // ── Card press / release ─────────────────────────────────────────────
  function pressCard(depth: 'light' | 'strong' = 'light') {
    const el = inputCardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.08s cubic-bezier(0.4, 0, 0.6, 1)';
    el.style.transform  = depth === 'strong'
      ? 'translateY(3px) scale(0.978)'
      : 'translateY(1.2px) scale(0.993)';
  }

  function releaseCard() {
    const el = inputCardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.05s cubic-bezier(0.34, 1.56, 0.64, 1)';
    el.style.transform  = 'translateY(0) scale(1)';
  }

  function triggerTypingState() {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      pressCard();
    }
    if (typingEndTimer.current) clearTimeout(typingEndTimer.current);
    typingEndTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      releaseCard();
    }, 150);
  }

  // ── Add-new handlers ──────────────────────────────────────────────────
  function handleAddChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setAddDraft(e.target.value);
    autoResize(e.target);
    triggerTypingState();
  }

  // Enter always inserts a newline — submit only via the send button.
  function handleAddKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setAddDraft('');
      if (addRef.current) {
        addRef.current.style.height = 'auto';
        addRef.current.blur();
      }
    }
  }

  function handleSend() {
    const trimmed = addDraft.trim();
    if (!trimmed) return;
    // Clear typing debounce and animate
    if (typingEndTimer.current) clearTimeout(typingEndTimer.current);
    isTypingRef.current = false;
    pressCard('strong');
    setTimeout(releaseCard, 120);
    addMemo(trimmed);
    setAddDraft('');
    requestAnimationFrame(() => {
      if (addRef.current) {
        autoResize(addRef.current);
        addRef.current.focus();
      }
    });
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

  const hasContent = addDraft.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Scrollable timeline ─────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto">

        {/* Nav bar */}
        <div
          className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors duration-200 ${dk ? 'bg-neutral-900/80 border-white/10' : 'bg-white/70 border-black/8'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="max-w-2xl mx-auto px-5 flex items-center py-2.5">
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

          {isHydrated && displayedMemos.length === 0 && (
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
              onSwipeLeft={() => {
                if (memo.status === 'OFF') {
                  deleteMemo(memo.id);
                } else {
                  updateMemo(memo.id, { status: 'OFF' });
                }
              }}
              onSwipeRight={() => {
                if (memo.status === 'OFF') {
                  updateMemo(memo.id, { status: memo.title ? 'PUBLISH' : 'DUMP' });
                }
              }}
            />
          ))}

          {/* Sentinel for scroll-to-bottom — extra space so last memo clears the input bar */}
          <div className={viewMode === 'ALL' ? 'h-[80px]' : 'h-2'} />
        </div>
      </div>

      {/* ── Floating glassmorphism input card ───────────────────────── */}
      {viewMode === 'ALL' && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
            paddingTop: '0.5rem',
          }}
        >
          <div className="max-w-2xl mx-auto px-4">
            <div
              ref={inputCardRef}
              className={[
                'flex items-end gap-3 px-4 py-3 rounded-2xl',
                'border backdrop-blur-2xl will-change-transform',
                dk
                  ? 'bg-neutral-900/85 border-white/40 shadow-[0_2px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]'
                  : 'bg-white/90 border-white/35 shadow-[0_2px_12px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]',
              ].join(' ')}
            >
              <textarea
                ref={addRef}
                rows={1}
                value={addDraft}
                onChange={handleAddChange}
                onKeyDown={handleAddKeyDown}
                onClick={(e) => e.stopPropagation()}
                {...INPUT_GUARD}
                placeholder="새로운 생각 적기..."
                spellCheck={false}
                autoComplete="off"
                className={`flex-1 resize-none overflow-hidden bg-transparent outline-none leading-relaxed min-h-[1.5rem] ${dk ? 'text-white/85 placeholder:text-white/28' : 'text-black/80 placeholder:text-black/30'}`}
              />
              <button
                type="button"
                onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
                onClick={handleSend}
                aria-label="등록"
                className={[
                  'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150',
                  dk
                    ? 'bg-white/15 text-white/80 active:bg-white/30'
                    : 'bg-black/[0.08] text-black/70 active:bg-black/15',
                ].join(' ')}
                style={{ opacity: hasContent ? 1 : 0.25 }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
