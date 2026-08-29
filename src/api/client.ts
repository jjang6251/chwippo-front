import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { isInNativeApp, postToNative } from '@/utils/nativeBridge'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// 요청 body에 file_url 있으면 추적 — 4xx/5xx 응답 시 R2 cleanup 보상 호출용
type TrackedConfig = InternalAxiosRequestConfig & {
  _trackedFileUrl?: string
  _isCleanupCall?: boolean
  _retry?: boolean
  /** 인터셉터에서 이미 토스트 노출함 — 호출자 catch 핸들러는 중복 토스트 띄우지 말 것 */
  _toastShown?: boolean
}

interface RefreshUser {
  id: string
  nickname: string
  email: string | null
  role: 'user' | 'admin'
  onboardedAt: string | null
  termsAgreedAt: string | null
  aiConsentAt: string | null
  aiConsentVersion: string | null
  /** PR_B1b — 코인 시스템 onboarding modal 표시 여부 */
  onboardedCoinAt: string | null
  /** W1 — signup 1 질문 답변 (null=미답변, []=skip, [...]=직군 array) */
  signupJobCategories: string[] | null
  /** W1 — "기타" 직군 자유 입력 */
  signupOtherText: string | null
  /** 온보딩 계열 1탭 답변 — `JOB_SERIES` id */
  signupSeriesId: string | null
  /** 온보딩에서 사람이 타이핑한 직무 원문 (카드 프리필 재료) */
  signupJobTitle: string | null
  /** W1 — 샘플 카드 전체 dismiss 시각 */
  sampleCardsDismissedAt: string | null
  /** 캘린더 UX 재구성 — 안내 배너 dismiss 시각 */
  calendarHomeIntroDismissedAt: string | null
  /** 알림 — soft-ask 모달 표시 시각 (NULL → native 최초 1회 모달) */
  alarmPromptedAt: string | null
}

interface RefreshResponse {
  data?: { accessToken?: string; user?: RefreshUser }
  accessToken?: string
  user?: RefreshUser
}

export interface RefreshResult {
  accessToken: string
  user: RefreshUser | null
}

/**
 * /auth/refresh single in-flight queue (LRR P1T1 후속, PR D + hotfix-auth-refresh-race).
 * - PR C rotation 도입으로 동시 N개 refresh 호출 시 첫 응답이 옛 token 무효화 → 나머지 fail → logout
 * - queue로 1번만 호출 + 모든 caller가 같은 결과 공유
 * - apiClient(interceptor 포함) 대신 plain axios 사용 — 무한 루프 방지
 * - hotfix: AuthGuard mount-time refresh도 이 queue 사용. dev StrictMode double-fire로 동시 2회
 *   호출되던 race 제거. user 정보도 같이 store에 반영해 AuthGuard 별도 호출 불필요.
 */
let refreshPromise: Promise<RefreshResult> | null = null

/*
  🔬 진단 계측 (R2 원인 규명 · 2026-08-14) — **관측 전용, 락 동작 무관섭**. 원인 확정 후 제거 가능.

  실기(01:31)에서 grant 를 받은 승자가 token 도 release 도 30s 동안 안 보냈다. HTTP 에
  8s 상한이 있으니 늦어도 8s 뒤엔 둘 중 하나가 나와야 하는데 아무것도 안 나왔다 —
  프로덕션 웹의 console 은 logcat 에 안 나와서 웹 안을 볼 수단이 없었다. 아래 breadcrumb 이
  ① grant inject 미도달 ② HTTP 무한 대기 ③ 회전 중 페이지 소멸 을 갈라 준다.
*/

/** 앱 웹뷰에서만 발신. 계측 실패가 회전을 깨면 안 되므로 예외를 밖으로 던지지 않는다. */
function trace(event: string, ms?: number, info?: string): void {
  try {
    if (!isInNativeApp()) return
    postToNative({ type: 'refresh-trace', event, ms, info })
  } catch {
    // 진단이 본 기능을 죽이는 일은 없어야 한다
  }
}

/** 진단 info 용 짧은 식별자 — 응답 본문·URL·토큰은 절대 싣지 않는다 */
function errInfo(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (typeof status === 'number') return `status=${status}`
  const code = (err as { code?: unknown })?.code
  return typeof code === 'string' && code ? `code=${code}` : 'code=none'
}

