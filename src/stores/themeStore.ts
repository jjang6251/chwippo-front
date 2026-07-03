import { create } from 'zustand'
import { postToNative } from '@/utils/nativeBridge'

export type Theme = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'chwippo-theme'

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  // chwippo-mobile WebView 로 sync (bridge 없는 환경 · no-op)
  postToNative({ type: 'theme', theme: resolved })
}

function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'system' || stored === 'dark') return stored
  return 'system'
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitial(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))

// 초기 1회 적용 + system 모드일 때 OS 변경 감지
if (typeof window !== 'undefined') {
  applyTheme(loadInitial())
  if (window.matchMedia) {
    window
      .matchMedia('(prefers-color-scheme: light)')
      .addEventListener('change', () => {
        if (useThemeStore.getState().theme === 'system') applyTheme('system')
      })
  }
}
