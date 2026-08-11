/**
 * 준비 노트 **폴백** — 시트가 0장인 스텝에서 첫 탭이 무엇을 보여주는가 (StepPage 몫).
 *
 * 원래 이 spec 은 "핵심 메모(pinnedContent) → 준비 노트 lazy 이관" 을 잠갔다. 다중 시트가
 * 들어오면서 **저장 주체가 바뀌었다**: StepPage 는 폴백 콘텐츠를 계산해 넘기기만 하고,
 * 승격(`POST … ifEmpty`)·저장은 `SheetedNoteEditor` 가 한다.
 *
 * 🔴 **그래서 이 화면은 `notes`·`pinnedContent` 를 더 이상 쓰지 않는다.** 원본을 남겨 두는
 * 게 다중 시트 설계의 최상위 불변식이라(복구 자리), 여기에 저장 경로가 되살아나면
 * 승격본과 원본이 각자 갈라진다. 그 회귀를 이 파일이 잡는다.
 *
 * 시나리오:
 *   pinned 있는 스텝 → 폴백 앞에 📌 문단
 *   pinned + 기존 notes → 📌 가 기존 내용 앞에 병합
 *   pinned 없음 → 병합 없이 notes 그대로
 *   둘 다 없음 → 빈(null) 폴백
 *   🔴 어떤 조작을 해도 `updateStep` 에 notes·pinnedContent 가 실리지 않는다
 *   핵심 메모 섹션(📌 라벨·textarea)은 여전히 없다
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'

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
// 시트 컨테이너를 폴백 노출 창구로 대체 (tiptap·시트 조회 미탑재)
vi.mock('@/components/editor/SheetedNoteEditor', () => ({
  SheetedNoteEditor: ({ fallbackContent }: { fallbackContent: string | null }) => (
    <div data-testid="note-init">{fallbackContent ?? 'NULL'}</div>
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

describe('StepPage — 준비 노트 폴백 (시트 0장일 때 첫 탭 내용)', () => {
  it('pinned 있는 스텝 로드 → 폴백 앞에 📌 문단', () => {
    h.app = makeApp({ pinnedContent: '예상 질문 대비' })
    renderStep()
    const doc = JSON.parse(screen.getByTestId('note-init').textContent!)
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

  it('pinned 없는 스텝 → 병합 없음 (폴백 = 기존 notes 그대로)', () => {
    const notes = '{"type":"doc","content":[{"type":"paragraph"}]}'
    h.app = makeApp({ notes })
    renderStep()
    expect(screen.getByTestId('note-init').textContent).toBe(notes)
  })

  it('노트도 pinned 도 없음 → 빈(null) 폴백', () => {
    h.app = makeApp()
    renderStep()
    expect(screen.getByTestId('note-init').textContent).toBe('NULL')
  })

  /**
   * 🔴 **원본은 이 화면에서 갱신되지 않는다.** 승격은 `notes` 를 **복사**하는 것이라
   * 원본이 남아 있어야 되돌릴 자리가 있는데, 여기에 저장 경로가 하나라도 되살아나면
   * 시트와 원본이 각자 갈라진 채 둘 다 "진짜" 가 된다.
   */
  it('🔴 다른 필드를 저장해도 updateStep 에 notes·pinnedContent 가 실리지 않는다', () => {
    h.app = makeApp({ pinnedContent: '핵심', notes: '{"type":"doc","content":[]}' })
    renderStep()

    // 장소 저장 — 이 화면에 남아 있는 updateStep 소비처
    fireEvent.click(screen.getByText('장소', { selector: 'span' }).closest('button')!)
    fireEvent.blur(screen.getByLabelText('면접 장소'))

    expect(h.updateStep).toHaveBeenCalled()
    for (const [vars] of h.updateStep.mock.calls) {
      expect(vars).not.toHaveProperty('notes')
      expect(vars).not.toHaveProperty('pinnedContent')
    }
  })

  it('마운트만으로는 updateStep 을 부르지 않는다 (서버 무변경)', () => {
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
