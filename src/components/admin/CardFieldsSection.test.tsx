/**
 * CardFieldsSection — **「템플릿 그대로 쓴 카드」 행**만 좁게 검증한다 (2026-08-28 신설).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 정상 — 분자/분모 + 템플릿별 칩 (상위 5개까지)
 *  2. 🔴 `templateUsage` 가 없으면 **행 자체를 안 그린다** — 프론트가 백엔드보다 먼저 뜨는
 *     배포 창에서 0 으로 그리면 「아무도 안 쓴다」라는 거짓 주장이 된다
 *  3. 소표본(분모 30 미만)은 % 대신 실수 — 기존 `formatShare` 규칙을 그대로 탄다
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CardFieldsSection } from './CardFieldsSection'
import { getAdminCardFields, type CardFieldsData } from '@/api/adminCardFields'

vi.mock('@/api/adminCardFields', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/adminCardFields')>('@/api/adminCardFields')
  return { ...actual, getAdminCardFields: vi.fn() }
})

const getMock = vi.mocked(getAdminCardFields)

/** 최소 골격 — 이 spec 이 보는 건 관측 블록 하나뿐이라 나머지는 0 으로 둔다 */
function makeData(over: Partial<CardFieldsData> = {}): CardFieldsData {
  return {
    cards: 40,
    users: 12,
    excluded: { adminCards: 0, sampleCards: 0 },
    fields: {
      jobTitle: { filled: 0 },
      jobCategory: { filled: 0 },
      jobUrl: { filled: 0 },
      memo: { filled: 0 },
    },
    categoryVocab: { buckets: [], top: [] },
    jobTitleVariance: { usersWithJobTitle: 0, usersWithVariants: 0, groups: [] },
    status: {},
    stepProgress: { atFirstStep: 0, moved: 0, noSteps: 0 },
    companyMatch: { distinctNames: 0, matchedNames: 0, topUnmatched: [] },
    // 행이 보이려면 관측 컬럼이 하나라도 기록돼 있어야 한다 (「아직 안 쌓임」과 가르는 조건)
    templateId: { recorded: 40, distribution: { general: 40 } },
    createdVia: { recorded: 40, distribution: { add_modal: 40 } },
    generatedAt: '2026-08-28T00:00:00Z',
    ...over,
  }
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => vi.clearAllMocks())

describe('CardFieldsSection — 전형 템플릿 그대로 쓴 카드', () => {
  it('1) 분자/분모 + 템플릿별 칩 (상위 5개까지)', async () => {
    getMock.mockResolvedValue(
      makeData({
        templateUsage: {
          withTemplate: 40,
          keptAsIs: 26,
          byTemplate: [
            { templateId: 'general', count: 20, kept: 15 },
            { templateId: 'it_dev', count: 8, kept: 5 },
            { templateId: 'finance', count: 5, kept: 3 },
            { templateId: 'public', count: 4, kept: 2 },
            { templateId: 'health', count: 2, kept: 1 },
            { templateId: 'media', count: 1, kept: 0 },
          ],
        },
      }),
    )
    wrap(<CardFieldsSection />)

    expect(await screen.findByText('전형 템플릿 그대로 쓴 카드')).toBeInTheDocument()
    // 분모 40 → % 표기 (formatShare 의 30 규칙)
    expect(screen.getByText('65% (26/40)')).toBeInTheDocument()
    // `general` 은 위 「시작 템플릿」 분포 칩에도 있어 두 번 나온다 — 이 행의 표식은 kept/count 다
    expect(screen.getAllByText('general').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('15/20')).toBeInTheDocument()
    expect(screen.getByText('5/8')).toBeInTheDocument()
    // 상위 5개까지만 — 6번째(media)는 잘린다
    expect(screen.queryByText('0/1')).toBeNull()
  })

  it('2) 🔴 templateUsage 가 없으면 행 자체를 안 그린다 (거짓 0 금지)', async () => {
    getMock.mockResolvedValue(makeData())
    wrap(<CardFieldsSection />)

    // 형제 블록은 정상적으로 그려진다 — 새 필드 하나 때문에 화면이 죽지 않는다
    expect(await screen.findByText('관측 컬럼 기록 현황')).toBeInTheDocument()
    expect(screen.queryByText('전형 템플릿 그대로 쓴 카드')).toBeNull()
  })

  it('3) 소표본(분모 30 미만)은 % 대신 실수로 적는다', async () => {
    getMock.mockResolvedValue(
      makeData({
        templateUsage: {
          withTemplate: 12,
          keptAsIs: 4,
          byTemplate: [{ templateId: 'general', count: 12, kept: 4 }],
        },
      }),
    )
    wrap(<CardFieldsSection />)

    expect(await screen.findByText('전형 템플릿 그대로 쓴 카드')).toBeInTheDocument()
    expect(screen.getByText('12장 중 4장')).toBeInTheDocument()
  })
})

