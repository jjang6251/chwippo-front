import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  agreeAiConsent,
  withdrawAiConsent,
  CURRENT_AI_CONSENT_VERSION,
} from '@/api/users'
import { toast } from '@/stores/toastStore'

/**
 * AI 사용 동의 토글 — PIPA 26조 (동의/철회 동등 보장).
 *
 * Privacy 페이지 §5 AI 처리 위탁 섹션에 마운트. 현재 동의 상태 + 동의/철회 액션.
 * 모달 (`AiConsentRequiredModal`) 의 "처리방침" 링크가 `#ai-consent` anchor 로 여기에 도달.
 */
export function AiConsentToggle() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false)

  if (!user) {
    return (
      <p className="text-xs text-text-quaternary">
        로그인 후 동의 상태를 관리할 수 있어요.
      </p>
    )
  }

  const consented =
    !!user.aiConsentAt &&
    user.aiConsentVersion === CURRENT_AI_CONSENT_VERSION
  const consentedAt = user.aiConsentAt
    ? new Date(user.aiConsentAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const handleAgree = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await agreeAiConsent(CURRENT_AI_CONSENT_VERSION)
      setUser({
        ...user,
        aiConsentAt: new Date().toISOString(),
        aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
      })
      toast.show('AI 사용 동의가 등록됐어요.')
    } catch {
      toast.error('처리에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await withdrawAiConsent()
      setUser({ ...user, aiConsentAt: null, aiConsentVersion: null })
      setConfirmingWithdraw(false)
      toast.show('AI 사용 동의를 철회했어요.')
    } catch {
      toast.error('철회 처리에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmingWithdraw) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-text-secondary leading-relaxed">
          철회하면 자소서·면접·요약 등 모든 AI 기능 사용이 즉시 중단돼요. 다시 동의하면
          언제든 재개할 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmingWithdraw(false)}
            disabled={submitting}
            className="flex-1 px-3 py-2 text-xs font-medium text-text-tertiary bg-card hover:bg-card-strong border border-line rounded-md transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={submitting}
            className="flex-1 px-3 py-2 text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? '처리 중...' : '동의 철회'}
          </button>
        </div>
      </div>
    )
  }

  if (consented) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs">
          <p className="text-success font-medium mb-0.5">✓ AI 사용 동의 완료</p>
          {consentedAt && (
            <p className="text-text-quaternary">
              {consentedAt} 동의 (버전 {user.aiConsentVersion})
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setConfirmingWithdraw(true)}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-text-tertiary hover:text-danger border border-line hover:border-danger/30 rounded-md transition-colors"
        >
          철회
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs">
        <p className="text-text-tertiary font-medium mb-0.5">AI 기능 사용 안 함</p>
        <p className="text-text-quaternary">동의 시 자소서·면접·요약 기능을 사용할 수 있어요.</p>
      </div>
      <button
        type="button"
        onClick={handleAgree}
        disabled={submitting}
        className="shrink-0 px-3 py-1.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-md transition-colors disabled:opacity-50"
      >
        {submitting ? '처리 중...' : '동의하기'}
      </button>
    </div>
  )
}
