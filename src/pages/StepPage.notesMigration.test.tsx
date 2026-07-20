/**
 * card-detail-remodel — 핵심 메모(pinnedContent) → 준비 노트 lazy 이관 (StepPage 통합).
 *
 * 시나리오:
 *   pinned 있는 스텝 로드 → 노트 초기 콘텐츠 앞에 📌 문단
 *   저장 → updateStep 에 notes(병합본) + pinnedContent:null 한 요청
 *   pinned 없는 스텝 → 병합 없음 + 저장 시 pinnedContent 미동봉
 *   노트도 pinned 도 없음 → 빈(=null) 초기 콘텐츠
 *   저장 전(마운트만) → updateStep 미호출 (서버 무변경)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'

const SAVED_JSON = '{"type":"doc","content":[]}'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  updateStep: vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
  updateCurrentStep: vi.fn(),
  updateApplication: vi.fn(),
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: h.app, isLoading: false }),
  useUpdateApplication: () => ({ mutate: h.updateApplication }),
  useUpdateCurrentStep: () => ({ mutate: h.updateCurrentStep }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: [] }),
  useCreateChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateChecklistItem: () => ({ mutate: vi.fn() }),
  useDeleteChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateStep: () => ({ mutate: h.updateStep }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => h.navigate }))
vi.mock('@/utils/nativeBridge', () => ({ postToNative: vi.fn() }))
// StepNoteEditor 를 initialContent 노출 + 저장 트리거 버튼으로 대체 (tiptap 미탑재)
vi.mock('@/components/editor/StepNoteEditor', () => ({
  StepNoteEditor: ({ initialContent, onSave }: { initialContent: string | null; onSave: (j: string) => Promise<void> }) => (
    <div>
      <div data-testid="note-init">{initialContent ?? 'NULL'}</div>
      <button onClick={() => onSave(SAVED_JSON)}>저장노트</button>
    </div>
  ),
}))

import { StepPage } from './StepPage'

function step(orderIndex: number, name: string, over: Partial<ApplicationStep> = {}): ApplicationStep {
  return {
    id: `s${orderIndex}`, applicationId: 'app-1', orderIndex, name,
    scheduledDate: null, location: null, notes: null, pinnedContent: null, ...over,
  }
}

function makeApp(over: Partial<ApplicationStep> = {}): Application {
  return {
    id: 'app-1', userId: 'u', companyName: '카카오', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0, needsDetail: false,
    isStarred: false,
    steps: [step(0, '2차 면접', over)],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }
}

function renderStep() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/board/app-1/steps/s0']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.navigate.mockClear()
  h.updateStep.mockClear()
})

describe('StepPage — 핵심 메모 → 준비 노트 이관', () => {
  it('pinned 있는 스텝 로드 → 노트 초기 콘텐츠 앞에 📌 문단', () => {
    h.app = makeApp({ pinnedContent: '예상 질문 대비' })
    renderStep()
    const init = screen.getByTestId('note-init').textContent!
    const doc = JSON.parse(init)
    expect(doc.content[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '📌 예상 질문 대비' }] })
  })

  it('pinned + 기존 notes → 📌 문단이 기존 내용 앞에 병합', () => {
    h.app = makeApp({
      pinnedContent: '복장 자유',
      notes: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"기존"}]}]}',
    })
    renderStep()
    const doc = JSON.parse(screen.getByTestId('note-init').textContent!)
    expect(doc.content.map((n: { content?: { text: string }[] }) => n.content?.[0]?.text)).toEqual(['📌 복장 자유', '기존'])
  })

  it('저장 → updateStep 에 notes(병합본) + pinnedContent:null 한 요청', () => {
    h.app = makeApp({ pinnedContent: '핵심' })
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: '저장노트' }))
    expect(h.updateStep).toHaveBeenCalledTimes(1)
    expect(h.updateStep).toHaveBeenCalledWith(
      { stepId: 's0', notes: SAVED_JSON, pinnedContent: null },
      expect.anything(),
    )
  })

  it('pinned 없는 스텝 → 병합 없음 (초기 콘텐츠 = 기존 notes) + 저장 시 pinnedContent 미동봉', () => {
    const notes = '{"type":"doc","content":[{"type":"paragraph"}]}'
    h.app = makeApp({ notes })
    renderStep()
    expect(screen.getByTestId('note-init').textContent).toBe(notes)
    fireEvent.click(screen.getByRole('button', { name: '저장노트' }))
    expect(h.updateStep).toHaveBeenCalledWith(
      { stepId: 's0', notes: SAVED_JSON },
      expect.anything(),
    )
  })

  it('노트도 pinned 도 없음 → 빈(null) 초기 콘텐츠', () => {
    h.app = makeApp()
    renderStep()
    expect(screen.getByTestId('note-init').textContent).toBe('NULL')
  })

  it('저장 전(마운트만) → updateStep 미호출 (서버 무변경)', () => {
    h.app = makeApp({ pinnedContent: '핵심', notes: '{"type":"doc","content":[]}' })
    renderStep()
    expect(h.updateStep).not.toHaveBeenCalled()
  })

  it('핵심 메모 섹션(📌 라벨 · textarea)이 더 이상 렌더되지 않음', () => {
    h.app = makeApp({ pinnedContent: '핵심' })
    renderStep()
    expect(screen.queryByText(/핵심 메모/)).not.toBeInTheDocument()
    expect(screen.queryByText(/대시보드 표시/)).not.toBeInTheDocument()
    // 준비 노트는 존재
    expect(screen.getByText('준비 노트')).toBeInTheDocument()
  })
})
