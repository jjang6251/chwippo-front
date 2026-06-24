import { Navigate, Outlet } from 'react-router-dom'
import { useAiEnabled } from '@/hooks/useAiEnabled'

/**
 * AI 기능 라우트 가드.
 *
 * `VITE_AI_FEATURES_ENABLED=false` 시 dashboard 로 redirect.
 * 자소서·면접·자소서 doc 등 AI 기반 페이지 진입 차단.
 *
 * 복구: company/07_ops/ai-features-disabled.md
 */
export function AiFeatureGuard() {
  const enabled = useAiEnabled()
  if (!enabled) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
