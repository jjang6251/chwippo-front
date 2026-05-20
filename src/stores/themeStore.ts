import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'chwippo-theme'

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}

function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored === 'light' || stored === 'system' ? stored : 'dark'
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
