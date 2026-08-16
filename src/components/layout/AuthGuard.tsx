import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { performRefresh } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { resolvePostLoginDestination } from '@/utils/authRouting'
import { isInNativeApp } from '@/utils/nativeBridge'

/** 부팅 refresh 가 막힌 사유 — 랜딩으로 튕기는 대신 안내 카드로 받는다 */
type BlockedReason = 'rate-limit' | 'conflict' | 'network'

/**
 * 🔴 네트워크 실패 자동 재시도 백오프 (ms). 배열 길이 = 재시도 횟수.
 *
 * iOS 콜드스타트 직후 네트워크가 준비되기 전 수백 ms 창을 덮는 값이다. 대부분 첫
 * 재시도에서 붙어 사용자는 스플래시가 한 박자 길어진 정도로만 체감한다.
 */
const NETWORK_RETRY_DELAYS_MS = [700, 1500]

const BLOCKED_COPY: Record<BlockedReason, { title: string; body: string }> = {
  'rate-limit': {
    title: '많은 새로고침 요청에 잠시 제한되었습니다',
    body: '60초 뒤에 다시 시도해 주세요. 세션은 그대로 유지됩니다.',
  },
  /*
    🔴 409 를 429 문구로 받고 있었다 — 사용자가 **자기가 너무 많이 눌러서** 막힌 걸로
    오해한다. 실제 409 는 기기 안 여러 화면이 동시에 세션을 갱신하다 순서가 엇갈린 것으로,
    사용자 행동과 무관하고 60초를 기다릴 이유도 없다 (바로 다시 시도하면 된다).
  */
  conflict: {
    title: '로그인 정보를 갱신하는 중이에요',
    body: '잠시 후 다시 시도해 주세요. 로그인 상태는 그대로 유지됩니다.',
  },
  network: {
    title: '연결이 불안정해요',
    body: '잠시 후 다시 시도해 주세요. 로그인 상태는 그대로 유지됩니다.',
  },
}

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/** 응답 없음(네트워크)·5xx = 세션 판정 불가 — 로그아웃이 아니라 재시도 대상 */
function isUndecidable(status: number | undefined): boolean {
  return status === undefined || status >= 500
}

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [checking, setChecking] = useState(!accessToken)
  const [blocked, setBlocked] = useState<BlockedReason | null>(null)

  useEffect(() => {
    if (accessToken) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // performRefresh single-flight queue 사용 — dev StrictMode double-fire/멀티 caller 시
    // 동일 promise 공유로 HTTP 1회만 호출. PR C rotation race 방지 (hotfix-auth-refresh-race).
    // user·accessToken은 queue 내부에서 store에 반영됨.
    // 실패 분기의 부수효과(토스트·clearAuth·랜딩 redirect)는 handleAuthFailure 담당 —
    // 여기선 "무엇을 화면에 보여줄지"만 정한다.
    const attempt = (retryCount: number) => {
      performRefresh()
        .then(() => {
          if (!cancelled) setChecking(false)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const status = statusOf(err)
          // 429(rate limit)·409(refresh 경합 재시도 소진) 둘 다 세션 유효 —
          // 랜딩 redirect 대신 현재 URL 유지하며 재시도 안내.
          // 원인이 다르므로 문구도 나눈다 (409 를 429 문구로 받으면 사용자가 자기 탓으로 오해).
          if (status === 429 || status === 409) {
            setBlocked(status === 409 ? 'conflict' : 'rate-limit')
            setChecking(false)
            return
          }
          if (isUndecidable(status)) {
            /*
              🔴 콜드스타트 랜딩 flash 수리 (2026-08-12).
              세션이 죽었다는 증거가 없으므로 랜딩으로 보내지 않는다. 재시도하는 동안
              checking 을 유지해 빈 화면(스플래시)에 머문다 — 여기서 setChecking(false) 를
              하면 accessToken 이 없어 아래 <Navigate to="/" /> 가 랜딩을 깜빡 띄운다.
            */
            if (retryCount < NETWORK_RETRY_DELAYS_MS.length) {
              timer = setTimeout(
                () => attempt(retryCount + 1),
                NETWORK_RETRY_DELAYS_MS[retryCount],
              )
              return
            }
            setBlocked('network')
            setChecking(false)
            return
          }
          // 401 등 세션 만료 확정 — handleAuthFailure 가 clearAuth + 랜딩 redirect 처리.
          setChecking(false)
        })
    }
    attempt(0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking) return null
  if (blocked) {
    const copy = BLOCKED_COPY[blocked]
    return (
      <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
        <div
          role="alert"
          className="w-full max-w-sm bg-card border border-line rounded-xl px-6 py-8 text-center"
        >
          <h2 className="text-base font-semibold mb-2">{copy.title}</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            {copy.body}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand hover:bg-accent active:bg-accent-hover text-bg text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }
  /*
    🔴 **앱 웹뷰에선 랜딩을 그리지 않는다** (2026-08-12 로그아웃 깜빡임 수리).

    로그아웃 핸들러가 `navigate('/')` 를 안 해도, `clearAuth()` 구독 재렌더가 이 줄을
    통과시켜 랜딩을 그린다 — 핸들러 수정만으로는 절대 안 막힌다.
    앱 안에서 화면 전환은 네이티브 소유다. 네이티브는 logout 브리지를 받고 푸시 기기
    해제(오프라인 대비 1.5s 상한)를 마친 뒤 `/login` 으로 바꾼다. 그동안 웹뷰는 보이므로
    여기서 빈 화면으로 버틴다 — 웹뷰 unmount 는 네이티브가 곧 처리한다.
  */
  if (!accessToken) return isInNativeApp() ? null : <Navigate to="/" replace />
  // /terms-agreement 자체는 제외 — 리다이렉트 루프 방지
  if (user && location.pathname !== '/terms-agreement') {
    const dest = resolvePostLoginDestination(user.termsAgreedAt)
    if (dest === '/terms-agreement') return <Navigate to="/terms-agreement" replace />
  }
  return <Outlet />
}
