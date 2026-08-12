// ⚠️ 반드시 **첫 줄** — ES module import 는 선언 순서대로 평가되므로, 구형 WebKit 에 없는
// 내장 API 는 Sentry 초기화·의존성(tiptap 등) 로드보다 먼저 전역에 채워져 있어야 한다.
// 아래로 내리면 그 사이 코드가 먼저 실행돼 폴리필 전에 터진다.
import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import App from './App.tsx'
import { requireEnvs } from '@/utils/requireEnvs'
import { initClarity } from '@/lib/clarity'
import { initSentry, setSentryUser } from '@/lib/sentry'
import { useAuthStore } from '@/stores/authStore'
import './index.css'

// dayjs 전역 한국어 locale — 요일·월 이름 한글화 (예: 활동 타임라인 "(Mo)" → "(월)").
// 숫자 포맷(YYYY-MM-DD·HH:mm)은 영향 없음. 앱 진입점에서 1회 설정.
dayjs.locale('ko')

// 필수 env 가드 — 누락 시 silent failure(axios baseURL=undefined → 자체 도메인 404) 방지
requireEnvs(['VITE_API_URL'], import.meta.env)

// 에러 추적 — render 전에 초기화해야 초기 렌더 크래시도 잡힌다.
// VITE_SENTRY_DSN 미설정이면 no-op 이므로 requireEnvs 대상이 아니다 (로컬·CI 무영향).
initSentry()
// 행태 분석 — VITE_CLARITY_PROJECT_ID 미설정이면 no-op. 방침 시행일(8/11) 전까지 미주입.
initClarity()
// 로그인 상태를 Sentry user 에 반영 — **id 만** 전달 (개인정보처리방침 §1)
let lastUserId: string | null = null
useAuthStore.subscribe((state) => {
  const id = state.user?.id ?? null
  if (id === lastUserId) return
  lastUserId = id
  setSentryUser(id)
})

// 다크모드 항상 켜기 (치뽀는 다크 전용)
document.documentElement.classList.add('dark')

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)