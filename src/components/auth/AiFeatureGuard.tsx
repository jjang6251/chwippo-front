import { Navigate, Outlet } from 'react-router-dom'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'

/**
 * AI 기능 라우트 가드.
 *
 * flag off 시 dashboard 로 redirect — 자소서 라우트는 `AiFeatureGuard`,
 * 면접 라우트는 `InterviewAiGuard` (비공개 유지 중).
 *
 * flag 정책: src/hooks/useAiEnabled.ts
 */
export function AiFeatureGuard() {
  const enabled = useAiEnabled()
  if (!enabled) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function InterviewAiGuard() {
  const enabled = useInterviewAiEnabled()
  if (!enabled) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
