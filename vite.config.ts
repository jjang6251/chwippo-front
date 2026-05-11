import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // 단위 테스트 가능한 영역만 측정 — pure utils + 명시적으로 테스트 작성한 컴포넌트
      include: [
        'src/utils/**/*.{ts,tsx}',
        'src/components/card/StarToggle.tsx',
        'src/components/card/StepBar.tsx',
        'src/components/card/DdayBadge.tsx',
        'src/components/myinfo/FileUpload.tsx',
        'src/components/myinfo/MyinfoProgressGauge.tsx',
        'src/components/myinfo/ConvertExamToCertModal.tsx',
        'src/components/myinfo/AddExamScheduleModal.tsx',
      ],
      exclude: ['src/**/*.test.{ts,tsx}'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
})