/**
 * 가설 ③(회전 도중 페이지 소멸 → promise 증발) 판별용. 리로드·렌더러 교체가 회전 구간과
 * 겹치는지 보려는 것이라 한 번만 등록한다 (가드로 중복 등록 차단).
 *
 * 진입점을 performRefresh 로 둔 이유: 모듈 최상단에서 부르면 import 만으로 부수효과가
 * 생겨(브리지 mock 이 부분적인 다른 spec 들이 import 단계에서 깨졌다) 관측이 본 코드의
 * 로딩 계약을 건드린다. 첫 회전 진입에 붙어도 대기·HTTP 구간은 전부 덮인다.
 */
let pageTraceBound = false
function bindPageLifecycleTrace(): void {
  if (pageTraceBound || typeof window === 'undefined' || !isInNativeApp()) return
  pageTraceBound = true
  window.addEventListener('pagehide', () => trace('page:hide'))
  window.addEventListener('visibilitychange', () =>
    trace(document.visibilityState === 'visible' ? 'page:show' : 'page:hide'),
  )
}

export async function performRefresh(): Promise<RefreshResult> {
  bindPageLifecycleTrace()
  if (refreshPromise) {
    trace('enter-dedup')
    return refreshPromise
  }
  trace('enter')
  refreshPromise = refreshWithNativeLock()
    .catch((err: unknown) => {
      handleAuthFailure(err)
      throw err
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

/**
 * 🔴 앱 웹뷰 다중 회전 경합 락 (plan refresh-rotation-lock, 2026-08-13).
 *
 * 하단 탭마다 웹뷰가 1개(최대 5)라 위 single-flight 큐도 웹뷰마다 따로 있다. access 만료
 * 후 잠금·백그라운드에서 복귀하면 N개가 **같은 RT 쿠키로 동시에 회전**해 429(요청 폭주)나
 * 재사용 감지 → 체인 revoke → 강제 로그아웃이 났다 (ADR-080 "회전 주체 1개"가 탭 구조
 * 안에서 다시 깨진 것). 회전 실행은 그대로 웹뷰가 하고 **순서만 네이티브가 중재**한다.
 *
 * 계약 — 모든 실패 모드가 "현행 이하로 안 나빠짐":
 *   - 브라우저(브리지 부재): 이 경로 자체를 안 탄다 → 기존 동작 완전 동일
 *   - grant 수신: HTTP 회전 진행. 성공은 doRefresh 안의 token 브리지가 락 해제를 겸하고,
 *     실패일 때만 refresh-lock-release 를 명시 발신
 *   - token-broadcast 수신: 남이 이미 회전에 성공했다 → **HTTP 없이** 그 토큰으로 resolve
 *   - queued 수신: 남이 락을 쥐고 있다 → 무응답 폴백을 걷고 상한까지 승자를 기다린다
 *   - 무응답: 단독 회전 (= 수리 전 동작). 구앱·브리지 실패에도 새 오류가 생기지 않는다
 */
/**
 * 무응답 폴백 — 네이티브가 **아무 회신도 안 할 때**만 발동한다. 락 관리자가 없는 구앱
 * (웹 번들이 네이티브 빌드보다 먼저 나가는 창)·브리지 사망이 여기 걸리고, 동작은 수리 전과 같다.
 * 정상 앱에선 grant·queued 중 하나가 즉시 오므로 이 타이머는 걷힌다.
 */
const LOCK_GRANT_TIMEOUT_MS = 700
/**
 * 락 대기 절대 상한 — queued 를 받아 대기 중이어도 여기선 반드시 단독 회전으로 풀린다.
 *
 * 🔴 부등식 (2026-08-13 실기 수리): **최악 회전 < 네이티브 holder 타임아웃 < 이 상한**
 *   최악 회전 ≈ 24.75s (3시도 × REFRESH_HTTP_TIMEOUT_MS 8s + 409 backoff 250+500)
 *   < holder 타임아웃 30s (refreshLockManager.HOLDER_TIMEOUT_MS)
 *   < 대기 상한 35s (여기)
 * 승자가 죽어야 비로소 승계 grant 가 오고, 그 뒤에 이 상한이 열리는 순서가 지켜진다.
 *
 * 옛 값 8s 는 "정상 회전 150~400ms" 만 보고 잡은 값이었다. 실기(22:16, 잠금 71분 후 재개)
 * 에서 Wi-Fi 재결합·DNS·TLS 콜드 스타트로 회전 1건이 **10s** 걸리자, 대기자 3개가 승자의
 * 방송(10s)보다 먼저 8s 상한에 걸려 단독 회전으로 흩어졌다 — 가장 필요한 순간에 락이 풀렸다.
 */
export const LOCK_WAIT_MAX_MS = 35000

type LockGate =
  | { kind: 'granted' }
  | { kind: 'broadcast'; accessToken: string }
  | { kind: 'timeout' }

function acquireNativeRefreshLock(reqId: string): Promise<LockGate> {
  return new Promise<LockGate>((resolve) => {
    const requestedAt = Date.now() // 🔬 진단 전용 — 게이트 해소까지 걸린 시간
    let settled = false
    // 무응답 폴백(queued 회신이 오면 걷힌다) + 어떤 경우에도 걷지 않는 절대 상한
    let graceTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => finish({ kind: 'timeout' }),
      LOCK_GRANT_TIMEOUT_MS,
    )
    const capTimer = setTimeout(
      () => finish({ kind: 'timeout' }),
      LOCK_WAIT_MAX_MS,
    )

    function finish(gate: LockGate) {
      if (settled) return
      settled = true
      window.removeEventListener('chwippo:refresh-lock-grant', onGrant)
      window.removeEventListener('chwippo:refresh-lock-queued', onQueued)
      window.removeEventListener('chwippo:token-broadcast', onBroadcast)
      clearTimeout(graceTimer)
      clearTimeout(capTimer)
      trace(`gate:${gate.kind}`, Date.now() - requestedAt)
      resolve(gate)
    }

    // reqId 대조 — 이 웹뷰의 이전 요청에 대한 지각 회신을 현재 요청으로 오인하지 않는다
    function onGrant(e: Event) {
      const detail = (e as CustomEvent).detail as { reqId?: unknown } | undefined
      if (detail?.reqId === reqId) finish({ kind: 'granted' })
    }

    /*
      "큐에 넣었다" 회신 — 락 관리자가 **살아 있다는 증거**다. 무응답 폴백(700ms)만 걷고
      상한(35s)까지 승자의 broadcast·승계 grant 를 기다린다. 이 회신이 없으면 대기자와
      구앱을 구분할 수 없어 승자의 회전이 700ms 만 넘겨도 다 같이 단독 회전해 버렸다.
    */
    function onQueued(e: Event) {
      const detail = (e as CustomEvent).detail as { reqId?: unknown } | undefined
      if (settled || detail?.reqId !== reqId) return
      clearTimeout(graceTimer)
      graceTimer = undefined
      // 🔬 가설 ①(grant inject 미도달)을 가르는 핵심 신호 — 이 웹뷰가 대기자였는지 승자였는지
      trace('gate:queued', Date.now() - requestedAt)
    }

    function onBroadcast(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { accessToken?: unknown }
        | undefined
      const accessToken = detail?.accessToken
      if (typeof accessToken === 'string' && accessToken) {
        finish({ kind: 'broadcast', accessToken })
      }
    }

    window.addEventListener('chwippo:refresh-lock-grant', onGrant)
    window.addEventListener('chwippo:refresh-lock-queued', onQueued)
    window.addEventListener('chwippo:token-broadcast', onBroadcast)
    postToNative({ type: 'refresh-lock-request', reqId })
  })
}

/**
 * 회전 앞단 — 앱 웹뷰에서만 락을 거친다. 브라우저는 doRefresh 직행 (기존 경로 무접촉).
 */
async function refreshWithNativeLock(): Promise<RefreshResult> {
  if (!isInNativeApp()) return doRefresh()

  const startedAt = Date.now() // 🔬 진단 전용 — 락 요청부터 종료까지
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const gate = await acquireNativeRefreshLock(reqId)

  if (gate.kind === 'broadcast') {
    useAuthStore.getState().setAccessToken(gate.accessToken)
    trace('done:ok', Date.now() - startedAt, 'broadcast')
    // 회전 응답이 없으니 user 는 store 현재값 그대로 — broadcast 는 토큰만 나른다.
    return { accessToken: gate.accessToken, user: useAuthStore.getState().user }
  }

  try {
    const result = await doRefresh()
    trace('done:ok', Date.now() - startedAt)
    return result
  } catch (err) {
    /*
      타임아웃 폴백으로 단독 회전한 경우에도 보낸다 — 네이티브가 뒤늦게(승계·holder 타임아웃)
      이 reqId 에 grant 를 찍어 두었을 수 있어, 해제를 생략하면 락이 30s 동안 묶인다.
      모르는 reqId 는 네이티브가 무시하므로 과잉 발신은 무해.
    */
    postToNative({ type: 'refresh-lock-release', reqId })
    trace('done:err', Date.now() - startedAt, errInfo(err))
    throw err
  }
}

/**
 * 회전 1시도의 HTTP 상한 (2026-08-13 실기 수리).
 *
 * 🔴 이 값이 없으면 **회전 소요의 상한 자체가 정의되지 않아** 위 부등식이 성립하지 않는다.
 * 네이티브 holder 타임아웃은 "최악 회전보다 길게" 잡아야 하는데 최악이 무한이면 어떤 값을
 * 골라도 아직 in-flight 인 승자의 락을 뺏게 되고, 대기자가 승계 grant 를 받아 **동시 회전**
 * 한다 — 실기에서 5s 타임아웃이 10s 짜리 회전을 끊고 벌어진 일이 정확히 이것이다.
 * 3시도 × 8s + backoff(250+500) ≈ 24.75s 가 회전 전체의 최악값이 된다.
 *
 * 재시도 대상에 abort(타임아웃) 를 넣어도 **이 최악값은 그대로다** — 시도 수(3)도 backoff 도
 * 그대로고, 매달린 시도의 소요가 8s 로 잘리는 것뿐이라 상한 계산은 전과 동일하다.
 * 즉 부등식(24.75s < holder 30s < 대기 상한 35s)이 그대로 성립해 상수 변경이 필요 없다.
 */
export const REFRESH_HTTP_TIMEOUT_MS = 8000

/**
 * abort 판정 — axios 는 signal.abort() 로 끊긴 요청을 CanceledError(code `ERR_CANCELED`)
 * 로 reject 한다 (xhr 어댑터가 abort 리스너 안에서 곧바로 reject 하므로 네트워크 계층이
 * 죽어 있어도 확실히 나온다). errInfo breadcrumb 도 같은 code 를 찍는다.
 */
function isAbortError(err: unknown): boolean {
  const e = err as { code?: unknown; name?: unknown } | undefined
  return (
    e?.code === 'ERR_CANCELED' ||
    e?.name === 'CanceledError' ||
    e?.name === 'AbortError'
  )
}

/**
 * 재시도 대상 판정.
 * - 409 = 동시 refresh 경합 (세션 지속성 토큰 패밀리) — 승자가 방금 쿠키를 갱신했으나
 *   이 요청이 옛 토큰으로 도착한 순간. 세션은 유효하므로 갱신된 쿠키로 다시 던지면 된다.
 * - abort = 아래 JS 타이머가 끊은 무응답 시도. 매달린 요청도 **서버엔 도달해 회전이 처리된**
 *   경우가 있어(실기: 응답만 못 돌아옴) 기기엔 낡은 RT 만 남는다. 서버 재사용 유예(30s)
 *   안에 다시 던져야 재사용 감지 → 체인 폐기 → 강제 로그아웃을 피한다. 실기에서도 409 를
 *   받은 웹뷰가 250ms 뒤 재시도로 정상 복구했다.
 */
function shouldRetryRefresh(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 409 || isAbortError(err)
}

async function doRefresh(): Promise<RefreshResult> {
  let lastErr: unknown
  /*
    🔴 회전 1건의 **접수번호** — 루프 밖에서 딱 한 번 뽑아 3시도 전부에 같은 값을 싣는다
    (회전 멱등성, plan refresh-rotation-idempotency · 2026-08-15).

    **재시도가 새 id 를 뽑으면 이 수리는 성립하지 않는다.** 서버는 회전 시 소비되는 행에 이
    값을 적어 두고, 같은 값이 다시 오면 "새 시도" 가 아니라 **"같은 회전의 재전송"** 으로
    알아본다 — 그때만 새 토큰을 발급한다. id 가 매번 달라지면 서버 눈에는 소비된 토큰을 든
    남남이 셋 오는 것이라, 지금처럼 409 → 재시도 소진 → (창 밖이면) 세션 revoke 로 끝난다.

    고치는 구멍: 회전이 서버엔 처리됐는데 응답(새 RT 쿠키)만 유실되면 기기엔 이미 소비된
    낡은 RT 만 남아 **재시도가 원리적으로 성공할 수 없었다** (실측 2026-08-14 — 409×3 후
    세션 갇힘, 창을 넘긴 건 401 강제 로그아웃).

    `crypto.randomUUID` 는 Safari 15.4 미만에 없지만 `@/polyfills` 가 main.tsx 첫 import 로
    채운다 (toastStore·BoardDetail 과 같은 전제). 서버는 UUID 형식만 받는다.
  */
  const rotationId = crypto.randomUUID()
  for (let attempt = 0; attempt < 3; attempt++) {
    // 🔬 진단 전용 — 가설 ②(8s 상한을 무시한 채 매달림)는 여기서 http:ok/err 이 안 나오는 걸로 드러난다
    const attemptAt = Date.now()
    trace('http:start', undefined, `attempt=${attempt + 1}`)
    /*
      🔴 시도 1건의 상한을 **우리 JS 타이머로 직접 끊는다** (2026-08-14 실기 수리).

      계측(vc15 · 06:55)에서 긴 백그라운드 복귀 후 첫 회전이 응답도 실패도 없이 30s 를
      통째로 매달렸고 axios 의 `timeout`(= XHR.timeout)은 끝내 발동하지 않았다 — 죽은 소켓을
      잡은 채 네트워크 계층에서 멎는 증상이다. 같은 로그에서 **JS setTimeout 은 2ms 오차로
      정확히 작동**했으므로(대기 상한 35s 발동), 상한 보장은 타이머 + AbortController 몫이다.
      abort 는 xhr 어댑터의 리스너에서 곧바로 reject 되므로 소켓 상태와 무관하게 풀린다.
    */
    const controller = new AbortController()
    const abortTimer = setTimeout(
      () => controller.abort(),
      REFRESH_HTTP_TIMEOUT_MS,
    )
    try {
      const { data } = await axios.post<RefreshResponse>(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        { rotationId },
        {
          withCredentials: true,
          /*
            XHR 타임아웃은 긴 백그라운드 후 발동하지 않는 것이 실측됐다. 이 옵션은 정상
            상황용 보조(먹을 때는 먹는다)이고, 실제 상한은 위 JS 타이머가 보장한다.
          */
          timeout: REFRESH_HTTP_TIMEOUT_MS,
          signal: controller.signal,
        },
      )
      const accessToken = data.data?.accessToken ?? data.accessToken
      const user = data.data?.user ?? data.user ?? null
      trace('http:ok', Date.now() - attemptAt)
      if (!accessToken) {
        throw new Error('Refresh 응답에 accessToken이 없습니다.')
      }
      useAuthStore.getState().setAccessToken(accessToken)
      if (user) useAuthStore.getState().setUser(user)
      /*
        🔴 회전 성공을 네이티브에 알린다 (refresh 단일 주체화 — plan refresh-single-writer).
        앱에선 웹뷰가 유일한 회전자이고, 네이티브(푸시 등록·배지 폴링)는 여기서 받은
        access 를 SecureStore 에 보관해 쓴다. 웹뷰 밖에선 postToNative 가 no-op 이라
        분기 불필요, 구앱은 모르는 메시지를 무시하므로 무해 (핸드셰이크 불요).
      */
      postToNative({ type: 'token', accessToken })
      return { accessToken, user }
    } catch (err) {
      lastErr = err
      trace('http:err', Date.now() - attemptAt, errInfo(err))
      if (shouldRetryRefresh(err) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
        continue // 갱신된 쿠키로 재시도
      }
      throw err // 401 등 인증 실패, 또는 재시도 소진 → caller 처리
    } finally {
      // 성공·실패 어느 경로로 끝나도 걷는다 — 남으면 다음 시도·다음 회전을 뒤늦게 끊는다
      clearTimeout(abortTimer)
    }
  }
  throw lastErr
}

/**
 * Refresh 실패 시 부수효과 — caller catch와 무관하게 한 번만 실행.
 * (performRefresh의 단일 promise catch 체인에 부착되어 다중 caller에도 1회만 호출)
 *
 * 분기:
 * - 429 Too Many Requests: rate limit 도달 — 세션 유효, logout/redirect 금지. 토스트만.
 * - 409 Conflict: 동시 refresh 경합 (재시도 소진) — 세션 유효, logout/redirect 금지.
 * - 응답 없음(네트워크)·5xx: 세션 판정 불가 — 부수효과 전부 금지 (아래 🔴 참조).
 * - 401 등 인증 실패: 세션 만료 — clearAuth + 랜딩 redirect.
 */
export function handleAuthFailure(err: unknown): void {
  // 데모 세션 보호 — 데모 탈출 홉에서 잠깐 마운트된 AuthGuard 의 비동기 인증 실패가
  // 뒤늦게 발사되며 데모 사용자를 랜딩으로 밀어내는 경합 실측 (2026-07-14).
  // 데모 화면에 있는 동안엔 로그아웃/redirect/토스트 전부 무의미하므로 조용히 무시.
  if (window.location?.pathname?.startsWith('/demo')) return
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 429) {
    toast.error(
      '많은 새로고침 요청에 잠시 제한되었습니다. 60초 뒤에 다시 시도해 주세요.',
    )
    return
  }
  // 409 = refresh 경합 재시도 소진 (극히 드묾) — 세션 유효하므로 로그아웃·랜딩 금지.
  // 다음 사용자 액션·새로고침이 갱신된 쿠키로 복구한다.
  if (status === 409) return
  /*
    🔴 응답 없음(status undefined = 네트워크 실패)·5xx(서버 순단)는 **세션 판정 불가**다.
    서버가 "이 세션 죽었다"고 말한 적이 없으므로 clearAuth·랜딩 redirect·토스트·네이티브
    logout 전파를 전부 하지 않고 조용히 빠진다. 회복은 caller 몫 —
    AuthGuard 는 짧은 백오프로 자동 재시도하고, 그 밖에선 다음 사용자 액션이 다시 태운다.

    실측 (2026-08-12): iOS 콜드스타트 직후 네트워크가 준비되기 전 수백 ms 창에서 웹뷰
    AuthGuard 의 첫 refresh 가 네트워크 실패 → 이 아래 fallthrough 로 clearAuth + href='/'
    를 타면서 랜딩이 깜빡 떴다 앱으로 복귀했다. 예전엔 네이티브 선회전이 이 창을 가렸는데
    refresh 단일 주체화(웹뷰 즉시 부팅)로 드러났다.
  */
  if (status === undefined || status >= 500) return
  // 네이티브(WebView) 세션만료 동기화 — 401 확정일 때만 전파.
  // 네트워크·5xx·409·429는 위에서 걸러진다 (계정 교차·오프라인 로그아웃 방지).
  if (status === 401) postToNative({ type: 'logout' })
  useAuthStore.getState().clearAuth()
  const msg = ((err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message ?? '') as string
  if (msg.includes('정지')) {
    toast.error('계정이 정지된 상태입니다. 문의하기를 통해 확인해 주세요.')
  } else {
    toast.error('로그인이 만료되었습니다.')
  }
  /*
    🔴 앱에선 화면 전환이 네이티브 소유다 — 위 logout 브리지를 받은 네이티브가 푸시 기기
    해제 후 로그인 화면으로 바꾼다. 여기서 랜딩으로 밀면 그 대기 시간 동안 랜딩이 보인다
    (세션 만료 로그아웃도 사용자 로그아웃과 같은 깜빡임을 겪고 있었다).
  */
  if (!isInNativeApp()) window.location.href = '/'
}

/** Test-only: refreshPromise singleton을 reset (vitest 사이 isolation) */
export function __resetRefreshPromiseForTest(): void {
  refreshPromise = null
}

apiClient.interceptors.request.use((config: TrackedConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`

  // cleanup 자체 호출은 추적·재호출 대상에서 제외 (무한 루프 방지)
  if (config.url === '/files' && config.method?.toLowerCase() === 'delete') {
    config._isCleanupCall = true
  } else {
    const body = config.data as { file_url?: string; fileUrl?: string } | undefined
    const fileUrl = body?.file_url ?? body?.fileUrl
    if (typeof fileUrl === 'string' && fileUrl.startsWith('http')) {
      config._trackedFileUrl = fileUrl
    }
  }
  return config
})

/**
 * 직무 미입력 400 인지 판별하고, 맞으면 대상 카드 id 를 돌려준다.
 *
 * 인터셉터 본문에서 분리한 이유는 **테스트 가능성** 이다 — 기존 client spec 이
 * `axios.create` 를 mock 해서 인터셉터가 등록되지 않아 직접 태울 수 없다.
 *
 * 백엔드 계약: `chwippo-back/src/applications/job-text.ts` `assertJobTextPresent`
 * 가 `{ code: 'JOB_TITLE_REQUIRED', applicationId, message }` 로 던진다.
 */
export function jobTitleRequiredApplicationId(
  status: number | undefined,
  data: unknown,
): string | null {
  if (status !== 400) return null
  const body = data as { code?: string; applicationId?: string } | undefined
  if (body?.code !== 'JOB_TITLE_REQUIRED') return null
  return typeof body.applicationId === 'string' && body.applicationId
    ? body.applicationId
    : null
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as TrackedConfig | undefined

    // 400 BadRequest: 백엔드 메시지를 토스트로 노출.
    // R2 cleanup이 동반될 경우 cleanup 분기에서 통합 메시지 띄움 — 여기선 file_url 추적 없을 때만.
    const status = error.response?.status
    const backendMsg = (error.response?.data as { message?: string } | undefined)
      ?.message
    const trackedFileUrl = original?._trackedFileUrl
    const willCleanup =
      typeof status === 'number' &&
      status >= 400 &&
      !!trackedFileUrl &&
      !original?._isCleanupCall &&
      status !== 401

    /**
     * 🔴 직무 미입력은 **토스트가 아니라 입력 모달**로 받는다 (2026-08-06).
     *
     * "지원 직무를 먼저 입력해 주세요" 를 토스트로 띄우면 사용자는 어디서 입력하는지
     * 찾아 헤맨다. 할 일이 명확한 에러라 그 자리에서 받는 게 맞다.
     * 저장하면 카드에 반영되므로 다시 누르면 통과한다.
     *
     * 백엔드가 `{ code: 'JOB_TITLE_REQUIRED', applicationId }` 로 구분해 준다
     * (`chwippo-back/src/applications/job-text.ts`). 이 코드가 아니면 기존대로 토스트.
     */
    const jobTitleAppId = jobTitleRequiredApplicationId(status, error.response?.data)
    if (jobTitleAppId) {
      void useJobTitleGateStore.getState().request(jobTitleAppId)
      if (original) original._toastShown = true
      return Promise.reject(error)
    }

    if (
      status === 400 &&
      typeof backendMsg === 'string' &&
      backendMsg.length > 0 &&
      !willCleanup
    ) {
      toast.error(backendMsg)
      if (original) original._toastShown = true
    }

    // R2 고아 파일 보상 cleanup — file_url 포함 요청이 4xx/5xx로 실패하면
    // 백엔드에 DELETE /files 호출 + 백엔드 메시지와 cleanup 안내를 한 토스트로 통합.
    if (willCleanup && trackedFileUrl && original) {
      original._trackedFileUrl = undefined // 한 번만
      try {
        await apiClient.delete('/files', { data: { fileUrl: trackedFileUrl } })
      } catch {
        // cleanup 실패해도 무시 (best-effort) — 사용자 경험엔 영향 없음
      }
      const combined =
        backendMsg && backendMsg.length > 0
          ? `${backendMsg} 다시 첨부해 주세요.`
          : '저장에 실패했습니다. 파일을 다시 첨부해 주세요.'
      toast.error(combined)
      original._toastShown = true
    }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      try {
        const { accessToken: newAccessToken } = await performRefresh()
        original.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(original)
      } catch {
        // handleAuthFailure가 performRefresh catch에서 이미 호출됨 (1회 보장)
        // 여기선 추가 부수효과 없음 — 원본 error를 caller에 reject로 전파
      }
    }

    return Promise.reject(error)
  },
)
