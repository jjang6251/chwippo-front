/**
 * 공부 노트 허브 → 스텝 페이지 **준비 노트 딥링크**의 착지점 (plan §5 「딥링크 앵커」).
 *
 * 🔴 **브라우저의 앵커 점프에 기댈 수 없다.** SPA 라 주소가 바뀌는 순간엔 카드가 아직
 * 로딩 중이고 그 자리엔 스켈레톤뿐이다 — 앵커가 없는 문서로 점프하면 아무 일도 안 난다.
 * 그래서 데이터가 온 뒤에 직접 스크롤하고, 그 동작을 여기서 못박는다.
 *
 * 시나리오:
 *   1  준비 노트 섹션이 `PREP_NOTES_ANCHOR` id 를 갖는다 (허브 링크의 목적지)
 *   2  `#prep-notes` 로 들어오면 그 섹션까지 스크롤한다
 *   3  해시가 없으면 스크롤하지 않는다 (평범한 진입을 방해하지 않는다)
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'
import { PREP_NOTES_ANCHOR } from '@/pages/StudyNotes/studyNotesModel'

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: APP, isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
  useUpdateCurrentStep: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: [] }),
  useCreateChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateChecklistItem: () => ({ mutate: vi.fn() }),
  useDeleteChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateStep: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => h.navigate }))
vi.mock('@/utils/nativeBridge', () => ({ postToNative: vi.fn() }))
// tiptap·시트 조회는 이 spec 의 관심사가 아니다 — 섹션의 자리만 본다
vi.mock('@/components/editor/SheetedNoteEditor', () => ({
  SheetedNoteEditor: () => <div data-testid="sheeted-note" />,
}))

import { StepPage } from './StepPage'

const STEP: ApplicationStep = {
  id: 's0',
  applicationId: 'app-1',
  orderIndex: 0,
  name: '1차 면접',
  scheduledDate: null,
  location: null,
  notes: null,
  pinnedContent: null,
}

const APP: Application = {
  id: 'app-1',
  userId: 'u',
  companyName: '삼성전자',
  jobTitle: null,
  jobCategory: null,
  status: 'IN_PROGRESS',
  jobUrl: null,
  memo: null,
  currentStepIndex: 0,
  needsDetail: false,
  isStarred: false,
  steps: [STEP],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
}

function renderStep(hash = '') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[`/board/app-1/steps/s0${hash}`]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/** jsdom 에는 `scrollIntoView` 가 아예 없다 — 환경을 채우고 호출만 관찰한다 */
const scrollSpy = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = scrollSpy
})

describe('StepPage — 준비 노트 앵커 (공부 노트 허브 딥링크)', () => {
  it('1 준비 노트 섹션이 허브가 가리키는 id 를 갖는다', () => {
    const { container } = renderStep()
    const section = container.querySelector(`#${PREP_NOTES_ANCHOR}`)
    expect(section).not.toBeNull()
    // 섹션 안에 실제로 준비 노트가 들어 있다 (id 만 떠 있는 빈 앵커가 아니다)
    expect(section!.querySelector('[data-testid="sheeted-note"]')).not.toBeNull()
    expect(screen.getByText('준비 노트')).toBeInTheDocument()
  })

  it('2 #prep-notes 로 들어오면 그 섹션까지 스크롤한다', () => {
    renderStep(`#${PREP_NOTES_ANCHOR}`)
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('3 해시가 없으면 스크롤하지 않는다', () => {
    renderStep()
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
