import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// 소스맵은 **Sentry 업로드가 가능할 때만** 생성한다.
// 생성해두고 업로드하지 않으면 .map 이 그대로 배포돼 URL 추측으로 소스 전체가 노출된다
// (참조 주석이 없는 'hidden' 이어도 파일 자체는 서빙된다).
// 토큰 없음(로컬·CI·프리뷰) → 소스맵 미생성 → 노출 경로 자체가 없음.
const sentryUpload = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)

export default defineConfig({
  plugins: [
    react(),
    // 업로드 후 .map 을 dist 에서 삭제 — 배포본에 남기지 않는다
    ...(sentryUpload
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VERCEL_GIT_COMMIT_SHA || undefined },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            // 플러그인이 기본으로 빌드 텔레메트리를 Sentry 에 보낸다 — 필요 없는 외부 송신이라 끈다.
            telemetry: false,
          }),
        ]
      : []),
  ],
  // Sentry release 식별자 — 어느 배포에서 난 에러인지 알아야 한다.
  // Vercel 이 빌드 시 주입하는 시스템 변수는 VITE_ 접두사가 없어 클라이언트에 노출되지 않으므로 여기서 주입.
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? '',
    ),
  },
  build: {
    // 'hidden' = .map 은 만들되 번들에 참조 주석을 넣지 않는다 (devtools 노출 방지).
    // 업로드 가능할 때만 켜고, 플러그인이 업로드 직후 .map 을 삭제한다. 위 sentryUpload 주석 참조.
    sourcemap: sentryUpload ? 'hidden' : false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // dayjs 와 locale 을 함께 사전번들 — 따로 최적화되면 dayjs/locale/ko 가 dayjs 내부 export(`t`)를
  // 못 찾는 Vite deps 이슈 방지 ("does not provide an export named 't'")
  optimizeDeps: {
    include: ['dayjs', 'dayjs/locale/ko'],
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
        // admin 사용 환경 표시 — 테스트를 먼저 붙이고 목록에 넣는다 (순서 뒤집으면 threshold 에 즉시 걸린다)
        'src/components/admin/PlatformBadges.tsx',
        'src/components/admin/PlatformDistributionCard.tsx',
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
