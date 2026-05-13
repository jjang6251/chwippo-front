import { Modal } from '@/components/common/Modal'
import { useLoginModalStore } from '@/stores/loginModalStore'

function handleKakaoLogin() {
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
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
