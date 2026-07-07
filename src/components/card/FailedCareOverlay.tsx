import { useEffect } from 'react'
import { useCelebrationStore } from '@/stores/celebrationStore'
import { FailedCareContent } from './FailedCareContent'

/**
 * A9 — 탈락 케어 전역 오버레이 (App 마운트).
 *
 * 불합격 처리 순간 카드가 보드 기본 필터(FAILED 숨김)로 언마운트되므로,
 * 카드 내부 모달로는 케어 화면이 뜨자마자 사라짐 → 합격 CelebrationOverlay 와
 * 같은 전역 스토어 패턴. 스텝 판정은 처리 시점 스냅샷 사용.
 */
export function FailedCareOverlay() {
  const data = useCelebrationStore((s) => s.failedCare)
  const dismiss = useCelebrationStore((s) => s.dismissFailedCare)

  // ESC 닫기 — CelebrationOverlay 패턴
  useEffect(() => {
    if (!data) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data, dismiss])

  if (!data) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="탈락 기록 완료"
        className="bg-surface border border-line rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-text-primary font-semibold text-sm mb-3">기록됐어요</h3>
        <FailedCareContent
          applicationId={data.applicationId}
          app={{ currentStepIndex: data.currentStepIndex, steps: data.steps }}
          onDone={dismiss}
        />
      </div>
    </div>
  )
}
