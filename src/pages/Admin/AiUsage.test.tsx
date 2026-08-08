/**
 * F6 PR 2 Phase 5.6.소급 — AiUsage 페이지 date preset + area chart.
 *
 * 매트릭스:
 *   1. 초기 렌더 — "최근 30일" preset 기본 active
 *   2. preset click → 다른 옵션 active 전환 + query refetch (다른 startDate)
 *   3. byHour 데이터 0건 → "데이터 없음" fallback (chart 안 그림)
 *   4. byHour 데이터 있음 → ResponsiveContainer 렌더
 *   5. feature 필터 그룹화 (optgroup) 확인 — "자소서" / "면접" / "Legacy / Deprecated"
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/aiUsage', () => {
  const empty = () => Promise.resolve([])
  return {
    aiUsageApi: {
      overview: vi.fn().mockResolvedValue({
        totalCalls: 0,
        totalCostUsd: 0,
        byFeature: [],
        byStatus: [],
      }),
      byUser: vi.fn().mockResolvedValue([]),
      userDetail: vi.fn(empty),
      byModel: vi.fn(empty),
      byHour: vi.fn(empty),
      hallucination: vi.fn(empty),
      cacheHit: vi.fn().mockResolvedValue({
        noteSummary: { totalLogs: 0, withSummary: 0, ratio: 0 },
        companyResearch: { cacheRows: 0, totalHits: 0, avgHitsPerRow: 0 },
      }),
      monthEstimate: vi.fn().mockResolvedValue({
        monthStart: '2026-05-01T00:00:00Z',
        daysElapsed: 28,
        daysInMonth: 31,
        cumulativeCostUsd: 0,
        estimatedMonthEndUsd: 0,
      }),
    },
  }
})

import { AiUsage } from './AiUsage'
import { aiUsageApi } from '@/api/aiUsage'

const overviewMock = vi.mocked(aiUsageApi.overview)
const byHourMock = vi.mocked(aiUsageApi.byHour)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('AiUsage page — date preset + area chart', () => {
  beforeEach(() => {
    overviewMock.mockClear()
    byHourMock.mockClear()
  })

  it('1) 초기 렌더 — "최근 30일" preset active', async () => {
    render(<AiUsage />, { wrapper })
    await flush()
    const btn30 = screen.getByText('최근 30일')
    expect(btn30.className).toContain('bg-brand')
    // 1d/7d 는 inactive
    expect(screen.getByText('최근 24시간').className).not.toContain('bg-brand')
  })

  it('2) preset 변경 → 다른 옵션 active + query refetch (다른 startDate)', async () => {
    render(<AiUsage />, { wrapper })
    await flush()
    const initialCalls = overviewMock.mock.calls.length
    fireEvent.click(screen.getByText('최근 24시간'))
    await waitFor(() => {
      expect(overviewMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
    expect(screen.getByText('최근 24시간').className).toContain('bg-brand')
    expect(screen.getByText('최근 30일').className).not.toContain('bg-brand')
  })

  it('3) byHour 0건 → "데이터 없음" 표시 (chart fallback)', async () => {
    byHourMock.mockResolvedValue([])
    render(<AiUsage />, { wrapper })
    await flush()
    // 시간별 비용 추이 섹션 안 "데이터 없음"
    expect(screen.getAllByText('데이터 없음').length).toBeGreaterThan(0)
  })

  it('4) feature 필터 그룹화 — optgroup 4개 (자소서 · 면접 · 회사 조사 · 노트 — legacy 제거 2026-07-13)', async () => {
    render(<AiUsage />, { wrapper })
    await flush()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const groups = select.querySelectorAll('optgroup')
    const labels = Array.from(groups).map((g) => g.getAttribute('label'))
    expect(labels).toEqual(['자소서', '면접', '회사 조사', '노트'])
  })

  /**
   * 🔴 **드롭다운이 백엔드 feature 목록보다 뒤처지는 게 이번 사고의 형태다** (2026-08-09).
   *
   * 면접 v2 에서 질문·답변을 분리하며 `interview_prep_answer` 가 생겼는데
   * **`featureLabel.ts` 엔 등록하고 드롭다운엔 안 넣었다.** 목록에는 한글로 잘 떴기 때문에
   * 빠진 걸 눈치채기 어려웠고, 하필 **호출 1위**(137건 · 질문 생성 67건보다 많다)였다.
   *
   * 질문 생성과 답변 생성이 **각각 2코인**이라 섞여 있으면 **어디에 돈이 나가는지 못 가린다.**
   * 필터가 곧 비용 분석 수단이라 누락이 조용히 아프다.
   */
  it('🔴 면접 3종이 모두 필터에 있다 (answer 가 빠져 있었다)', async () => {
    render(<AiUsage />, { wrapper })
    await flush()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const values = Array.from(select.querySelectorAll('option')).map(
      (o) => o.value,
    )
    for (const f of [
      'interview_prep_session',
      'interview_prep_answer',
      'interview_prep_followup',
    ]) {
      expect(values).toContain(f)
    }
  })

  /**
   * 🔴 **`company_research` 를 지우지 말 것.** 백엔드 `FEATURE_MATRIX` 에 없어서 죽은 옵션처럼
   * 보이지만 **과거 로그가 29건 있다** (2026-07-09 유저 트리거 조사 제거 이전 · ADR-040).
   * 지우면 그 이력을 화면에서 영영 못 좁힌다. 실제로 한 번 "죽은 옵션" 으로 오판했었다.
   */
  it('🔴 company_research 는 남아 있다 (과거 이력 29건 조회용)', async () => {
    render(<AiUsage />, { wrapper })
    await flush()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const values = Array.from(select.querySelectorAll('option')).map(
      (o) => o.value,
    )
    expect(values).toContain('company_research')
  })
})
