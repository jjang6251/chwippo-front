import { Link } from 'react-router-dom'
import { useLoginModalStore } from '@/stores/loginModalStore'

export function DemoBanner() {
  const showLogin = useLoginModalStore((s) => s.show)
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-brand/10 border-b border-brand/15 text-xs">
      <span className="text-text-secondary truncate">
        🔍 둘러보는 중이에요
        <span className="text-text-tertiary"> — 샘플 데이터예요. 가입하면 내 데이터로 시작해요.</span>
      </span>
      <div className="flex items-center gap-1.5 flex-none">
        <Link
          to="/"
          state={{ demoExit: true }}
          className="text-[11px] font-medium text-text-tertiary hover:text-text-secondary px-2 py-1.5 rounded-md transition-colors"
        >
          둘러보기 종료
        </Link>
        <button
          onClick={showLogin}
          className="text-[11px] font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover px-2.5 py-1.5 rounded-md transition-colors"
        >
          무료로 시작하기
        </button>
      </div>
    </div>
  )
}
