/**
 * `useUpdateJobProfile` — 낙관 갱신 계약 (`plans/job-role-first.md` 묶음 3).
 *
 * 서버가 204 라 응답에 새 값이 없고, `user` 는 `/auth/refresh` 로만 다시 내려온다.
 * 그래서 **여기서 스토어를 안 고치면** 방금 바꾼 직무가 다음 부팅까지 화면에 안 나타나고,
 * 카드 추가 모달 프리필도 옛 값을 계속 채운다.
 *
 * 시나리오:
 *  1. 성공 → 보낸 값이 authStore 에 즉시 반영
 *  2. 🔴 보낸 필드만 — `seriesId` 만 보내면 `signupJobTitle` 은 그대로 (통째 덮기 회귀)
 *  3. 빈 문자열·공백만 → `null` (서버가 저장하는 값과 화면이 어긋나지 않게)
 *  4. 명시적 `null` → `null`
 *  5. 실패 → 토스트 + 🔴 **스토어 불변** (화면만 바뀌고 서버는 옛 값인 상태가 제일 나쁘다)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateJobProfile } from './useJobProfile'
import { useAuthStore } from '@/stores/authStore'
import { patchJobProfile } from '@/api/users'
import { toast } from '@/stores/toastStore'

vi.mock('@/api/users', () => ({ patchJobProfile: vi.fn() }))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function signIn(over: { signupJobTitle?: string | null; signupSeriesId?: string | null } = {}) {
  useAuthStore.getState().setUser({
    id: 'u1',
    nickname: '테스터',
    email: null,
    role: 'user',
    onboardedAt: null,
    termsAgreedAt: null,
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: null,
    signupOtherText: null,
    signupSeriesId: 'health',
    signupJobTitle: '간호',
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    ...over,
  })
}

const stored = () => {
  const user = useAuthStore.getState().user
  return { title: user?.signupJobTitle ?? null, series: user?.signupSeriesId ?? null }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  vi.mocked(patchJobProfile).mockResolvedValue(undefined)
})

describe('useUpdateJobProfile — 낙관 갱신', () => {
  it('1) 성공하면 보낸 값이 authStore 에 즉시 반영된다', async () => {
    signIn()
    const { result } = renderHook(() => useUpdateJobProfile(), { wrapper })

    result.current.mutate({ jobTitle: '간호사', seriesId: 'health' })

    await waitFor(() => expect(stored().title).toBe('간호사'))
    expect(stored().series).toBe('health')
    expect(patchJobProfile).toHaveBeenCalledWith({
      jobTitle: '간호사',
      seriesId: 'health',
    })
  })

  it('2) 🔴 보낸 필드만 갈아 끼운다 — seriesId 만 보내면 직무는 그대로', async () => {
    signIn()
    const { result } = renderHook(() => useUpdateJobProfile(), { wrapper })

    result.current.mutate({ seriesId: 'it' })

    await waitFor(() => expect(stored().series).toBe('it'))
    expect(stored().title).toBe('간호')
  })

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['명시적 null', null],
  ])('3) jobTitle %s → 스토어도 null', async (_label, value) => {
    signIn()
    const { result } = renderHook(() => useUpdateJobProfile(), { wrapper })

    result.current.mutate({ jobTitle: value })

    await waitFor(() => expect(stored().title).toBeNull())
    // 계열은 안 보냈으니 그대로다
    expect(stored().series).toBe('health')
  })

  it('4) seriesId null → 계열이 풀린다', async () => {
    signIn()
    const { result } = renderHook(() => useUpdateJobProfile(), { wrapper })

    result.current.mutate({ seriesId: null })

    await waitFor(() => expect(stored().series).toBeNull())
    expect(stored().title).toBe('간호')
  })

  it('5) 실패하면 토스트 + 스토어는 손도 안 댄다', async () => {
    signIn()
    vi.mocked(patchJobProfile).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useUpdateJobProfile(), { wrapper })

    result.current.mutate({ jobTitle: '간호사', seriesId: 'it' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('저장에 실패했어요. 다시 시도해주세요.'),
    )
    expect(stored()).toEqual({ title: '간호', series: 'health' })
  })
})
