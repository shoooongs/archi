'use client';

import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { FontFamily, FontSize } from '@/lib/types';

// ─── Image compressor (mirrors SettingsPanel) ────────────────────────────────

const MAX_PX  = 1200;
const QUALITY = 0.75;

async function compressImage(file: File): Promise<string> {
  const objectURL = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = () => reject(new Error('이미지 로드 실패'));
      el.src = objectURL;
    });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX_PX || h > MAX_PX) {
      if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
      else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 컨텍스트를 얻을 수 없습니다.');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, updateSettings } = useStore();
  const { settings } = state;
  const dk = settings.darkMode;
  const fileRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessing(true);
    try {
      const dataUrl = await compressImage(file);
      updateSettings({ bgImage: dataUrl, bgMode: 'image' });
    } catch (err) {
      console.error('[Settings] 이미지 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) updateSettings({ bgColor: v });
  }

  const pill    = 'px-3 py-1 text-xs rounded-full border transition-all duration-150 cursor-pointer';
  const active  = dk
    ? 'bg-white/90 text-neutral-900 border-white/90'
    : 'bg-black/80 text-white border-black/80';
  const inactive = dk
    ? 'text-white/45 border-white/15 hover:border-white/35 hover:text-white/70'
    : 'text-black/50 border-black/15 hover:border-black/35 hover:text-black/70';
  const row = 'flex items-center gap-4';
  const lbl = `text-xs w-10 shrink-0 tracking-wide ${dk ? 'text-white/40' : 'text-black/35'}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl ${dk ? 'bg-neutral-900 border border-white/12' : 'bg-white border border-black/8'}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dk ? 'border-white/8' : 'border-black/6'}`}>
          <span className={`text-sm font-semibold ${dk ? 'text-white/80' : 'text-black/75'}`}>설정</span>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${dk ? 'text-white/40 hover:text-white/70 hover:bg-white/10' : 'text-black/35 hover:text-black/65 hover:bg-black/6'}`}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Rows */}
        <div className="px-5 py-5 flex flex-col gap-4">

          {/* Dark mode */}
          <div className={row}>
            <span className={lbl}>모드</span>
            <button
              onClick={() => updateSettings({ darkMode: !dk })}
              className={`flex items-center gap-1.5 ${pill} ${active}`}
            >
              {dk ? <SunIcon /> : <MoonIcon />}
              <span>{dk ? '라이트 모드' : '다크 모드'}</span>
            </button>
          </div>

          {/* Font family */}
          <div className={row}>
            <span className={lbl}>서체</span>
            <div className="flex gap-1.5">
              {(['sans', 'serif', 'mono'] as FontFamily[]).map((f) => (
                <button key={f} onClick={() => updateSettings({ fontFamily: f })}
                  className={`${pill} ${settings.fontFamily === f ? active : inactive}`}>
                  {f === 'sans' ? '고딕' : f === 'serif' ? '명조' : '모노'}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className={row}>
            <span className={lbl}>크기</span>
            <div className="flex gap-1.5">
              {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((s) => (
                <button key={s} onClick={() => updateSettings({ fontSize: s })}
                  className={`${pill} ${settings.fontSize === s ? active : inactive}`}>
                  {s === 'sm' ? 'S' : s === 'base' ? 'M' : s === 'lg' ? 'L' : 'XL'}
                </button>
              ))}
            </div>
          </div>

          {/* Hide OFF */}
          <div className={row}>
            <span className={lbl}>표시</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.hideOff}
                onChange={(e) => updateSettings({ hideOff: e.target.checked })}
                className={`w-3.5 h-3.5 cursor-pointer ${dk ? 'accent-white' : 'accent-black'}`}
              />
              <span className={`text-xs ${dk ? 'text-white/50' : 'text-black/50'}`}>OFF 된 메모 숨기기</span>
            </label>
          </div>

          {/* Background — light mode only */}
          {!dk && (
            <div className={row}>
              <span className={lbl}>배경</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1.5">
                  <button onClick={() => updateSettings({ bgMode: 'color' })}
                    className={`${pill} ${settings.bgMode === 'color' ? active : inactive}`}>단색</button>
                  <button onClick={() => updateSettings({ bgMode: 'image' })}
                    className={`${pill} ${settings.bgMode === 'image' ? active : inactive}`}>이미지</button>
                </div>

                {settings.bgMode === 'color' && (
                  <div className="flex items-center gap-2">
                    <label className="relative cursor-pointer">
                      <span className="block w-6 h-6 rounded-full border border-black/15 shadow-sm"
                        style={{ backgroundColor: settings.bgColor }} />
                      <input type="color" value={settings.bgColor}
                        onChange={(e) => updateSettings({ bgColor: e.target.value })}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    </label>
                    <input type="text" defaultValue={settings.bgColor} key={settings.bgColor}
                      onChange={handleHexInput} maxLength={7} spellCheck={false}
                      className="w-20 px-2 py-0.5 text-xs border border-black/15 rounded-full bg-transparent outline-none focus:border-black/40 text-black/60 font-mono" />
                  </div>
                )}

                {settings.bgMode === 'image' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (!isProcessing) fileRef.current?.click(); }}
                      disabled={isProcessing}
                      className={`${pill} ${isProcessing ? 'opacity-50 cursor-not-allowed' : inactive}`}
                    >
                      {isProcessing ? '처리 중…' : '업로드'}
                    </button>
                    {settings.bgImage && !isProcessing && (
                      <button onClick={() => updateSettings({ bgImage: null, bgMode: 'color' })}
                        className="text-xs text-black/35 hover:text-black/60 transition-colors">제거</button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*"
                      className="hidden" onChange={handleImageUpload} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: '모든 메모', active: true,  available: true  },
  { label: '폴더',      active: false, available: false },
  { label: '휴지통',    active: false, available: false },
] as const;

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { state } = useStore();
  const dk = state.settings.darkMode;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.38)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={[
          'fixed left-0 top-0 bottom-0 z-50 w-[280px] flex flex-col will-change-transform',
          'transition-transform duration-[320ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
          open ? 'translate-x-0' : '-translate-x-full',
          dk
            ? 'bg-neutral-950 border-r border-white/[0.07] shadow-[4px_0_32px_rgba(0,0,0,0.55)]'
            : 'bg-white border-r border-black/[0.05] shadow-[4px_0_24px_rgba(0,0,0,0.09)]',
          'backdrop-blur-2xl',
        ].join(' ')}
        style={{
          paddingTop:    'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-5">
          <span className={`text-[0.65rem] font-semibold tracking-[0.22em] uppercase ${dk ? 'text-white/28' : 'text-black/22'}`}>
            Mind Dump
          </span>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${dk ? 'text-white/28 hover:text-white/58 hover:bg-white/8' : 'text-black/22 hover:text-black/52 hover:bg-black/5'}`}
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          {NAV_ITEMS.map(({ label, active, available }) => (
            <div
              key={label}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-colors',
                available ? 'cursor-pointer' : 'cursor-default',
                active
                  ? dk ? 'bg-white/[0.08] text-white/85' : 'bg-black/[0.05] text-black/80'
                  : available
                    ? dk ? 'text-white/40 hover:text-white/65 hover:bg-white/5' : 'text-black/35 hover:text-black/60 hover:bg-black/[0.04]'
                    : dk ? 'text-white/18' : 'text-black/18',
              ].join(' ')}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-0'} ${dk ? 'bg-white/60' : 'bg-black/50'}`}
              />
              <span className={`text-sm ${active ? 'font-medium' : 'font-normal'}`}>{label}</span>
            </div>
          ))}
        </nav>

        {/* Settings button at bottom */}
        <div className={`px-3 py-3 border-t ${dk ? 'border-white/[0.07]' : 'border-black/[0.05]'}`}>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${dk ? 'text-white/38 hover:text-white/62 hover:bg-white/8' : 'text-black/32 hover:text-black/58 hover:bg-black/5'}`}
          >
            <GearIcon />
            <span className="text-sm">설정</span>
          </button>
        </div>

      </aside>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
