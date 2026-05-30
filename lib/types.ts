export interface MemoItem {
  id: string;
  text: string;
  title: string | null;
  status: 'DUMP' | 'OFF' | 'PUBLISH';
  createdAt: number;
}

export type FontFamily = 'sans' | 'serif' | 'mono';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type BgMode = 'color' | 'image';

export interface AppSettings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  bgMode: BgMode;
  bgColor: string;
  bgImage: string | null;
  hideOff: boolean;
  darkMode: boolean;
}
