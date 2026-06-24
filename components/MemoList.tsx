'use client';

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  type FocusEvent,
  type RefObject,
} from 'react';
import { useStore } from '@/lib/store';
import type { FontFamily, MemoItem } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import ZenEditor from '@/components/ZenEditor';
import { stripHtml } from '@/lib/markdown';

// ─── Icons ───────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// Document icon — shown in Timeline view (tap to go to Published)
function DocIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

// Speech bubble icon — shown in Published view (tap to go back to Timeline)
function TimelineIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
  const brand = 'ARCHI';
  ctx.fillText(brand, W - 72 - ctx.measureText(brand).width, H - 68);
  const a = document.createElement('a');
  a.download = `archi-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ─── MemoRow ─────────────────────────────────────────────────────────────────

interface MemoRowProps {
  memo: MemoItem;
  fontFamily: FontFamily;
  darkMode: boolean;
  isEditing: boolean;
  isTrashView: boolean;
  editTitle: string;
  editBody: string;
  setEditTitle: (v: string) => void;
  onBodyChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
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

// ─── MemoRow ─────────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 600;

function MemoRow({
  memo, fontFamily, darkMode, isEditing, isTrashView,
  editTitle, editBody, setEditTitle, onBodyChange,
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

  // Left-swipe (right panel): grey→"끄기", red→"휴지통", darkred→"완전 삭제"
  const rightActionBg    = isTrashView ? 'bg-red-600' : isOff ? 'bg-red-400' : 'bg-neutral-400';
  const rightActionLabel = isTrashView ? '완전 삭제' : isOff ? '휴지통' : '끄기';
  // Right-swipe (left panel): restore / recover from trash
  const leftActionLabel  = isTrashView ? '복구하기' : '되살리기';
  // Right swipe is available for OFF memos and all trash memos
  const canSwipeRight    = isOff || isTrashView;

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
    const maxRight = canSwipeRight ? 120 : 0;
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

  return (
    <div className="relative overflow-hidden">

      {/* Left action panel — 복구/되살리기 (right swipe) */}
      <div
        ref={leftActionRef}
        className="absolute left-0 top-0 bottom-0 flex items-center justify-start pl-5 overflow-hidden bg-emerald-500"
        style={{ width: 0, opacity: 0 }}
      >
        <span className="text-[0.75em] tracking-wide select-none whitespace-nowrap text-white">
          {leftActionLabel}
        </span>
      </div>

      {/* Right action panel — 끄기 / 휴지통 / 완전 삭제 (left swipe) */}
      <div
        ref={rightActionRef}
        className={`absolute right-0 top-0 bottom-0 flex items-center justify-end pr-5 overflow-hidden ${rightActionBg}`}
        style={{ width: 0, opacity: 0 }}
      >
        <span className="text-[0.75em] tracking-wide select-none whitespace-nowrap text-white">
          {rightActionLabel}
        </span>
      </div>

      {/* Swipeable outer layer */}
      <div
        ref={contentRef}
        className={['px-5 will-change-transform', isEditing ? 'py-4' : 'py-4 cursor-text'].join(' ')}
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
                onChange={onBodyChange}
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
            <>
              <p className={`font-semibold leading-snug tracking-tight line-clamp-2 ${dk ? 'text-white/90' : 'text-black/90'}`}>
                {memo.title}
              </p>
              <p className={`mt-1.5 leading-relaxed break-words line-clamp-5 ${dk ? 'text-white/60' : 'text-black/55'}`}>
                {isMounted ? stripHtml(memo.text) : ''}
              </p>
            </>

          ) : (
            // ── DUMP / OFF ──
            <>
              {memo.title && (
                <p className={`font-semibold leading-snug tracking-tight line-clamp-2 ${dk ? 'text-white/75' : 'text-black/72'}`}>
                  {memo.title}
                </p>
              )}
              <p className={`leading-relaxed break-words line-clamp-5 ${memo.title ? 'mt-1' : ''} ${dk ? 'text-white/80' : 'text-black/75'}`}>
                {isMounted ? stripHtml(memo.text) : ''}
              </p>
            </>
          )}

          <p className={`mt-2 text-[0.75em] ${dk ? 'text-white/35' : 'text-black/25'}`}>
            {isMounted ? formatTimestamp(memo.createdAt) : ''}
          </p>
        </div>
      </div>

      {/* Padded separator line */}
      <div className={`mx-5 h-px ${dk ? 'bg-white/[0.08]' : 'bg-black/[0.06]'}`} />
    </div>
  );
}

// ─── MemoList ────────────────────────────────────────────────────────────────

export default function MemoList() {
  const { state, addMemo, updateMemo, deleteMemo, updateSettings } = useStore();
  const { memos, settings, isHydrated } = state;
  const dk = settings.darkMode;

  // ── Active view & sidebar ─────────────────────────────────────────────
  // 'all' = All Memos, 'trash' = Trash, any other string = folder id
  const [activeView,  setActiveView]  = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Sub-tab: Timeline | Published ─────────────────────────────────────
  const [subTab, setSubTab] = useState<'timeline' | 'published'>('timeline');

  // ── Zen editor ───────────────────────────────────────────────────────
  const [zenMemo, setZenMemo] = useState<MemoItem | null>(null);

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
  const editCancelledRef  = useRef(false);
  const editStartRef      = useRef(false);
  const addCursorRef      = useRef({ start: 0, end: 0 });
  const editBodyCursorRef = useRef({ start: 0, end: 0 });

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

  // Scroll to bottom on view switch + reset subTab
  useEffect(() => {
    setSubTab('timeline');
    return scrollToBottomDeferred();
  }, [activeView, scrollToBottomDeferred]);

  useEffect(() => {
    if (!editingId || !bodyRef.current) return;
    const el = bodyRef.current;
    autoResize(el);
    el.focus(); // onFocus → handleBodyFocus → sets cursor to end on initial open
  }, [editingId]);

  // Restore add-new cursor after re-renders (prevents cursor jump on mobile)
  useLayoutEffect(() => {
    const el = addRef.current;
    if (!el || document.activeElement !== el) return;
    el.setSelectionRange(addCursorRef.current.start, addCursorRef.current.end);
  }, [addDraft]);

  // Restore edit-body cursor after re-renders; skip on initial edit-open
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !editingId || document.activeElement !== el) return;
    if (editStartRef.current) return;
    el.setSelectionRange(editBodyCursorRef.current.start, editBodyCursorRef.current.end);
  }, [editBody, editingId]);

  // ── Filtered memos ────────────────────────────────────────────────────
  const isTrashView = activeView === 'trash';
  const displayedMemos = memos.filter((m) => {
    if (isTrashView) return m.isDeleted;
    if (m.isDeleted) return false;
    if (settings.hideOff && m.status === 'OFF') return false;
    if (activeView === 'all') return true;
    return m.folderId === activeView;
  });
  const publishedMemos = displayedMemos.filter((m) => m.status === 'PUBLISH' && m.title);
  const showInputCard  = !isTrashView && subTab === 'timeline';

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
  function handleAddChange(e: ChangeEvent<HTMLTextAreaElement>) {
    // Lock scroll position: prevent browser/iOS from scrolling the timeline while typing
    const sc = listRef.current;
    const savedTop = sc?.scrollTop;
    addCursorRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
    setAddDraft(e.target.value);
    autoResize(e.target);
    triggerTypingState();
    if (sc && savedTop !== undefined) {
      sc.scrollTop = savedTop;
      requestAnimationFrame(() => { if (sc) sc.scrollTop = savedTop; });
    }
  }

  function handleBodyChange(e: ChangeEvent<HTMLTextAreaElement>) {
    editBodyCursorRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
    setEditBody(e.target.value);
    autoResize(e.target);
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
    const folderId = activeView !== 'all' && activeView !== 'trash' ? activeView : null;
    addMemo(trimmed, folderId);
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
    editStartRef.current = true;
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
    if (!editStartRef.current) return; // already editing — keep browser-placed cursor
    editStartRef.current = false;
    const el = e.target;
    el.setSelectionRange(el.value.length, el.value.length);
  }

  const hasContent = addDraft.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Sidebar drawer ──────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onSelectView={setActiveView}
      />

      {/* ── Transparent iOS-style header ────────────────────────────── */}
      <div
        className="flex-shrink-0 z-10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-3 py-2 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-2 rounded-xl transition-colors ${dk ? 'text-white/42 hover:text-white/72 hover:bg-white/8' : 'text-black/32 hover:text-black/62 hover:bg-black/6'}`}
            aria-label="메뉴 열기"
          >
            <HamburgerIcon />
          </button>

          {!isTrashView && (
            <button
              onClick={() => setSubTab(subTab === 'published' ? 'timeline' : 'published')}
              className={`p-2 rounded-xl transition-all duration-200 ${
                subTab === 'published'
                  ? dk ? 'text-white/85 bg-white/10' : 'text-black/78 bg-black/7'
                  : dk ? 'text-white/38 hover:text-white/68 hover:bg-white/8' : 'text-black/28 hover:text-black/58 hover:bg-black/6'
              }`}
              aria-label={subTab === 'published' ? '타임라인으로' : 'Published로'}
            >
              {subTab === 'published' ? <TimelineIcon /> : <DocIcon />}
            </button>
          )}
        </div>
      </div>

      {/* ── Sliding content panels ──────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Timeline panel — slides out left when switching to Published */}
        <div
          ref={listRef}
          className="absolute inset-0 overflow-y-auto will-change-transform"
          style={{
            transform: subTab === 'timeline' ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <div className="max-w-2xl mx-auto">
            {isHydrated && displayedMemos.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className={`text-sm ${dk ? 'text-white/30' : 'text-black/25'}`}>
                  {isTrashView
                    ? '휴지통이 비어있어요.'
                    : activeView !== 'all'
                      ? '이 폴더에 아직 메모가 없어요.'
                      : '첫 생각을 아래에 적어보세요.'}
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
                isTrashView={isTrashView}
                editTitle={editTitle}
                editBody={editBody}
                setEditTitle={setEditTitle}
                onBodyChange={handleBodyChange}
                titleRef={titleRef as RefObject<HTMLInputElement>}
                bodyRef={bodyRef as RefObject<HTMLTextAreaElement>}
                onEditorBlur={handleEditorBlur}
                onTitleKeyDown={handleTitleKeyDown}
                onBodyKeyDown={handleBodyKeyDown}
                onBodyFocus={handleBodyFocus}
                onStartEdit={() => {
                  if (isTrashView) return;
                  if (memo.status === 'PUBLISH') { setZenMemo(memo); return; }
                  startEdit(memo.id, memo.title, memo.text);
                }}
                onSwipeLeft={() => {
                  if (isTrashView) {
                    deleteMemo(memo.id);
                  } else if (memo.status === 'OFF') {
                    updateMemo(memo.id, { isDeleted: true });
                  } else {
                    updateMemo(memo.id, { status: 'OFF' });
                  }
                }}
                onSwipeRight={() => {
                  if (isTrashView) {
                    updateMemo(memo.id, { isDeleted: false });
                  } else if (memo.status === 'OFF') {
                    updateMemo(memo.id, { status: memo.title ? 'PUBLISH' : 'DUMP' });
                  }
                }}
              />
            ))}

            <div className={showInputCard ? 'h-[80px]' : 'h-2'} />
          </div>
        </div>

        {/* Published panel — slides in from right */}
        <div
          className="absolute inset-0 overflow-y-auto will-change-transform"
          style={{
            transform: subTab === 'published' ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <div className="max-w-2xl mx-auto">
            {isHydrated && publishedMemos.length === 0 && (
              <div className="px-5 py-14 text-center">
                <p className={`text-sm ${dk ? 'text-white/30' : 'text-black/25'}`}>
                  아직 Published 글이 없어요.
                </p>
                <p className={`mt-1.5 text-xs ${dk ? 'text-white/18' : 'text-black/18'}`}>
                  제목이 있는 메모를 발행하면 여기에 표시됩니다.
                </p>
              </div>
            )}
            {isHydrated && publishedMemos.map((memo) => {
              const preview = stripHtml(memo.text);
              return (
                <div
                  key={memo.id}
                  onClick={() => setZenMemo(memo)}
                  className={`relative px-5 py-4 cursor-pointer transition-colors ${dk ? 'active:bg-white/[0.04]' : 'active:bg-black/[0.025]'}`}
                >
                  <p className={`font-semibold leading-snug tracking-tight line-clamp-2 ${dk ? 'text-white/90' : 'text-black/90'}`}>
                    {memo.title}
                  </p>
                  {preview && (
                    <p className={`mt-1.5 leading-relaxed break-words line-clamp-5 ${dk ? 'text-white/60' : 'text-black/55'}`}>
                      {preview}
                    </p>
                  )}
                  <p className={`mt-2 text-[0.75em] ${dk ? 'text-white/35' : 'text-black/25'}`}>
                    {formatTimestamp(memo.createdAt)}
                  </p>
                  <div className={`absolute bottom-0 left-5 right-5 h-px ${dk ? 'bg-white/[0.08]' : 'bg-black/[0.06]'}`} />
                </div>
              );
            })}
            <div className="h-8" />
          </div>
        </div>

      </div>

      {/* ── Floating glassmorphism input card ───────────────────────── */}
      {showInputCard && (
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

      {/* ── Zen editor (full-screen, slide from right) ───────────────── */}
      {zenMemo && (
        <ZenEditor
          memo={zenMemo}
          onBack={() => setZenMemo(null)}
          onSave={(title, body) => {
            updateMemo(zenMemo.id, { title: title || null, text: body, status: 'PUBLISH' });
          }}
        />
      )}

    </div>
  );
}
