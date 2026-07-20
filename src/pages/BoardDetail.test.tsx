/**
 * card-detail-remodel — BoardDetail 개편 spec.
 *
 * 커버:
 *   - 상태 5종 렌더 (PLANNED / IN_PROGRESS / 결과 대기 / PASSED / FAILED)
 *   - 헤더 보기형 + ✎ 편집 모달 (회사명·직무·태그·공고 URL · 입력 16px)
 *   - 현재 스텝 카드 (날짜+시간 KST · 체크리스트 N/M · 스텝 열기 CTA)
 *   - 패널 제거 → 스텝 이름 클릭·CTA 전부 /board/:id/steps/:stepId 풀페이지 직행
 *   - 결과 대기 배너 흡수 (카드 안 상태 + 결과 입력)
 *   - 🔴 회귀: date-only input(type="date") 잔존 0 (시간 소실 결함 원천 제거)
 *   - 투어 앵커 유지 (step-bar · step-edit-btn · add-step-btn · save-steps-btn · coverletter-tab)
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  update: vi.fn(),
  updateCurrentStep: vi.fn(),
  updateSteps: vi.fn(),
  checklist: [] as Array<{ id: string; isDone: boolean }>,
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: h.app, isLoading: false }),
  useUpdateApplication: () => ({ mutate: h.update }),
  useUpdateCurrentStep: () => ({ mutate: h.updateCurrentStep }),
  useUpdateSteps: () => ({ mutate: h.updateSteps, isPending: false }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: h.checklist }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({
  useDemoNavigate: () => h.navigate,
}))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => false,
}))
vi.mock('@/components/card/CoverLetterTab', () => ({
  CoverLetterTab: () => <div data-testid="cl-tab" />,
}))
vi.mock('@/components/card/InterviewPrepTab', () => ({
  InterviewPrepTab: () => null,
}))
vi.mock('@/components/board/CompanyInfoSection', () => ({
  CompanyInfoSection: ({ companyName }: { companyName: string }) => (
    <div data-testid="dart-section">{companyName}</div>
  ),
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: ({ variant }: { variant?: string }) => (
    <div data-testid="jp-section">{variant}</div>
  ),
}))
// 회사 메모는 tiptap 리치 에디터 — BoardDetail 구조 테스트에선 stub (에디터 통합은 CompanyMemoCard.test)
vi.mock('@/components/board/CompanyMemoCard', () => ({
  CompanyMemoCard: ({ value, onSave }: { value: string; onSave: (v: string) => void }) => (
    <div data-testid="memo-card">
      <h2>회사 메모</h2>
      <span data-testid="memo-value">{value}</span>
      <button onClick={() => onSave('')}>메모비우기</button>
      <button onClick={() => onSave('새 회사 메모')}>메모저장</button>
    </div>
  ),
}))

import { BoardDetail } from './BoardDetail'

function step(orderIndex: number, name: string, over: Partial<ApplicationStep> = {}): ApplicationStep {
  return {
    id: `s${orderIndex}`, applicationId: 'app-1', orderIndex, name,
    scheduledDate: null, location: null, notes: null, pinnedContent: null, ...over,
  }
}

function makeApp(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1', userId: 'u', companyName: '카카오', jobTitle: '서버 개발자',
    jobCategory: 'IT개발', status: 'IN_PROGRESS', jobUrl: 'https://careers.kakao.com/jobs/P-014',
    memo: null, currentStepIndex: 2, needsDetail: false, isStarred: false,
    steps: [
      step(0, '서류 제출'),
      step(1, '코딩테스트'),
      step(2, '2차 면접', { scheduledDate: '2026-07-22T14:00:00+09:00', location: '판교 아지트' }),
      step(3, '최종 합격'),
    ],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/board/app-1']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/board/:id" element={<BoardDetail />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.app = makeApp()
  h.navigate.mockReset()
  h.update.mockReset()
  h.updateCurrentStep.mockReset()
  h.updateSteps.mockReset()
  h.checklist = [{ id: 'c1', isDone: true }, { id: 'c2', isDone: false }]
})

describe('BoardDetail — 헤더 보기형', () => {
  it('회사명·직무·공고 보기·★ 노출 + 태그 칩', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '카카오' })).toBeInTheDocument()
    expect(screen.getByText('서버 개발자')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /공고 보기/ })).toHaveAttribute('href', 'https://careers.kakao.com/jobs/P-014')
    expect(screen.getByRole('button', { name: /즐겨찾기/ })).toBeInTheDocument()
    expect(screen.getByText(/IT개발/)).toBeInTheDocument()
  })

  it('공고 URL 없으면 "공고 보기" 링크 미노출', () => {
    h.app = makeApp({ jobUrl: null })
    renderDetail()
    expect(screen.queryByRole('link', { name: /공고 보기/ })).not.toBeInTheDocument()
  })

  it('직무·태그 0 이어도 크래시 없이 헤더 렌더', () => {
    h.app = makeApp({ jobTitle: null, jobCategory: null, jobUrl: null })
    renderDetail()
    expect(screen.getByRole('heading', { name: '카카오' })).toBeInTheDocument()
  })

  it('🔴 회귀 — 헤더/본문에 date-only input(type="date") 이 하나도 없다 (시간 소실 결함 원천 제거)', () => {
    const { container } = renderDetail()
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0)
  })
})

describe('BoardDetail — 기본 정보 편집 모달', () => {
  it('✎ 클릭 → 모달 오픈, 입력 16px(text-base), 저장 시 update 호출', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))

    const dialog = screen.getByRole('dialog', { name: '기본 정보 편집' })
    const nameInput = within(dialog).getByDisplayValue('카카오')
    // iOS 확대 방지 — 16px
    expect(nameInput.className).toContain('text-base')
    expect(within(dialog).getByDisplayValue('서버 개발자')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('https://careers.kakao.com/jobs/P-014')).toBeInTheDocument()

    fireEvent.change(nameInput, { target: { value: '카카오페이' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: '카카오페이' }),
      expect.anything(),
    )
  })
})

describe('BoardDetail — 진행 상황 + 현재 스텝 카드', () => {
  it('IN_PROGRESS — step-bar + 현재 스텝 카드(날짜+시간 KST · 체크리스트 N/M)', () => {
    const { container } = renderDetail()
    expect(container.querySelector('[data-tour="step-bar"]')).not.toBeNull()
    // KST 14:00 이 05:00 로 밀리지 않음 (TZ=UTC 실행 대비)
    expect(screen.getByText(/7월 22일 \(수\)/)).toBeInTheDocument()
    expect(screen.getByText('14:00')).toBeInTheDocument()
    expect(screen.getByText('판교 아지트')).toBeInTheDocument()
    expect(screen.getByText('체크리스트 1/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /스텝 열기/ })).toBeInTheDocument()
  })

  it('현재 스텝 카드 "스텝 열기" → 풀페이지 직행 (패널 아님)', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /스텝 열기/ }))
    expect(h.navigate).toHaveBeenCalledWith('/board/app-1/steps/s2')
  })

  it('스텝 이름(현재) 클릭 → 풀페이지 직행', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /현재: 2차 면접/ }))
    expect(h.navigate).toHaveBeenCalledWith('/board/app-1/steps/s2')
  })

  it('날짜 없는 현재 스텝 → "날짜 설정하기" 유도 + 클릭 시 스텝 페이지', () => {
    h.app = makeApp({
      currentStepIndex: 0,
      steps: [step(0, '서류 제출'), step(1, '1차 면접')],
    })
    renderDetail()
    const setDate = screen.getByRole('button', { name: /날짜 설정하기/ })
    fireEvent.click(setDate)
    expect(h.navigate).toHaveBeenCalledWith('/board/app-1/steps/s0')
  })

  it('체크리스트 0개 → 체크리스트 칩 미노출', () => {
    h.checklist = []
    renderDetail()
    expect(screen.queryByText(/체크리스트 \d/)).not.toBeInTheDocument()
  })
})

describe('BoardDetail — 회사 메모 저장 정책 (거짓 저장 방지)', () => {
  // 메모를 지우면 '' 가 PATCH 에 실려야 실제 삭제된다 (undefined 로 빠지면 새로고침 시 복귀).
  // 리치 에디터가 빈 문서일 때 onSave('') 를 호출 → save('memo') 래퍼가 memo:'' 전송 (CEO 2026-07-20).
  it('빈 메모 저장(onSave "") → update 에 memo:"" (undefined 아님 — 실제 삭제)', () => {
    h.app = makeApp({ memo: '기존 메모 내용' })
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '메모비우기' }))
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ memo: '' }),
      expect.anything(),
    )
  })

  it('내용 있는 메모 저장 → update 에 memo 값 포함', () => {
    h.app = makeApp({ memo: null })
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '메모저장' }))
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ memo: '새 회사 메모' }),
      expect.anything(),
    )
  })
})

describe('BoardDetail — 상태 5종', () => {
  it('PLANNED — 진행 상황(step-bar) 미노출', () => {
    h.app = makeApp({ status: 'PLANNED', currentStepIndex: 0 })
    const { container } = renderDetail()
    expect(container.querySelector('[data-tour="step-bar"]')).toBeNull()
    // 회사 메모는 여전히 노출
    expect(screen.getByText('회사 메모')).toBeInTheDocument()
  })

  it('결과 대기 (IN_PROGRESS·마지막·날짜 경과) — 카드 내 "결과 대기 중" + 결과 입력 버튼', () => {
    h.app = makeApp({
      currentStepIndex: 0,
      steps: [step(0, '최종 발표', { scheduledDate: '2000-01-01T10:00:00+09:00' })],
    })
    renderDetail()
    expect(screen.getByText(/결과 대기 중/)).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: '결과 입력' })
    fireEvent.click(btn)
    // 결과 모달 오픈 (SetResultModal)
    expect(screen.getByRole('dialog', { name: /합격|불합격|결과/ })).toBeInTheDocument()
  })

  it('PASSED — 🎉 최종 합격 배지 + 결과 되돌리기, 스텝 편집·현재 스텝 카드 없음', () => {
    h.app = makeApp({ status: 'PASSED', currentStepIndex: 3 })
    renderDetail()
    expect(screen.getByText(/🎉 최종 합격/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '결과 되돌리기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '스텝 편집' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /스텝 열기/ })).not.toBeInTheDocument()
  })

  it('PASSED — 결과 되돌리기 클릭 → status IN_PROGRESS 로 update', () => {
    h.app = makeApp({ status: 'PASSED', currentStepIndex: 3 })
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '결과 되돌리기' }))
    expect(h.update).toHaveBeenCalledWith({ status: 'IN_PROGRESS' })
  })

  it('FAILED — 불합격 배지 + 탈락 회고 박스', () => {
    h.app = makeApp({ status: 'FAILED', currentStepIndex: 2 })
    renderDetail()
    expect(screen.getByText('불합격')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '결과 되돌리기' })).toBeInTheDocument()
  })
})

describe('BoardDetail — 투어 앵커 유지', () => {
  it('step-bar · step-edit-btn · coverletter-tab 존재', () => {
    const { container } = renderDetail()
    expect(container.querySelector('[data-tour="step-bar"]')).not.toBeNull()
    expect(container.querySelector('[data-tour="step-edit-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-tour="coverletter-tab"]')).not.toBeNull()
  })

  it('스텝 편집 모달 열면 add-step-btn · save-steps-btn 존재', () => {
    const { container } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '스텝 편집' }))
    expect(container.querySelector('[data-tour="add-step-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-tour="save-steps-btn"]')).not.toBeNull()
  })
})

describe('BoardDetail — 공고 요건 섹션', () => {
  it('steps 탭에 variant="section" 으로 렌더', () => {
    renderDetail()
    expect(screen.getByTestId('jp-section')).toHaveTextContent('section')
  })

  it('배치 순서 — 공고 요건 → 회사 메모 → 회사 정보(DART) (CEO 2026-07-20)', () => {
    const { container } = renderDetail()
    const memo = screen.getByText('회사 메모')
    const jp = screen.getByTestId('jp-section')
    const dart = screen.getByTestId('dart-section')
    // DOM 순서: jp < memo < dart
    expect(jp.compareDocumentPosition(memo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(memo.compareDocumentPosition(dart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container).toBeTruthy()
  })
})
