'use client';

import { useRef, useState } from 'react';
import { useStore, STORAGE_KEY } from '@/lib/store';
import type { FontFamily, FontSize } from '@/lib/types';

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
    let w = img.naturalWidth;
    let h = img.naturalHeight;
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

export default function SettingsPanel() {
  const { state, updateSettings, importData } = useStore();
  const { settings } = state;
  const dk = settings.darkMode;
  const fileRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Export / Import state
  const [exportText,  setExportText]  = useState('');
  const [importText,  setImportText]  = useState('');
  const [showImport,  setShowImport]  = useState(false);
  const [importError, setImportError] = useState('');

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessing(true);
    try {
      const dataUrl = await compressImage(file);
      updateSettings({ bgImage: dataUrl, bgMode: 'image' });
    } catch (err) {
      console.error('[SettingsPanel] 이미지 처리 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) updateSettings({ bgColor: v });
  }

  function handleExport() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const text = raw ?? JSON.stringify({ memos: state.memos, folders: state.folders, settings: state.settings }, null, 2);
    setExportText(text);
    setShowImport(false);
    setImportError('');
  }

  function handleImport() {
    setImportError('');
    try {
      importData(importText);
      setImportText('');
      setShowImport(false);
    } catch {
      setImportError('올바른 JSON 형식이 아닙니다. 다시 확인해 주세요.');
    }
  }

  const pill = 'px-3 py-1 text-xs rounded-full border transition-all duration-150 cursor-pointer';
  const active   = dk
    ? 'bg-white/90 text-neutral-900 border-white/90'
    : 'bg-black/80 text-white border-black/80';
  const inactive = dk
    ? 'text-white/45 border-white/15 hover:border-white/35 hover:text-white/70'
    : 'text-black/50 border-black/15 hover:border-black/35 hover:text-black/70';

  const labelCls  = dk ? 'text-xs text-white/40 w-10 shrink-0 tracking-wide' : 'text-xs text-black/35 w-10 shrink-0 tracking-wide';
  const panelCls  = dk
    ? 'border-b border-white/10 bg-neutral-900/90 backdrop-blur-md px-5 py-4'
    : 'border-b border-black/8 bg-white/85 backdrop-blur-md px-5 py-4';

  const textareaCls = [
    'w-full text-xs rounded-lg px-3 py-2.5 resize-none outline-none font-mono leading-relaxed',
    dk
      ? 'bg-white/5 border border-white/10 text-white/65 placeholder:text-white/22 focus:border-white/25'
      : 'bg-black/[0.04] border border-black/10 text-black/62 placeholder:text-black/20 focus:border-black/25',
  ].join(' ');

  return (
    <div className={panelCls}>
      <div className="max-w-2xl mx-auto flex flex-col gap-3">

        {/* Font family */}
        <div className="flex items-center gap-4">
          <span className={labelCls}>서체</span>
          <div className="flex gap-1.5">
            {(['sans', 'serif', 'mono'] as FontFamily[]).map((f) => (
              <button
                key={f}
                onClick={() => updateSettings({ fontFamily: f })}
                className={`${pill} ${settings.fontFamily === f ? active : inactive}`}
              >
                {f === 'sans' ? '고딕' : f === 'serif' ? '명조' : '모노'}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-4">
          <span className={labelCls}>크기</span>
          <div className="flex gap-1.5">
            {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((s) => (
              <button
                key={s}
                onClick={() => updateSettings({ fontSize: s })}
                className={`${pill} ${settings.fontSize === s ? active : inactive}`}
              >
                {s === 'sm' ? 'S' : s === 'base' ? 'M' : s === 'lg' ? 'L' : 'XL'}
              </button>
            ))}
          </div>
        </div>

        {/* Hide OFF memos */}
        <div className="flex items-center gap-4">
          <span className={labelCls}>표시</span>
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

        {/* Background — only shown in light mode (dark mode forces #0a0a0a) */}
        {!dk && (
          <div className="flex items-center gap-4">
            <span className={labelCls}>배경</span>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateSettings({ bgMode: 'color' })}
                  className={`${pill} ${settings.bgMode === 'color' ? active : inactive}`}
                >
                  단색
                </button>
                <button
                  onClick={() => updateSettings({ bgMode: 'image' })}
                  className={`${pill} ${settings.bgMode === 'image' ? active : inactive}`}
                >
                  이미지
                </button>
              </div>

              {settings.bgMode === 'color' && (
                <div className="flex items-center gap-2">
                  <label className="relative cursor-pointer">
                    <span
                      className="block w-6 h-6 rounded-full border border-black/15 shadow-sm"
                      style={{ backgroundColor: settings.bgColor }}
                    />
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) => updateSettings({ bgColor: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    defaultValue={settings.bgColor}
                    key={settings.bgColor}
                    onChange={handleHexInput}
                    maxLength={7}
                    spellCheck={false}
                    className="w-20 px-2 py-0.5 text-xs border border-black/15 rounded-full bg-transparent outline-none focus:border-black/40 text-black/60 font-mono"
                  />
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
                    <button
                      onClick={() => updateSettings({ bgImage: null, bgMode: 'color' })}
                      className="text-xs text-black/35 hover:text-black/60 transition-colors"
                    >
                      제거
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className={`border-t pt-1 ${dk ? 'border-white/[0.07]' : 'border-black/[0.05]'}`} />

        {/* Data export / import */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-4">
            <span className={labelCls}>데이터</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleExport}
                className={`${pill} ${exportText && !showImport ? active : inactive}`}
              >
                내보내기
              </button>
              <button
                onClick={() => { setShowImport((v) => !v); setExportText(''); setImportError(''); }}
                className={`${pill} ${showImport ? active : inactive}`}
              >
                가져오기
              </button>
            </div>
          </div>

          {/* Export result textarea */}
          {exportText && !showImport && (
            <textarea
              readOnly
              rows={5}
              value={exportText}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className={textareaCls}
              spellCheck={false}
            />
          )}

          {/* Import textarea + apply button */}
          {showImport && (
            <div className="flex flex-col gap-2">
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                placeholder="내보내기로 복사한 JSON을 여기에 붙여넣으세요..."
                className={textareaCls}
                spellCheck={false}
              />
              {importError && (
                <p className="text-xs text-red-500/80">{importError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className={[
                    pill,
                    importText.trim() ? active : `${inactive} opacity-50 cursor-not-allowed`,
                  ].join(' ')}
                >
                  적용하기
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportText(''); setImportError(''); }}
                  className={`${pill} ${inactive}`}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
