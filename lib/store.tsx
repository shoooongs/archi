'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { MemoItem, AppSettings } from './types';

interface State {
  memos: MemoItem[];
  settings: AppSettings;
  isHydrated: boolean;
}

type Action =
  | { type: 'ADD_MEMO'; text: string }
  | { type: 'UPDATE_MEMO'; id: string; patch: Partial<Pick<MemoItem, 'text' | 'title' | 'status'>> }
  | { type: 'DELETE_MEMO'; id: string }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<AppSettings> }
  | { type: 'HYDRATE'; memos: MemoItem[]; settings: AppSettings };

const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: 'serif',
  fontSize: 'base',
  bgMode: 'color',
  bgColor: '#f5f5f4',
  bgImage: null,
  hideOff: false,
  darkMode: false,
};

// Shown only on the very first visit (no localStorage data yet).
// Timestamps are computed lazily inside the effect, not at module load,
// so they never drift between SSR and client evaluation.
function makeDummyMemos(): MemoItem[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      text: '오늘 아침 커피를 마시며 생각했는데, 결국 중요한 건 매일 조금씩 나아지는 것 같다.',
      title: null,
      status: 'DUMP',
      createdAt: now - 86400000 * 3,
    },
    {
      id: 'demo-2',
      text: '생각을 그냥 흘려보내는 게 아니라 어딘가 잡아두는 게 필요하다. 너무 복잡하지 않게, 딱 필요한 것만.',
      title: null,
      status: 'DUMP',
      createdAt: now - 86400000 * 2,
    },
    {
      id: 'demo-3',
      text: '루틴보다는 루틴을 만들어가는 과정 자체가 나를 바꾸는 것 같다. 완벽한 루틴을 기다리지 말고 지금 당장 시작해야 한다.',
      title: null,
      status: 'DUMP',
      createdAt: now - 86400000,
    },
    {
      id: 'demo-4',
      text: '책 읽기, 운동, 글쓰기 — 이 세 가지만 매일 해도 뭔가 달라질 것 같은데. 막상 실천하는 건 왜 이렇게 어렵지.',
      title: null,
      status: 'DUMP',
      createdAt: now - 3600000,
    },
  ];
}

// Server and client both start from this identical empty state,
// so there is never a hydration mismatch.
const DEFAULT_STATE: State = {
  memos: [],
  settings: DEFAULT_SETTINGS,
  isHydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MEMO':
      return {
        ...state,
        memos: [
          ...state.memos,
          {
            // crypto.randomUUID() is undefined on non-secure (HTTP) origins,
            // so use a time+random string that works everywhere.
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
            text: action.text,
            title: null,
            status: 'DUMP',
            createdAt: Date.now(),
          },
        ],
      };
    case 'UPDATE_MEMO':
      return {
        ...state,
        memos: state.memos.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m
        ),
      };
    case 'DELETE_MEMO':
      return { ...state, memos: state.memos.filter((m) => m.id !== action.id) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'HYDRATE':
      return { memos: action.memos, settings: action.settings, isHydrated: true };
    default:
      return state;
  }
}

interface StoreCtx {
  state: State;
  addMemo: (text: string) => void;
  updateMemo: (id: string, patch: Partial<Pick<MemoItem, 'text' | 'title' | 'status'>>) => void;
  deleteMemo: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const StoreContext = createContext<StoreCtx | null>(null);

const STORAGE_KEY = 'mind-dump-v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Read localStorage once on mount.
  // Must run before the save effect so we never overwrite real data with the empty initial state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({
          type: 'HYDRATE',
          memos: Array.isArray(parsed.memos) && parsed.memos.length > 0
            ? parsed.memos
            : makeDummyMemos(),
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        });
      } else {
        // First visit — seed with demo content so the screen is not blank.
        dispatch({ type: 'HYDRATE', memos: makeDummyMemos(), settings: DEFAULT_SETTINGS });
      }
    } catch {
      dispatch({ type: 'HYDRATE', memos: makeDummyMemos(), settings: DEFAULT_SETTINGS });
    }
  }, []);

  // Persist to localStorage — guarded by isHydrated so we never
  // overwrite the user's saved data with the empty default state.
  useEffect(() => {
    if (!state.isHydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ memos: state.memos, settings: state.settings }),
    );
  }, [state]);

  return (
    <StoreContext.Provider
      value={{
        state,
        addMemo: (text) => dispatch({ type: 'ADD_MEMO', text }),
        updateMemo: (id, patch) => dispatch({ type: 'UPDATE_MEMO', id, patch }),
        deleteMemo: (id) => dispatch({ type: 'DELETE_MEMO', id }),
        updateSettings: (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch }),
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
