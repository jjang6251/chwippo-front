import { Modal } from '@/components/common/Modal'
import { recordAlarmPrompt } from '@/api/notifications'
import { postToNative } from '@/utils/nativeBridge'
import { useAuthStore } from '@/stores/authStore'

interface PermissionPromptModalProps {
  open: boolean
  onClose: () => void
}

/**
 * soft-ask 모달 — 로그인 후 최초 1회 (native + alarm_prompted_at NULL).
 *
 * iOS 네이티브 프롬프트는 평생 1회라, 커스텀 모달로 맥락을 먼저 설명해
 * 승낙 확률을 높이고 그 기회를 보호한다 (OneSignal·Batch 표준 패턴).
 * 거부해도 재요청 없음 — 설정 페이지에서만 다시 켤 수 있게 안내.
 */
export function PermissionPromptModal({
  open,
  onClose,
}: PermissionPromptModalProps) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  /** prompted_at 로컬 반영 — 재노출 차단 (서버는 native/이 호출이 갱신) */
  function markPromptedLocally() {
    if (user) setUser({ ...user, alarmPromptedAt: new Date().toISOString() })
  }

  async function handleAllow() {
    markPromptedLocally()
    // native OS 권한 프롬프트 트리거 (실제 granted 는 native 가 alarm-prompt 로 동기화)
    postToNative({ type: 'request-notification-permission' })
    // web 측에서도 prompted_at 기록 (재노출 방지). granted 는 native 가 최종 반영.
    await recordAlarmPrompt(false).catch(() => undefined)
    onClose()
  }

  async function handleLater() {
    markPromptedLocally()
    await recordAlarmPrompt(false).catch(() => undefined)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleLater} title="알림을 받으시겠어요?">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand/12 flex items-center justify-center text-3xl mb-4">
          🔔
        </div>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          마감·면접이 다가오면 앱을 열지 않아도 챙겨드려요.
        </p>

        <div className="w-full bg-surface-2 border border-line rounded-xl p-4 mb-2 text-left">
          <p className="text-xs text-text-tertiary leading-relaxed">
            예를 들면 이렇게 알려드려요
          </p>
          <p className="text-sm text-text-primary mt-2 leading-relaxed">
            📅 카카오 서류 마감 · 오늘
            <br />
            ⏰ 네이버 1차 면접 · D-1
          </p>
        </div>

        <p className="text-[11px] text-text-quaternary mb-5">
          하루 최대 2번 · 밤 10시~아침 8시엔 보내지 않아요
        </p>

        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAllow}
            className="w-full rounded-lg bg-brand text-white text-sm font-semibold py-3 hover:bg-brand-hover transition-colors"
          >
            알림 받기
          </button>
          <button
            type="button"
            onClick={handleLater}
            className="w-full rounded-lg text-text-tertiary text-sm font-medium py-2.5 hover:text-text-secondary transition-colors"
          >
            나중에
          </button>
        </div>

        <p className="text-[11px] text-text-quaternary mt-3 leading-relaxed">
          나중에 <span className="text-text-tertiary">설정 › 알림 설정</span>{' '}
          에서 언제든 켤 수 있어요.
        </p>
      </div>
    </Modal>
  )
}
