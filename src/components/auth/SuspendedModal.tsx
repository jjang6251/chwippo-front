import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isInNativeApp, postToNative } from '@/utils/nativeBridge'

/**
 * PR_B2 Phase 1 — Q13 정지된 사용자 로그인 시 표시되는 모달.
 *
 * dismiss 불가 (ESC / 바깥 클릭 무효). 사유 + 정지 시점 + 예상 해제일 (영구) + 문의하기 link + 로그아웃.
 *
 * 표시 조건: `me/coin-balance` 응답의 `suspendedAt` 가 NULL 아님.
 */
interface Props {
  suspendedAt: string
  suspendReason: string | null
  suspendExpiresAt: string | null
}

function formatKstDateTime(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function ddayLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return '곧 해제 예정'
  const days = Math.ceil(ms / 86400000)
  return `${days}일 후 해제 예정`
}

export function SuspendedModal({
  suspendedAt,
  suspendReason,
  suspendExpiresAt,
}: Props) {
  const handleLogout = () => {
    useAuthStore.getState().clearAuth()
    /*
      🔴 브리지 발신이 여기만 빠져 있었다. 앱에서 정지 로그아웃을 하면 네이티브
      SecureStore 가 안 지워져, 재시작 때 토큰이 있다고 낙관 진입했다가 401 을 맞고
      나서야 정리됐다. 다른 로그아웃 경로와 같은 계약으로 맞춘다.
    */
    postToNative({ type: 'logout' })
    // 앱에선 화면 전환이 네이티브 소유 — 랜딩을 그리면 네이티브 전환 대기 동안 그대로 보인다
    if (!isInNativeApp()) window.location.href = '/'
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspended-title"
    >
      <div className="w-full max-w-md bg-card border border-line rounded-xl px-6 py-7 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-danger text-xl" aria-hidden="true">
            ⛔
          </span>
          <h2
            id="suspended-title"
            className="text-text-primary text-lg font-bold"
          >
            계정이 정지되었습니다
          </h2>
        </div>

        <div className="bg-danger/10 border border-danger/20 rounded-md px-3 py-2.5">
          <p className="text-text-quaternary text-[10px] mb-1">정지 사유</p>
          <p className="text-text-secondary text-sm whitespace-pre-line">
            {suspendReason ?? '사유가 명시되지 않았습니다.'}
          </p>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-text-quaternary">정지 시점</dt>
            <dd className="text-text-secondary font-mono">
              {formatKstDateTime(suspendedAt)} (KST)
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-quaternary">해제 예정</dt>
            <dd className="text-text-secondary font-mono">
              {suspendExpiresAt
                ? `${formatKstDateTime(suspendExpiresAt)} · ${ddayLabel(suspendExpiresAt)}`
                : '영구'}
            </dd>
          </div>
        </dl>

        <div className="flex gap-2 pt-1">
          <Link
            to="/inquiry"
            className="flex-1 bg-brand hover:bg-accent text-bg text-sm font-semibold px-4 py-2.5 rounded-md text-center transition-colors"
          >
            문의하기
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 bg-card-strong hover:bg-surface-2 border border-line text-text-secondary text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
