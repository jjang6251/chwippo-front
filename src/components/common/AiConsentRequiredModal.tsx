import { useState } from 'react'
import { Sparkle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Modal } from './Modal'
import { useAiConsentStore } from '@/stores/aiConsentStore'
import { useAuthStore } from '@/stores/authStore'
import { agreeAiConsent, CURRENT_AI_CONSENT_VERSION } from '@/api/users'
import { toast } from '@/stores/toastStore'

/**
 * AI feature 호출 직전 consent 가 없을 때 띄우는 강제 모달.
 *
 * useRequireAiConsent() 가 useAiConsentStore.request() 호출 → 이 모달 표시.
 * [동의하고 계속] → POST /users/me/ai-consent → authStore.user.aiConsentAt 즉시 갱신 → resolve(true)
 * [취소] / 배경 클릭 → resolve(false) (caller 가 silent skip)
 *
 * AppShell layer 에 1개만 마운트.
 */
export function AiConsentRequiredModal() {
  const open = useAiConsentStore((s) => s.open)
  const agree = useAiConsentStore((s) => s.agree)
  const decline = useAiConsentStore((s) => s.decline)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [submitting, setSubmitting] = useState(false)

  const handleAgree = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await agreeAiConsent(CURRENT_AI_CONSENT_VERSION)
      if (user) {
        setUser({
          ...user,
          aiConsentAt: new Date().toISOString(),
          aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
        })
      }
      agree()
    } catch {
      toast.error('동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={decline}
      title="AI 사용 동의가 필요해요"
      width="max-w-md"
    >
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-text-secondary">
          치뽀의 AI 기능 (자소서 작성·면접 준비·노트 요약 등) 을 사용하려면 입력 내용이
          외부 AI 서비스로 전송돼요. 동의하지 않으면 AI 기능을 사용할 수 없어요.
        </p>

        <div className="bg-card border border-line rounded-lg p-3.5 space-y-2 text-xs text-text-tertiary">
          <div className="flex gap-2">
            <Sparkle size={14} strokeWidth={1.75} className="text-brand shrink-0" aria-hidden="true" />
            <span>
              <b className="text-text-secondary">처리 위탁:</b> OpenAI · Anthropic
              (모델 호출 목적)
            </span>
          </div>
          <div className="flex gap-2">
            <Sparkle size={14} strokeWidth={1.75} className="text-brand shrink-0" aria-hidden="true" />
            <span>
              <b className="text-text-secondary">자동 마스킹:</b> 전화번호·이메일·주민번호
              등 PII 는 전송 전 자동 치환
            </span>
          </div>
          <div className="flex gap-2">
            <Sparkle size={14} strokeWidth={1.75} className="text-brand shrink-0" aria-hidden="true" />
            <span>
              <b className="text-text-secondary">철회 가능:</b> 언제든
              <Link
                to="/privacy#ai-consent"
                onClick={decline}
                className="text-brand hover:underline mx-1"
              >
                개인정보 처리방침
              </Link>
              에서 자세히 확인 (PIPA 26조)
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={decline}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-text-tertiary bg-card hover:bg-card-strong border border-line rounded-md transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleAgree}
            disabled={submitting}
            className="flex-[1.5] px-4 py-2.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? '처리 중...' : '동의하고 계속'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
