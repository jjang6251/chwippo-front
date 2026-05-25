/* eslint-disable react-refresh/only-export-components */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query'
import type { ActivityLog, SummarizeNoteResult } from '@/types/activity'
import { AISummarySection } from './AISummarySection'

// useSummarizeLog mock — mutationFn 호출 결과를 setMockResult 로 결정
const mockState = vi.hoisted(() => ({
  result: null as unknown as SummarizeNoteResult | Error,
}))
function setMockResult(r: SummarizeNoteResult | Error) {
  mockState.result = r
}

vi.mock('@/hooks/useActivities', () => ({
  useSummarizeLog: () =>
    useMutation({
      mutationFn: async () => {
        if (mockState.result instanceof Error) throw mockState.result
        return mockState.result
      },
    }),
}))

vi.mock('@/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// ── fixtures ────────────────────────────────────────────────────────────
const makeLog = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 'log-1',
  activityId: 'act-1',
  userId: 'u-1',
  content: 'sample',
  occurredAt: '2026-05-25',
  cat: null,
  comps: [],
  cl: [],
  quant: null,
  mood: null,
  keywords: [],
  note: null,
  noteSummary: null,
  noteSummaryHash: null,
  noteSummaryAt: null,
  archivedAt: null,
  createdAt: '2026-05-25T00:00:00Z',
  updatedAt: '2026-05-25T00:00:00Z',
  ...overrides,
})

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  setMockResult({
    status: 'ok',
    summary: 'AI 요약 텍스트',
    cached: false,
    remainingPerNote: 4,
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('AISummarySection — tooShort 분기', () => {
  it('50자 미만 → 버튼 disabled + 안내 텍스트', () => {
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={49} />,
    )
    expect(screen.getByText(/노트 더 작성하기/)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/50자 이상/)).toBeInTheDocument()
  })

  it('정확히 50자 → 버튼 활성 ("지금 요약")', () => {
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={50} />,
    )
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    expect(btn).toHaveTextContent('지금 요약')
  })
})

describe('AISummarySection — 30초 cooldown', () => {
  it('호출 성공 → 버튼 disabled', async () => {
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled()
    })
    // 라벨도 카운트다운으로 전환되는지
    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toMatch(
        /\d+초 후 다시 시도/,
      )
    })
  })

  it('blocked 응답 → cooldown 시작 안 함 → 버튼 enabled 유지', async () => {
    setMockResult({
      status: 'blocked',
      summary: null,
      cached: false,
      reason: '한도 도달',
      remainingPerNote: 0,
    })
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    fireEvent.click(screen.getByRole('button'))
    // mutate 응답 처리 후에도 cooldown 안 걸려 버튼 enabled
    await waitFor(() => {
      expect(screen.getByText(/한도 도달/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('cooldown 중 두 번째 클릭 무시 (button disabled)', async () => {
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    // disabled 상태 유지 (두 번째 클릭 시도)
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
  })
})

describe('AISummarySection — stale 판정', () => {
  it('log.updatedAt > noteSummaryAt → stale 경고 + "다시 요약 (변경됨)"', () => {
    const staleLog = makeLog({
      noteSummary: 'old summary',
      noteSummaryAt: '2026-05-25T10:00:00Z',
      updatedAt: '2026-05-25T11:00:00Z', // 1시간 후 수정
    })
    renderWithClient(
      <AISummarySection log={staleLog} currentTextLength={100} />,
    )
    expect(screen.getByText(/노트가 변경됐어요/)).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('다시 요약 (변경됨)')
    expect(screen.getByText(/옛 요약/)).toBeInTheDocument()
  })

  it('updatedAt == noteSummaryAt → not stale, "다시 생성" 라벨', () => {
    const log = makeLog({
      noteSummary: 'summary',
      noteSummaryAt: '2026-05-25T10:00:00Z',
      updatedAt: '2026-05-25T10:00:00Z',
    })
    renderWithClient(
      <AISummarySection log={log} currentTextLength={100} />,
    )
    expect(screen.queryByText(/노트가 변경됐어요/)).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('다시 생성')
  })

  it('updatedAt > noteSummaryAt 이어도 방금 fresh 응답 직후엔 not stale', async () => {
    const log = makeLog({
      noteSummary: 'old',
      noteSummaryAt: '2026-05-25T10:00:00Z',
      updatedAt: '2026-05-25T11:00:00Z',
    })
    renderWithClient(
      <AISummarySection log={log} currentTextLength={100} />,
    )
    // 처음엔 stale 상태
    expect(screen.getByText(/노트가 변경됐어요/)).toBeInTheDocument()
    // 새 호출 (fresh 응답)
    setMockResult({
      status: 'ok',
      summary: 'fresh summary',
      cached: false,
      remainingPerNote: 3,
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    await waitFor(() => {
      // justFreshLocal → stale 사라짐
      expect(screen.queryByText(/노트가 변경됐어요/)).not.toBeInTheDocument()
    })
  })

  it('noteSummary 없으면 stale 판정 안 함', () => {
    const log = makeLog({
      noteSummary: null,
      noteSummaryAt: '2026-05-25T10:00:00Z',
      updatedAt: '2026-05-25T11:00:00Z',
    })
    renderWithClient(
      <AISummarySection log={log} currentTextLength={100} />,
    )
    expect(screen.queryByText(/노트가 변경됐어요/)).not.toBeInTheDocument()
  })
})

describe('AISummarySection — blocked 표시', () => {
  it('blocked + reason → 경고 텍스트 표시', async () => {
    setMockResult({
      status: 'blocked',
      summary: null,
      cached: false,
      reason: '오늘 한도 도달',
      remainingPerNote: 0,
    })
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    await waitFor(() => {
      expect(screen.getByText(/오늘 한도 도달/)).toBeInTheDocument()
    })
  })
})

describe('AISummarySection — quota chip', () => {
  it('remainingPerNote=0 → exhausted 클래스 + 5/5 표시', async () => {
    setMockResult({
      status: 'ok',
      summary: 's',
      cached: false,
      remainingPerNote: 0,
    })
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    await waitFor(() => {
      const chip = screen.getByText(/5\/5/)
      expect(chip).toBeInTheDocument()
      expect(chip.className).toContain('exhausted')
    })
  })

  it('remainingPerNote=undefined → quota chip 미표시', () => {
    renderWithClient(
      <AISummarySection log={makeLog()} currentTextLength={100} />,
    )
    expect(screen.queryByText(/오늘 노트당/)).not.toBeInTheDocument()
  })
})