/**
 * 직무 원문 빈도 — 사전 어휘 작업의 직접 재료 (묶음 0 에서 백엔드만 만들고 화면이 없었다).
 *
 * ## 시나리오
 *  1. 원문 칩이 빈도순으로 보이고 `distinct` 가 전수를 말한다
 *  2. 🔴 화면은 10개까지만 — 잘렸다는 사실을 「상위 N개만 표시」로 알린다 (전수는 distinct)
 *  3. 필드가 없거나 0종이면 행 자체를 안 그린다 (배포 창 · 빈 상태)
 */
describe('CardFieldsSection — 직무 표기 원문', () => {
  it('1) 원문 칩이 빈도순으로 보이고 distinct 가 전수를 말한다', async () => {
    getMock.mockResolvedValue(
      makeData({
        jobTitleVariance: { usersWithJobTitle: 5, usersWithVariants: 0, groups: [] },
        jobTitleTexts: {
          distinct: 3,
          top: [
            { value: '간호사', cards: 4 },
            { value: '지상직', cards: 2 },
            { value: '텔러', cards: 1 },
          ],
        },
      }),
    )
    wrap(<CardFieldsSection />)

    // 「직무 표기 흔들림」 블록 제목과 겹치므로 이 행만의 표식(「종 · 많이 쓰인 순」)으로 집는다
    const head = await screen.findByText(/종 · 많이 쓰인 순/)
    expect(head.textContent).toContain('직무 표기')
    expect(head.textContent).toContain('3')

    expect(screen.getByText('간호사')).toBeInTheDocument()
    expect(screen.getByText('텔러')).toBeInTheDocument()
    // 1장짜리는 숫자를 안 붙인다 (「1」이 줄줄이 붙으면 목록이 안 읽힌다)
    expect(screen.getByText('간호사').textContent).toContain('4')
    expect(screen.getByText('텔러').textContent).toBe('텔러')
    expect(screen.queryByText(/상위 .*개만 표시/)).toBeNull()
  })

  it('2) 🔴 10개까지만 그리고, 잘렸다는 사실을 알린다', async () => {
    getMock.mockResolvedValue(
      makeData({
        jobTitleVariance: { usersWithJobTitle: 20, usersWithVariants: 0, groups: [] },
        jobTitleTexts: {
          distinct: 27,
          top: Array.from({ length: 20 }, (_, i) => ({
            value: `직무${String(i + 1).padStart(2, '0')}`,
            cards: 20 - i,
          })),
        },
      }),
    )
    wrap(<CardFieldsSection />)

    expect(await screen.findByText('직무01')).toBeInTheDocument()
    expect(screen.getByText('직무10')).toBeInTheDocument()
    expect(screen.queryByText('직무11')).toBeNull()
    expect(screen.getByText('상위 10개만 표시')).toBeInTheDocument()
    // 전수는 distinct 가 지킨다 — 27종이라는 사실이 화면에서 사라지지 않는다
    expect(screen.getByText('27')).toBeInTheDocument()
  })

  it('3) 필드가 없거나 0종이면 행 자체를 안 그린다', async () => {
    getMock.mockResolvedValue(makeData())
    const { unmount } = wrap(<CardFieldsSection />)
    expect(await screen.findByText('직무 표기 흔들림')).toBeInTheDocument()
    expect(screen.queryByText(/종 · 많이 쓰인 순/)).toBeNull()
    unmount()

    getMock.mockResolvedValue(makeData({ jobTitleTexts: { distinct: 0, top: [] } }))
    wrap(<CardFieldsSection />)
    expect(await screen.findByText('직무 표기 흔들림')).toBeInTheDocument()
    expect(screen.queryByText(/종 · 많이 쓰인 순/)).toBeNull()
  })
})
