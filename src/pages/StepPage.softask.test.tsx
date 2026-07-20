/**
 * card-detail-remodel — StepPage 날짜 저장 = soft-ask 트리거 이전 + 시간 보존 회귀.
 *
 * 헤더의 date-only 입력 삭제로 soft-ask(`deadline-saved`) 발신 지점이 스텝 페이지로 이동.
 * 정책(현행 유지):
 *   ① 날짜 저장(값 있음) → postToNative('deadline-saved') 발신
 *   ② 날짜 삭제(빈 값) → 미발신
 *   ③ WebView 밖(웹) → no-op  (postToNative 자체 계약 · nativeBridge.test.ts 커버)
 *   ④ 데모(비로그인) → 값이 있어도 미발신 (native 푸시 soft-ask 는 로그인 사용자 전용)
 *
 * 🔴 시간 보존: 유일한 날짜 편집 경로(StepPage datetime-local)에서 날짜만 바꿔도
 *   시간(14:00)이 유지됨을 단언 (구 헤더 date-only 가 T00:00 로 덮어쓰던 결함 제거).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import type { Application, ApplicationStep } from '@/types/application'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  // updateStep mock: onSuccess 를 즉시 호출해 soft-ask 분기를 재현
  updateStep: vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
  postToNative: vi.fn(),
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
vi.mock('@/utils/nativeBridge', () => ({ postToNative: h.postToNative }))
vi.mock('@/components/editor/StepNoteEditor', () => ({
  StepNoteEditor: () => <div data-testid="note-editor" />,
}))

import { StepPage } from './StepPage'

function step(orderIndex: number, name: string, over: Partial<ApplicationStep> = {}): ApplicationStep {
  return {
    id: `s${orderIndex}`, applicationId: 'app-1', orderIndex, name,
    scheduledDate: null, location: null, notes: null, pinnedContent: null, ...over,
  }
}

function makeApp(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1', userId: 'u', companyName: '카카오', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0, needsDetail: false,
    isStarred: false,
    steps: [step(0, '2차 면접', { scheduledDate: '2026-07-22T14:00:00+09:00' })],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

function renderStep(demo = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <DemoModeContextProvider value={demo}>
      <MemoryRouter initialEntries={['/board/app-1/steps/s0']}>
        <QueryClientProvider client={qc}>
          <Routes>
            <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    </DemoModeContextProvider>,
  )
}

beforeEach(() => {
  h.app = makeApp()
  h.navigate.mockClear()
  h.updateStep.mockClear()
  h.postToNative.mockClear()
})

/** 날짜 행을 편집 모드로 전환하고 datetime-local input 을 반환 */
function openDateInput(): HTMLInputElement {
  // 표시된 날짜 라벨(버튼) 클릭 → editingField='date'
  fireEvent.click(screen.getByText(/날짜/i, { selector: 'span' }).closest('button')!)
  return screen.getByLabelText('일정 날짜 및 시간') as HTMLInputElement
}

describe('StepPage — soft-ask 트리거 + 시간 보존', () => {
  it('① 날짜 저장(값 있음) → deadline-saved 발신 + 시간 14:00 보존', () => {
    renderStep()
    const input = openDateInput()

    // 날짜만 07-23 으로 변경, 시간 14:00 유지
    fireEvent.change(input, { target: { value: '2026-07-23T14:00' } })

    // 저장 payload — 시간이 T14:00 로 보존 (T00:00 덮어쓰기 없음)
    expect(h.updateStep).toHaveBeenCalledWith(
      { stepId: 's0', scheduledDate: '2026-07-23T14:00:00+09:00' },
      expect.anything(),
    )
    // soft-ask 발신
    expect(h.postToNative).toHaveBeenCalledWith({ type: 'deadline-saved' })
  })

  it('② 날짜 삭제(빈 값) → scheduledDate null 저장 + soft-ask 미발신', () => {
    renderStep()
    const input = openDateInput()

    fireEvent.change(input, { target: { value: '' } })

    expect(h.updateStep).toHaveBeenCalledWith(
      { stepId: 's0', scheduledDate: null },
      expect.anything(),
    )
    expect(h.postToNative).not.toHaveBeenCalled()
  })

  it('④ 데모 모드 — 날짜 저장(값 있음)해도 soft-ask 미발신', () => {
    renderStep(true)
    const input = openDateInput()

    fireEvent.change(input, { target: { value: '2026-07-23T14:00' } })

    // 저장 자체는 동일하게 이뤄지되(인메모리 반영), native 발신만 억제
    expect(h.updateStep).toHaveBeenCalledWith(
      { stepId: 's0', scheduledDate: '2026-07-23T14:00:00+09:00' },
      expect.anything(),
    )
    expect(h.postToNative).not.toHaveBeenCalled()
  })
})
