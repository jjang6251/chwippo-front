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

export async function performRefresh(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise
  refreshPromise = doRefresh()
    .catch((err: unknown) => {
      handleAuthFailure(err)
      throw err
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

async function doRefresh(): Promise<RefreshResult> {
  // 409 = 동시 refresh 경합 (세션 지속성 토큰 패밀리) — 새로고침 연타·멀티탭에서
  // 승자가 방금 쿠키를 갱신했으나 이 요청이 옛 토큰으로 도착한 순간. 세션은 유효하므로
  // 짧은 backoff 후 갱신된 쿠키로 재시도하면 성공한다 (로그아웃 아님).
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await axios.post<RefreshResponse>(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const accessToken = data.data?.accessToken ?? data.accessToken
      const user = data.data?.user ?? data.user ?? null
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
      const status = (err as { response?: { status?: number } })?.response
        ?.status
      if (status === 409 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
        continue // 갱신된 쿠키로 재시도
      }
      throw err // 401 등 인증 실패, 또는 409 재시도 소진 → caller 처리
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
