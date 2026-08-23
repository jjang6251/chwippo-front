import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { OpsCompanyResearchPage } from './OpsCompanyResearchPage'
import {
  adminResearchApi,
  type ResearchExportResult,
  type ResearchRow,
  type ResearchSummary,
} from '@/api/adminResearch'
import { toast } from '@/stores/toastStore'

/**
 * 🔴 이 화면은 **다음 조사 배치의 입력**을 만든다. 잘못 뽑아도 화면은 멀쩡해 보이므로
 * 사고로 이어지는 성질 세 개를 회귀로 고정한다:
 *  ① 내보내기는 **현재 페이지가 아니라 전 범위** — 1페이지 행만 나오면 실패
 *  ② 상한에 걸리면 **잘렸다고 말한다** — 조용한 절단이 최악(조사 대상을 놓치고도 모름)
 *  ③ 「목록 밖」 배지 — 「까까오」(오타)와 「한솔로지스틱스」(비상장 실존)가 같아 보이면 안 된다
 */

vi.mock('@/api/adminResearch', async (orig) => ({
  ...(await orig<typeof import('@/api/adminResearch')>()),
  adminResearchApi: {
    summary: vi.fn(),
    unified: vi.fn(),
    exportAll: vi.fn(),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const api = vi.mocked(adminResearchApi)

const summary: ResearchSummary = {
  totalCompanies: 3798,
  researchedCount: 351,
  researchedNames: 366,
  coverageRate: 0.092,
  versionDistribution: [{ version: '2026-08.1', count: 351 }],
  optOutCount: 0,
  expiringSoonCount: 0,
  expiredCount: 0,
  avgFillRate: 0.9,
}

const row = (over: Partial<ResearchRow> = {}): ResearchRow => ({
  companyName: '카카오',
  researched: true,
  seedVersion: '2026-08.1',
  applicants: 3,
  cards: 5,
  hitCount: 12,
  updatedAt: '2026-08-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  inferredCount: 0,
  optOut: false,
  knownCompany: true,
  similarTo: null,
  ...over,
})

const exportResult = (
  over: Partial<ResearchExportResult> = {},
): ResearchExportResult => ({
  items: [{ companyName: '카카오', applicants: 3, cards: 5 }],
  total: 1,
  limit: 500,
  truncated: false,
  ...over,
})

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const writeText = vi.fn((_text: string) => Promise.resolve())
const createObjectURL = vi.fn(() => 'blob:mock')

describe('OpsCompanyResearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.summary.mockResolvedValue(summary)
    api.unified.mockResolvedValue({ items: [row()], total: 1 })
    api.exportAll.mockResolvedValue(exportResult())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  const copyBtn = () => screen.getByRole('button', { name: '전체 복사' })
  const csvBtn = () => screen.getByRole('button', { name: 'CSV' })

  // ── 실존 배지 (🔴 ③) ──

  it('DART 목록에 있는 회사 → DART 표시, 「목록 밖」 아님', async () => {
    wrap(<OpsCompanyResearchPage />)
    expect(await screen.findByText('DART')).toBeInTheDocument()
    expect(screen.queryByText('목록 밖')).not.toBeInTheDocument()
  })

  it('🔴 목록 밖 회사 → 「목록 밖」 배지 + 유사명 제안', async () => {
    api.unified.mockResolvedValue({
      items: [row({ companyName: '까까오', knownCompany: false, similarTo: '카카오' })],
      total: 1,
    })
    wrap(<OpsCompanyResearchPage />)

    expect(await screen.findByText('목록 밖')).toBeInTheDocument()
    expect(screen.getByText('카카오 와 유사?')).toBeInTheDocument()
  })

  it('🔴 목록 밖이지만 가까운 이름이 없으면 제안을 만들지 않는다 (비상장 실존 회사)', async () => {
    api.unified.mockResolvedValue({
      items: [
        row({ companyName: '한솔로지스틱스', knownCompany: false, similarTo: null }),
      ],
      total: 1,
    })
    const { container } = wrap(<OpsCompanyResearchPage />)

    expect(await screen.findByText('목록 밖')).toBeInTheDocument()
    expect(container.textContent).not.toContain('와 유사?')
  })

  it('헤더와 셀의 열 개수가 맞는다 (실존 열 추가로 밀리면 숫자가 딴 열에 붙는다)', async () => {
    const { container } = wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')

    const headers = [...container.querySelectorAll('thead th')]
    const cells = [...container.querySelectorAll('tbody tr:first-child td')]
    expect(headers.map((th) => th.textContent)).toContain('실존')
    expect(cells).toHaveLength(headers.length)
  })

  // ── 전체 내보내기 (🔴 ①) ──

  it('🔴 내보내기는 현재 페이지가 아니라 전 범위를 요청한다 (별도 export 호출)', async () => {
    api.unified.mockResolvedValue({ items: [row()], total: 45 }) // 3페이지 분량
    api.exportAll.mockResolvedValue(
      exportResult({
        items: Array.from({ length: 45 }, (_, i) => ({
          companyName: `회사${i}`,
          applicants: 1,
          cards: 1,
        })),
        total: 45,
      }),
    )
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    // 1페이지 행(1개)이 아니라 전 범위 45개
    const copied = writeText.mock.calls[0][0]
    expect(copied.split(' · ')).toHaveLength(45)
    // 목록 쿼리를 재활용하지 않는다 (그게 이 기능의 존재 이유)
    expect(api.exportAll).toHaveBeenCalledTimes(1)
  })

  it('🔴 현재 필터·정렬·검색이 내보내기에 그대로 반영된다', async () => {
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')

    fireEvent.click(screen.getByRole('button', { name: '미조사' }))
    fireEvent.click(screen.getByRole('button', { name: /카드/ }))
    fireEvent.click(copyBtn())

    await waitFor(() =>
      expect(api.exportAll).toHaveBeenCalledWith({
        search: undefined,
        filter: 'unresearched',
        sort: 'cards',
        order: 'desc',
      }),
    )
    // page·limit 은 보내지 않는다 — 전 범위라는 계약이 흐려진다
    expect(api.exportAll.mock.calls[0][0]).not.toHaveProperty('page')
  })

  it('복사는 회사명만 구분자로 잇는다 (조사 프롬프트에 그대로 붙여넣는 용도)', async () => {
    api.exportAll.mockResolvedValue(
      exportResult({
        items: [
          { companyName: '카카오', applicants: 3, cards: 5 },
          { companyName: '네이버', applicants: 2, cards: 2 },
        ],
        total: 2,
      }),
    )
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('카카오 · 네이버'))
    // 지원자·카드 수가 섞이면 프롬프트가 오염된다
    expect(writeText.mock.calls[0][0]).not.toContain('3')
  })

  it('CSV 버튼 → 파일을 만든다', async () => {
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(csvBtn())
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
  })

  // ── 상한 절단 (🔴 ②) ──

  it('🔴 상한 초과 → 화면에 「전체 N개 중 상위 M개」를 남긴다', async () => {
    api.exportAll.mockResolvedValue(
      exportResult({
        items: Array.from({ length: 500 }, (_, i) => ({
          companyName: `회사${i}`,
          applicants: 1,
          cards: 1,
        })),
        total: 1200,
        truncated: true,
      }),
    )
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    const notice = await screen.findByRole('status')
    expect(notice.textContent).toContain('전체 1,200개')
    expect(notice.textContent).toContain('상위 500개')
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('전체 1,200개 중 상위 500개'),
    )
  })

  it('상한에 안 걸리면 절단 안내를 띄우지 않는다 (없는 경고를 만들지 않는다)', async () => {
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // ── 상태 · 실패 ──

  it('결과가 0건이면 내보내기 버튼이 비활성', async () => {
    api.unified.mockResolvedValue({ items: [], total: 0 })
    wrap(<OpsCompanyResearchPage />)

    await waitFor(() => expect(copyBtn()).toBeDisabled())
    expect(csvBtn()).toBeDisabled()
  })

  it('내보내기 실패 → 토스트만, 화면은 유지', async () => {
    api.exportAll.mockRejectedValue(new Error('boom'))
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('내보내기에 실패했어요.'),
    )
    expect(screen.getByText('카카오')).toBeInTheDocument()
  })

  it('내보내는 동안 버튼이 잠긴다 (연타로 중복 요청 금지)', async () => {
    let resolve!: (v: ResearchExportResult) => void
    api.exportAll.mockReturnValue(
      new Promise<ResearchExportResult>((r) => (resolve = r)),
    )
    wrap(<OpsCompanyResearchPage />)
    await screen.findByText('카카오')
    fireEvent.click(copyBtn())

    await waitFor(() => expect(copyBtn()).toBeDisabled())
    fireEvent.click(copyBtn())
    expect(api.exportAll).toHaveBeenCalledTimes(1)

    resolve(exportResult())
    await waitFor(() => expect(copyBtn()).not.toBeDisabled())
  })
})
