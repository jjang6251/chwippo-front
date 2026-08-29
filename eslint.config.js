import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noBareAutofocus from './eslint-rules/no-bare-autofocus.js'
import noOverlayBottomPadding from './eslint-rules/no-overlay-bottom-padding.js'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  /*
    치뽀 재발 방지 규칙 — 2026-08-30 iPhone 실사고 두 건을 코드가 아니라 린트가 막게 한다.
    ① 모달 첫 칸 `autoFocus` → 열자마자 키보드가 화면을 덮었다.
    ② 오버레이 컨테이너 하단 여백 → 시트와 탭바 사이에 검은 띠가 남았다.
    둘 다 주석으로는 이미 알려져 있었는데(AddEventSheet 2026-07-25) 강제하는 게 없어 재발했다.
    테스트·e2e 는 스니펫이라 제외.
  */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'e2e/**', 'src/test/**'],
    plugins: {
      chwippo: { rules: { 'no-bare-autofocus': noBareAutofocus, 'no-overlay-bottom-padding': noOverlayBottomPadding } },
    },
    rules: {
      'chwippo/no-bare-autofocus': 'error',
      'chwippo/no-overlay-bottom-padding': 'error',
    },
  },
])
