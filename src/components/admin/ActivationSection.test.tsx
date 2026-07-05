/**
 * A8 — ActivationSection 테스트.
 *
 * 시나리오:
 * 1. 정상 로드 → 코호트 행 (주차·아하 % 계산) + funnel 단계 + 브리핑 상관 %
 * 2. 빈 코호트 → "아직 코호트 데이터가 없어요"
 * 3. 브리핑 표본 0 → "브리핑 발송 데이터가 아직 없어요"
 * 4. 상관 라벨 "인과 아님" 항상 노출 (오독 방지)
 * 5. cohortSize 0 division 방어 → '—'
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ActivationSection } from './ActivationSection'
import { getAdminActivation, type ActivationData } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAdminActivation: vi.fn(),
}))

const getMock = vi.mocked(getAdminActivation)

const DATA: ActivationData = {
  cohorts: [
    { weekStart: '2026-06-29', cohortSize: 10, setup: 6, ahaBeta: 3, ahaAi: 0, d7: 4, d30: 1 },
  ],
  funnel: { signup: 10, setup: 6, ahaBeta: 3, d7: 4 },
  briefing: { receivedUserDays: 30, actedRateRead: 65, actedRateUnread: 20 },
  generatedAt: '2026-07-06T12:00:00Z',
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('ActivationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 로드 — 코호트 행 % 계산 + funnel + 브리핑 상관', async () => {
    getMock.mockResolvedValue(DATA)
    wrap(<ActivationSection />)

    expect(await screen.findByText('6/29 주')).toBeInTheDocument()
    // ahaBeta 3/10 = 30%
    expect(screen.getByText('30%')).toBeInTheDocument()
    // funnel 단계 라벨
    expect(screen.getByText('아하 (3일 내 마감카드 2개)')).toBeInTheDocument()
    expect(screen.getByText('D7 재방문')).toBeInTheDocument()
    // 브리핑 상관
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('상관 라벨 "인과 아님" 노출 (오독 방지)', async () => {
    getMock.mockResolvedValue(DATA)
    wrap(<ActivationSection />)

    expect(await screen.findByText('상관관계 · 인과 아님')).toBeInTheDocument()
  })

  it('빈 코호트 → 수집 중 안내', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      cohorts: [],
      funnel: { signup: 0, setup: 0, ahaBeta: 0, d7: 0 },
    })
    wrap(<ActivationSection />)

    expect(
      await screen.findByText('아직 코호트 데이터가 없어요'),
    ).toBeInTheDocument()
  })

  it('브리핑 표본 0 → 발송 데이터 없음 안내', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      briefing: { receivedUserDays: 0, actedRateRead: null, actedRateUnread: null },
    })
    wrap(<ActivationSection />)

    expect(
      await screen.findByText('브리핑 발송 데이터가 아직 없어요'),
    ).toBeInTheDocument()
  })

  it('API 실패 → 에러 안내 (무한 "불러오는 중" 방지)', async () => {
    getMock.mockRejectedValue(new Error('500'))
    wrap(<ActivationSection />)

    expect(
      await screen.findByText('불러오지 못했어요 — 잠시 후 새로고침해주세요'),
    ).toBeInTheDocument()
    expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument()
  })

  it('cohortSize 0 → division 방어 (—)', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      cohorts: [
        { weekStart: '2026-06-29', cohortSize: 0, setup: 0, ahaBeta: 0, ahaAi: 0, d7: 0, d30: 0 },
      ],
    })
    wrap(<ActivationSection />)

    expect(await screen.findByText('6/29 주')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5)
  })
})
