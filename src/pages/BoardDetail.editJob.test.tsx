/**
 * 🔴 카드 상세 「기본 정보 편집」 — **직무를 고치면 계열이 따라온다**.
 *
 * 실기 결함(2026-08-28): 직무를 「승무원」 → 「백엔드」로 바꿨는데 카드 태그가
 * 「영업·판매·서비스」로 남았다. 원인은 이 폼이 **맨 input + `jobTitle` 만 PATCH** 였다는 것 —
 * 온보딩·카드 추가·지원 시작·게이트는 전부 `JobTitleField` 를 써서 계열이 따라오는데
 * 여기만 빠져 있었다. 게다가 `jobCategory` 는 구 21어휘 `TagSelector` 값을 보내고 있었다.
 *
 * 시나리오:
 *  1. 직무를 사전이 아는 말로 바꾸면 payload 에 **새 계열 라벨**이 실린다
 *  2. 🔴 사전이 못 잡으면 `jobCategory: null` — **`undefined` 로 빼면 옛 라벨이 남는다**
 *  3. 출처(`jobTitleSource`)도 함께 간다
 *  4. 🔴 구 직군 태그 선택기가 폼에서 사라졌다 (직무와 태그가 따로 놀 여지 제거)
 *  5. 옛 어휘 태그(`개발,백엔드`)를 **역매핑하지 않는다** — 판정은 직무 원문에서만
 *  6. 보기 모드의 옛 태그 칩은 그대로 보인다 (표시 계층 fallback · 마이그레이션 없음)
 *  7. 제안 줄 — 카드 직무가 내 희망 직무와 다르면 뜨고, 같으면 안 뜬다
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import type { Application, ApplicationStep, UpdateApplicationDto } from '@/types/application'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: h.app, isLoading: false }),
  useUpdateApplication: () => ({ mutate: h.update }),
  useUpdateCurrentStep: () => ({ mutate: vi.fn() }),
  useUpdateSteps: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: [] }),
  useUpdateStep: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => h.navigate }))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => false,
}))
vi.mock('@/components/card/CoverLetterTab', () => ({ CoverLetterTab: () => null }))
vi.mock('@/components/card/InterviewPrepTab', () => ({ InterviewPrepTab: () => null }))
vi.mock('@/components/board/CompanyInfoSection', () => ({ CompanyInfoSection: () => null }))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({ JobPostingBanner: () => null }))
vi.mock('@/components/board/CompanyMemoCard', () => ({ CompanyMemoCard: () => null }))

import { BoardDetail } from './BoardDetail'

function step(orderIndex: number, name: string): ApplicationStep {
  return {
    id: `s${orderIndex}`, applicationId: 'app-1', orderIndex, name,
    scheduledDate: null, location: null, notes: null, pinnedContent: null,
  }
}

function makeApp(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1', userId: 'u', companyName: '대한항공', jobTitle: '승무원',
    jobCategory: '영업·판매·서비스', status: 'IN_PROGRESS', jobUrl: null,
    memo: null, currentStepIndex: 0, needsDetail: false, isStarred: false,
    steps: [step(0, '서류 제출'), step(1, '1차 면접')],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

function renderDetail() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
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

/** 편집 모달을 열고 직무를 고친 뒤 저장 → 서버로 갈 payload */
function editJobAndSave(nextTitle: string): UpdateApplicationDto {
  fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))
  const dialog = screen.getByRole('dialog', { name: '기본 정보 편집' })
  fireEvent.change(within(dialog).getByLabelText('지원 직무'), {
    target: { value: nextTitle },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  return h.update.mock.calls[h.update.mock.calls.length - 1][0] as UpdateApplicationDto
}

/** 희망 직무를 갈아 끼운 로그인 사용자 */
function signIn(signupJobTitle: string | null) {
  useAuthStore.getState().setUser({
    id: 'u1', nickname: '테스터', email: null, role: 'user',
    onboardedAt: null, termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null,
    onboardedCoinAt: null, signupJobCategories: [], signupOtherText: null,
    signupSeriesId: null, signupJobTitle,
    sampleCardsDismissedAt: null, calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
  })
}

beforeEach(() => {
  h.app = makeApp()
  h.navigate.mockReset()
  h.update.mockReset()
  useAuthStore.getState().clearAuth()
})

describe('BoardDetail 편집 — 직무를 바꾸면 계열이 따라온다', () => {
  it('1) 「승무원」 → 「백엔드」 → jobCategory 가 새 계열로 갈린다', () => {
    renderDetail()

    const payload = editJobAndSave('백엔드')

    expect(payload.jobTitle).toBe('백엔드')
    // 🔴 여기가 실기 결함 지점 — 예전엔 「영업·판매·서비스」가 그대로 남았다
    expect(payload.jobCategory).toBe('IT·개발')
  })

  it('2) 🔴 사전이 못 잡는 직무 → jobCategory: null (옛 라벨을 지운다)', () => {
    renderDetail()

    const payload = editJobAndSave('龍龍龍')

    expect(payload.jobTitle).toBe('龍龍龍')
    /*
      `undefined` 면 PATCH 에서 빠져 옛 「영업·판매·서비스」가 살아남는다.
      직무가 바뀐 마당에 옛 계열이 남는 게 비는 것보다 틀리다.
    */
    expect(payload.jobCategory).toBeNull()
    expect('jobCategory' in payload).toBe(true)
  })

  it('3) 출처(jobTitleSource)도 함께 간다', () => {
    renderDetail()
    expect(editJobAndSave('백엔드').jobTitleSource).toBe('typed')
  })

  it('4) 🔴 구 직군 태그 선택기가 편집 폼에 없다', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))
    const dialog = screen.getByRole('dialog', { name: '기본 정보 편집' })

    // 계열은 직무에서 파생한다 — 따로 고르는 칸이 있으면 둘이 어긋난 채 저장된다
    expect(within(dialog).queryByText('직군 태그')).toBeNull()
    // 대신 판정 행이 있다 (같은 입력기를 쓴다는 증거)
    expect(
      within(dialog).getByRole('button', { name: '다르게 고르기' }),
    ).toBeInTheDocument()
  })

  it('5) 옛 어휘 태그를 역매핑하지 않는다 — 계열은 직무 원문에서만 판정한다', () => {
    // 구 21어휘 콤마 태그가 저장돼 있던 카드
    h.app = makeApp({ jobTitle: '백엔드 개발자', jobCategory: '개발,백엔드' })
    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))
    const dialog = screen.getByRole('dialog', { name: '기본 정보 편집' })

    // 「개발」·「백엔드」 칩이 폼 안에 복원되지 않는다
    expect(within(dialog).queryByRole('button', { name: '백엔드' })).toBeNull()
    // 직무에서 판정한 계열만 보인다
    expect(within(dialog).getByText(/IT·개발/)).toBeInTheDocument()
  })

  it('6) 보기 모드의 옛 태그 칩은 그대로 보인다 (표시 계층 fallback · 마이그레이션 없음)', () => {
    h.app = makeApp({ jobCategory: '개발,백엔드' })
    renderDetail()

    expect(screen.getByText(/백엔드/)).toBeInTheDocument()
  })
})

describe('BoardDetail 편집 — 제안 줄', () => {
  const promoteLink = () => screen.queryByRole('button', { name: /희망 직무/ })

  it('7) 🔴 편집 모드에서도 뜬다 — 규칙이 「희망 직무와 다르면」이니까', () => {
    signIn('승무원')
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))

    // 카드 직무(승무원) == 희망 직무(승무원) → 아직 없다
    expect(promoteLink()).toBeNull()

    const dialog = screen.getByRole('dialog', { name: '기본 정보 편집' })
    fireEvent.change(within(dialog).getByLabelText('지원 직무'), {
      target: { value: '백엔드' },
    })

    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘백엔드’로 바꾸기')
  })

  it('7-b) 희망 직무가 비어 있으면 「등록하기」로 뜬다', () => {
    signIn(null)
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: '기본 정보 편집' }))

    // 카드에 이미 적힌 「승무원」이 곧 제안 대상이다
    expect(promoteLink()).toHaveTextContent('‘승무원’을 내 희망 직무로 등록하기')
  })
})
