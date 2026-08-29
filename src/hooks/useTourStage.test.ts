/**
 * 투어 마지막 장이 돌아갈 **내 카드** 판정 (`plans/app-tour.md` v3).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 온보딩 픽이 있으면 그게 내 카드다
 *  2. 픽이 여러 장이면 **생성순 첫 장** — 화면에서 본 순서대로 담겼기 때문
 *  3. 픽이 없으면 가장 오래된 실카드 (다시 보기로 들어온 기존 사용자)
 *  4. 🔴 샘플 카드는 「내 카드」가 아니다 (가상 회사)
 *  5. 카드 0장 → `null` (CTA 가 「첫 카드 만들기」로 갈린다)
 *  6. 로딩 중이면 `loading: true` — 화면은 스켈레톤
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTourStage } from './useTourStage'
import { useApplications } from '@/hooks/useApplications'
import type { Application } from '@/types/application'

vi.mock('@/hooks/useApplications', () => ({ useApplications: vi.fn() }))

const appsMock = vi.mocked(useApplications)
type AppsResult = ReturnType<typeof useApplications>

function mockApps(data: Application[] | undefined, isPending = false) {
  appsMock.mockReturnValue({ data, isPending } as unknown as AppsResult)
}

function app(over: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    userId: 'u1',
    companyName: '대한항공',
    jobTitle: '승무원',
    jobCategory: null,
    status: 'PLANNED',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    isSample: false,
    createdVia: 'onboarding_pick',
    steps: [],
    createdAt: '2026-08-28T00:00:00Z',
    updatedAt: '2026-08-28T00:00:00Z',
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('useTourStage — 마지막 장의 내 카드', () => {
  it('1) 온보딩 픽이 있으면 그게 내 카드다', () => {
    mockApps([app()])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application?.companyName).toBe('대한항공')
    expect(result.current.loading).toBe(false)
  })

  it('2) 픽이 여러 장이면 생성순 첫 장 (화면에서 본 순서)', () => {
    mockApps([
      app({ id: 'b', companyName: '아시아나항공', createdAt: '2026-08-28T00:00:02Z' }),
      app({ id: 'a', companyName: '대한항공', createdAt: '2026-08-28T00:00:01Z' }),
    ])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application?.companyName).toBe('대한항공')
  })

  it('2-b) 🔴 온보딩을 다시 거쳤으면 옛 픽이 아니라 **최근 온보딩의 첫 픽** (8/29 실기: 매번 대한항공)', () => {
    mockApps([
      app({ id: 'old', companyName: '대한항공', createdAt: '2026-08-28T05:06:00Z' }),
      app({ id: 'n2', companyName: '오늘의집', createdAt: '2026-08-29T10:00:02Z' }),
      app({ id: 'n1', companyName: '무신사', createdAt: '2026-08-29T10:00:01Z' }),
    ])
    const { result } = renderHook(() => useTourStage())

    // 최신 묶음(8/29 10:00) 중 화면에서 먼저 본 무신사 — 하루 전 대한항공은 지난 온보딩
    expect(result.current.application?.companyName).toBe('무신사')
  })

  it('3) 픽이 없으면 가장 오래된 실카드 (다시 보기 경로)', () => {
    mockApps([
      app({ id: 'x', companyName: '카카오', createdVia: 'add_modal' }),
      app({
        id: 'y',
        companyName: '네이버',
        createdVia: null,
        createdAt: '2026-07-01T00:00:00Z',
      }),
    ])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application?.companyName).toBe('네이버')
  })

  it('4) 🔴 샘플 카드는 내 카드가 아니다', () => {
    mockApps([
      app({
        id: 's',
        companyName: 'Sample Corp',
        isSample: true,
        createdVia: 'onboarding_sample',
      }),
    ])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application).toBeNull()
  })

  it('4-b) 샘플과 실카드가 섞여 있으면 실카드를 고른다', () => {
    mockApps([
      app({ id: 's', isSample: true, createdVia: 'onboarding_sample' }),
      app({ id: 'r', companyName: '무신사', createdVia: 'add_modal' }),
    ])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application?.companyName).toBe('무신사')
  })

  it('5) 카드 0장 → null (CTA 가 「첫 카드 만들기」로 갈린다)', () => {
    mockApps([])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('6) 캐시가 아직 없으면 loading (화면은 스켈레톤)', () => {
    mockApps(undefined, true)
    const { result } = renderHook(() => useTourStage())

    expect(result.current.loading).toBe(true)
    expect(result.current.application).toBeNull()
  })

  /**
   * 🔴 「못 받아왔다」와 「0장」은 **다른 상태**다 (2026-08-29). 같이 묶으면 카드를 가진
   * 사람이 조회 한 번 실패했다고 마지막 장에서 「첫 카드 만들기」를 본다.
   */
  it('6-b) 조회 실패(데이터 없음·pending 아님) → failed · 로딩 끝', () => {
    mockApps(undefined, false)
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.failed).toBe(true)
  })

  it('6-c) 성공했는데 0장은 실패가 아니다', () => {
    mockApps([])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.failed).toBe(false)
  })

  it('6-d) 로딩 중은 아직 실패가 아니다 (스켈레톤 자리)', () => {
    mockApps(undefined, true)
    const { result } = renderHook(() => useTourStage())

    expect(result.current.loading).toBe(true)
    expect(result.current.failed).toBe(false)
  })

  it('createdAt 이 깨진 카드가 있어도 던지지 않는다 (렌더 중 호출)', () => {
    mockApps([
      app({ id: 'bad', createdAt: 'not-a-date', createdVia: 'add_modal' }),
      app({ id: 'ok', companyName: '토스', createdVia: 'add_modal' }),
    ])
    const { result } = renderHook(() => useTourStage())

    expect(result.current.application?.companyName).toBe('토스')
  })
})
