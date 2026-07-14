import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'

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
  return { accessToken, user }
}

/**
 * Refresh 실패 시 부수효과 — caller catch와 무관하게 한 번만 실행.
 * (performRefresh의 단일 promise catch 체인에 부착되어 다중 caller에도 1회만 호출)
 *
 * 분기:
 * - 429 Too Many Requests: rate limit 도달 — 세션 유효, logout/redirect 금지. 토스트만.
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
  useAuthStore.getState().clearAuth()
  const msg = ((err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message ?? '') as string
  if (msg.includes('정지')) {
    toast.error('계정이 정지된 상태입니다. 문의하기를 통해 확인해 주세요.')
  } else {
    toast.error('로그인이 만료되었습니다.')
  }
  window.location.href = '/'
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
