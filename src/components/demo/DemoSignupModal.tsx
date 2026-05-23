import { Modal } from '@/components/common/Modal'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
import { useLoginModalStore } from '@/stores/loginModalStore'

export function DemoSignupModal() {
  const open = useDemoSignupStore((s) => s.open)
  const hide = useDemoSignupStore((s) => s.hide)
  const showLogin = useLoginModalStore((s) => s.show)

  const goLogin = () => {
    hide()
    showLogin()
  }

  return (
    <Modal open={open} onClose={hide} title="데모에서는 저장되지 않아요">
      <div className="text-2xl mb-3" aria-hidden>✨</div>
      <p className="text-text-tertiary text-sm leading-relaxed mb-1">지금 보고 있는 건 미리 만들어둔 샘플 데이터예요.</p>
      <p className="text-text-secondary text-sm leading-relaxed mb-5">
        가입하면 방금 한 작업을 <span className="text-text-primary font-medium">내 진짜 데이터</span>에 그대로 시작할 수 있어요.
      </p>
      <button
        onClick={goLogin}
        className="block w-full text-center py-3 text-xs font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors mb-2"
      >
        카카오로 시작하기
      </button>
      <button
        onClick={hide}
        className="block w-full text-center py-3 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors"
      >
        더 둘러보기
      </button>
    </Modal>
  )
}
