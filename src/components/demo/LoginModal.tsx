import { Modal } from '@/components/common/Modal'
import { useLoginModalStore } from '@/stores/loginModalStore'

function handleKakaoLogin() {
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
}

function handleAppleLogin() {
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/apple`
}

export function LoginModal() {
  const open = useLoginModalStore((s) => s.open)
  const hide = useLoginModalStore((s) => s.hide)

  return (
    <Modal open={open} onClose={hide} title="치뽀 시작하기">
      <p className="text-text-tertiary text-sm leading-relaxed mb-5">
        카카오 계정으로 1초 만에 시작해요.<br />
        지금 둘러본 화면을 <span className="text-text-primary font-medium">내 데이터</span>로 채울 수 있어요.
      </p>
      <button
        onClick={handleKakaoLogin}
        className="w-full flex items-center justify-center gap-2.5 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-lg py-3 transition-colors"
      >
        <KakaoIcon />
        카카오 계정으로 로그인
      </button>
      <button
        onClick={handleAppleLogin}
        className="w-full flex items-center justify-center gap-2.5 bg-black hover:bg-[#1a1a1a] text-white border border-line font-semibold text-sm rounded-lg py-3 transition-colors mt-2.5"
      >
        <AppleIcon />
        Apple로 계속하기
      </button>
      <p className="text-text-quaternary text-[11px] text-center mt-3 leading-relaxed">
        로그인 시{' '}
        <a href="/terms" className="underline hover:text-text-tertiary">이용약관</a>
        {' '}및{' '}
        <a href="/privacy" className="underline hover:text-text-tertiary">개인정보처리방침</a>
        에 동의한 것으로 간주됩니다.
      </p>
      <button
        onClick={hide}
        className="block w-full text-center py-3 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors mt-1"
      >
        둘러보기 계속하기
      </button>
    </Modal>
  )
}

function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 0C4.029 0 0 3.168 0 7.08c0 2.52 1.611 4.734 4.05 6.003L3.06 17.1a.36.36 0 0 0 .54.378L8.37 14.1A10.43 10.43 0 0 0 9 14.16c4.971 0 9-3.168 9-7.08S13.971 0 9 0Z"
        fill="#191919"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  )
}
