import { useEffect } from 'react'
import { useAiFeedbackStore } from '@/stores/aiFeedbackStore'

/**
 * A1 — 자소서 AI 점검 진행 중 페이지 이탈(새로고침·탭 닫기) 경고.
 *
 * AiFeedbackSection 은 모달 안이라 닫히면 사라진다 → 이탈 가드는 페이지 레벨에
 * 붙어야 한다 (CoverletterDocPage 에 1회 부착). 스토어 구독 기반이라 어느 문항이
 * 점검 중이어도 동작.
 */
export function useAiFeedbackUnloadGuard() {
  const running = useAiFeedbackStore((s) =>
    Object.values(s.entries).some((e) => e.status === 'running'),
  )

  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])
}
