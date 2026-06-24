'use client';

import { type CSSProperties } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import MemoList from '@/components/MemoList';
import type { FontFamily, FontSize } from '@/lib/types';

const FONT_FAMILY: Record<FontFamily, string> = {
  sans:  'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  serif: '"Nanum Myeongjo", Georgia, ui-serif, serif',
  mono:  'var(--font-geist-mono), ui-monospace, "Courier New", monospace',
};

const FONT_SIZE: Record<FontSize, string> = {
  sm:   '0.75rem',   // 12px (S)
  base: '0.875rem',  // 14px (M) — 기본값
  lg:   '1rem',      // 16px (L)
  xl:   '1.125rem',  // 18px (XL)
};

function AppContent() {
  const { state } = useStore();
  const { settings } = state;

  const dk = settings.darkMode;

  const bgStyle: CSSProperties = dk
    ? { backgroundColor: '#0a0a0a' }
    : settings.bgMode === 'image' && settings.bgImage
      ? {
          backgroundImage:    `url(${settings.bgImage})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
        }
      : { backgroundColor: settings.bgColor };

  const contentStyle: CSSProperties = {
    fontFamily: FONT_FAMILY[settings.fontFamily],
    fontSize:   FONT_SIZE[settings.fontSize],
  };

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      style={{ ...bgStyle, transition: 'background-color 0.2s ease' }}
    >
      {/* MemoList owns the nav bar (All / Published / ⚙️) and settings panel */}
      <div
        className={`flex flex-col flex-1 overflow-hidden backdrop-blur-sm transition-colors duration-200 ${dk ? 'bg-neutral-950/80' : 'bg-white/55'}`}
        style={contentStyle}
      >
        <MemoList />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
