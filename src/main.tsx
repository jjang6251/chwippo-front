import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import App from './App.tsx'
import { requireEnvs } from '@/utils/requireEnvs'
import './index.css'

// dayjs 전역 한국어 locale — 요일·월 이름 한글화 (예: 활동 타임라인 "(Mo)" → "(월)").
// 숫자 포맷(YYYY-MM-DD·HH:mm)은 영향 없음. 앱 진입점에서 1회 설정.
dayjs.locale('ko')

// 필수 env 가드 — 누락 시 silent failure(axios baseURL=undefined → 자체 도메인 404) 방지
requireEnvs(['VITE_API_URL'], import.meta.env)

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