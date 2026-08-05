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
  briefing: {
    receivedUserDays: 60,
    read: { acted: 26, total: 40 },   // 65% — 분모 40 이라 % 표기
    unread: { acted: 4, total: 20 },  // 분모 20 이라 소표본 표기
  },
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
    // 🔴 코호트 10명은 소표본 → % 가 아니라 실수로 표기 (3/10). 1명 중 1명을 100% 로 쓰던 문제
    expect(screen.getByText('3/10')).toBeInTheDocument()
    // funnel 단계 라벨
    expect(screen.getByText('아하 (3일 내 마감카드 2개)')).toBeInTheDocument()
    expect(screen.getByText('D7 재방문')).toBeInTheDocument()
    // 브리핑 상관 — 분모에 따라 표기가 갈린다 (같은 규칙, 같은 포매터)
    expect(screen.getByText('65% (26/40)')).toBeInTheDocument()
    expect(screen.getByText('20명 중 4명')).toBeInTheDocument()
  })

  // 🔴 이 규칙이 풀리면 "1명 중 1명 = 100%" 가 제품 판단 화면에 되돌아온다
  it('소표본 코호트에는 % 를 쓰지 않는다', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      cohorts: [
        { weekStart: '2026-06-29', cohortSize: 1, setup: 1, ahaBeta: 1, ahaAi: 0, d7: 1, d30: 0 },
      ],
      funnel: { signup: 1, setup: 1, ahaBeta: 1, d7: 1 },
    })
    wrap(<ActivationSection />)

    expect(await screen.findByText('6/29 주')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getAllByText('1/1').length).toBeGreaterThan(0)
  })

  it('표본이 충분하면(≥30) % 를 쓴다', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      cohorts: [
        { weekStart: '2026-06-29', cohortSize: 40, setup: 20, ahaBeta: 10, ahaAi: 0, d7: 8, d30: 4 },
      ],
      funnel: { signup: 40, setup: 20, ahaBeta: 10, d7: 8 },
    })
    wrap(<ActivationSection />)

    expect(await screen.findByText('6/29 주')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument() // ahaBeta 10/40
  })

  // 가입 행의 비율은 계산값이 아니라 분모 그 자체다 — '100%' 로 쓰면 계산 결과로 오해된다
  it('퍼널 가입 행은 "기준" 으로 표기한다 (100% 는 계산값이 아니다)', async () => {
    getMock.mockResolvedValue(DATA)
    const { container } = wrap(<ActivationSection />)

    expect(await screen.findByText('6/29 주')).toBeInTheDocument()
    // `{value}명 · {rate}` 로 렌더돼 텍스트 노드가 쪼개진다 — textContent 로 판정
    expect(container.textContent).toContain('10명 · 기준')
  })

  // 🔴 코호트만 고치고 브리핑을 놔두면 **같은 화면 안에서 규칙이 엇갈린다**
  it('브리핑 상관도 소표본에는 % 를 쓰지 않는다', async () => {
    getMock.mockResolvedValue({
      ...DATA,
      briefing: {
        receivedUserDays: 4,
        read: { acted: 2, total: 3 },
        unread: { acted: 0, total: 1 },
      },
    })
    wrap(<ActivationSection />)

    expect(await screen.findByText('3명 중 2명')).toBeInTheDocument()
    expect(screen.getByText('1명 중 0명')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
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
      briefing: {
        receivedUserDays: 0,
        read: { acted: 0, total: 0 },
        unread: { acted: 0, total: 0 },
      },
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
