'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { MemoItem, Folder, AppSettings } from './types';

interface State {
  memos: MemoItem[];
  folders: Folder[];
  settings: AppSettings;
  isHydrated: boolean;
}

type Memopatch = Partial<Pick<MemoItem, 'text' | 'title' | 'status' | 'folderId' | 'isDeleted'>>;

type Action =
  | { type: 'ADD_MEMO';         text: string; folderId: string | null }
  | { type: 'UPDATE_MEMO';      id: string; patch: Memopatch }
  | { type: 'DELETE_MEMO';      id: string }
  | { type: 'ADD_FOLDER';       name: string }
  | { type: 'DELETE_FOLDER';    id: string }
  | { type: 'UPDATE_SETTINGS';  patch: Partial<AppSettings> }
  | { type: 'HYDRATE'; memos: MemoItem[]; folders: Folder[]; settings: AppSettings };

const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: 'sans',
  fontSize:   'sm',
  bgMode:     'color',
  bgColor:    '#f5f5f4',
  bgImage:    null,
  hideOff:    false,
  darkMode:   false,
};

function makeDummyMemos(): MemoItem[] {
  const now = Date.now();
  return [
    { id: 'demo-1', text: '오늘 아침 커피를 마시며 생각했는데, 결국 중요한 건 매일 조금씩 나아지는 것 같다.', title: null, status: 'DUMP', createdAt: now - 86400000 * 3, folderId: null, isDeleted: false },
    { id: 'demo-2', text: '생각을 그냥 흘려보내는 게 아니라 어딘가 잡아두는 게 필요하다. 너무 복잡하지 않게, 딱 필요한 것만.', title: null, status: 'DUMP', createdAt: now - 86400000 * 2, folderId: null, isDeleted: false },
    { id: 'demo-3', text: '루틴보다는 루틴을 만들어가는 과정 자체가 나를 바꾸는 것 같다. 완벽한 루틴을 기다리지 말고 지금 당장 시작해야 한다.', title: null, status: 'DUMP', createdAt: now - 86400000, folderId: null, isDeleted: false },
    { id: 'demo-4', text: '책 읽기, 운동, 글쓰기 — 이 세 가지만 매일 해도 뭔가 달라질 것 같은데. 막상 실천하는 건 왜 이렇게 어렵지.', title: null, status: 'DUMP', createdAt: now - 3600000, folderId: null, isDeleted: false },
  ];
}

// Normalizes a stored memo, providing defaults for fields added in later schema versions.
function normalizeMemo(raw: Record<string, unknown>): MemoItem {
  return {
    id:        String(raw.id    ?? ''),
    text:      String(raw.text  ?? ''),
    title:     raw.title != null ? String(raw.title) : null,
    status:    raw.status === 'DUMP' || raw.status === 'OFF' || raw.status === 'PUBLISH'
                 ? raw.status
                 : 'DUMP',
    createdAt: Number(raw.createdAt ?? 0),
    folderId:  raw.folderId != null ? String(raw.folderId) : null,
    isDeleted: Boolean(raw.isDeleted ?? false),
  };
}

function normalizeFolder(raw: Record<string, unknown>): Folder {
  return {
    id:        String(raw.id        ?? ''),
    name:      String(raw.name      ?? ''),
    createdAt: Number(raw.createdAt ?? 0),
  };
}

const DEFAULT_STATE: State = {
  memos:      [],
  folders:    [],
  settings:   DEFAULT_SETTINGS,
  isHydrated: false,
};

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MEMO':
      return {
        ...state,
        memos: [
          ...state.memos,
          { id: newId('m'), text: action.text, title: null, status: 'DUMP', createdAt: Date.now(), folderId: action.folderId, isDeleted: false },
        ],
      };
    case 'UPDATE_MEMO':
      return { ...state, memos: state.memos.map((m) => m.id === action.id ? { ...m, ...action.patch } : m) };
    case 'DELETE_MEMO':
      return { ...state, memos: state.memos.filter((m) => m.id !== action.id) };
    case 'ADD_FOLDER':
      return {
        ...state,
        folders: [
          ...state.folders,
          { id: newId('f'), name: action.name, createdAt: Date.now() },
        ],
      };
    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.id),
        // Orphaned memos become unassigned (All Memos)
        memos: state.memos.map((m) => m.folderId === action.id ? { ...m, folderId: null } : m),
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'HYDRATE':
      return { memos: action.memos, folders: action.folders, settings: action.settings, isHydrated: true };
    default:
      return state;
  }
}

interface StoreCtx {
  state: State;
  addMemo:        (text: string, folderId?: string | null) => void;
  updateMemo:     (id: string, patch: Memopatch) => void;
  deleteMemo:     (id: string) => void;
  addFolder:      (name: string) => void;
  deleteFolder:   (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const StoreContext = createContext<StoreCtx | null>(null);

export const STORAGE_KEY = 'mind-dump-v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const rawMemos = Array.isArray(parsed.memos) ? (parsed.memos as Record<string, unknown>[]) : [];
        const rawFolders = Array.isArray(parsed.folders) ? (parsed.folders as Record<string, unknown>[]) : [];
        dispatch({
          type:     'HYDRATE',
          memos:    rawMemos.length > 0 ? rawMemos.map(normalizeMemo) : makeDummyMemos(),
          folders:  rawFolders.map(normalizeFolder),
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings as Partial<AppSettings> ?? {}) },
        });
      } else {
        dispatch({ type: 'HYDRATE', memos: makeDummyMemos(), folders: [], settings: DEFAULT_SETTINGS });
      }
    } catch {
      dispatch({ type: 'HYDRATE', memos: makeDummyMemos(), folders: [], settings: DEFAULT_SETTINGS });
    }
  }, []);

  useEffect(() => {
    if (!state.isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ memos: state.memos, folders: state.folders, settings: state.settings }));
  }, [state]);

  return (
    <StoreContext.Provider value={{
      state,
      addMemo:        (text, folderId = null) => dispatch({ type: 'ADD_MEMO', text, folderId }),
      updateMemo:     (id, patch)             => dispatch({ type: 'UPDATE_MEMO', id, patch }),
      deleteMemo:     (id)                    => dispatch({ type: 'DELETE_MEMO', id }),
      addFolder:      (name)                  => dispatch({ type: 'ADD_FOLDER', name }),
      deleteFolder:   (id)                    => dispatch({ type: 'DELETE_FOLDER', id }),
      updateSettings: (patch)                 => dispatch({ type: 'UPDATE_SETTINGS', patch }),
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
