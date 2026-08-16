import { useCallback, useEffect } from 'react'
import { Coins } from 'lucide-react'
import { useSetCoinOnboarded } from '@/hooks/useMyCoin'
import { useAuthStore } from '@/stores/authStore'

/**
 * PR_B1b — 코인 시스템 onboarding modal.
 *
 * **노출 조건**: user.onboardedCoinAt === null (첫 로그인 1회만).
 * **닫기**: POST /me/coin-onboarded → onboardedCoinAt = NOW + authStore 갱신.
 *
 * **내용**:
 * - 치뽀 코인 = AI 사용량 통합 매트릭스
 * - Free 100 코인/월 (자소서 약 8개 + 면접 약 10세션 + 답변 20개)
 * - 더 많이 필요하면 Lite/Standard 결제 (chip 클릭 → ProUpgradeModal)
 */
export function CoinOnboardingModal() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { mutate, isPending } = useSetCoinOnboarded()

  const handleClose = useCallback(() => {
    if (!user) return
    mutate(undefined, {
      onSuccess: (result) => {
        // authStore 의 user 갱신 — 다음부터 modal 안 보임
        setUser({ ...user, onboardedCoinAt: result.onboardedAt })
      },
    })
  }, [user, mutate, setUser])

  // ESC key → close (mutate trigger)
  useEffect(() => {
    if (!user || user.onboardedCoinAt !== null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user, handleClose])

  // 로그인 X 또는 이미 onboarded → 안 보임
  if (!user || user.onboardedCoinAt !== null) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-md bg-surface border border-line rounded-xl p-6 shadow-2xl">
        <h2
          id="coin-onboarding-title"
          className="text-text-primary text-lg font-bold mb-1 flex items-center gap-2"
        >
          <Coins size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          <span>치뽀 코인을 소개해요</span>
        </h2>
        <p className="text-text-tertiary text-xs mb-4">
          AI 기능 사용량을 코인으로 통합 관리해요.
        </p>

        {/* 무료 한도 */}
        <div className="bg-surface-2 border border-line rounded-md px-4 py-3 mb-3">
          <div className="text-text-primary text-sm font-semibold mb-2">
            🎁 가입 환영 — 150 코인 (Free 한도 100 + 보너스 50)
          </div>
          <ul className="text-text-tertiary text-xs leading-relaxed space-y-1">
            <li>· 자소서 초안 생성 약 12개</li>
            <li>· 자소서 chat 수정 약 50번</li>
            <li>· 면접 질문 생성 약 15세션</li>
            <li>· 면접 답변 생성 약 25개</li>
          </ul>
        </div>

        {/* 무료 매월 갱신 */}
        <div className="bg-info/10 border border-info/30 rounded-md px-4 py-2.5 mb-4">
          <p className="text-text-secondary text-xs leading-relaxed">
            💚 <strong>매월 1일 0시</strong> 자동 충전 — 100 코인.{' '}
            <strong>회사 조사</strong>와 <strong>활동 노트 AI 요약</strong>은 별도라
            코인 차감 없어요.
          </p>
        </div>

        {/* Pro 안내 */}
        <p className="text-text-tertiary text-xs leading-relaxed mb-4">
          더 많이 쓰고 싶다면 우측 상단{' '}
          <Coins size={13} strokeWidth={1.75} className="inline-block align-[-0.125em]" aria-hidden="true" />{' '}
          chip 클릭 → Lite (월 800 코인) /
          Standard (월 1500 코인) 안내.
        </p>

        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="w-full bg-brand hover:bg-accent text-bg text-sm font-semibold px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '확인했어요'}
        </button>
      </div>
    </div>
  )
}
