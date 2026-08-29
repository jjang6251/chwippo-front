/**
 * 카드 추가 모달 — **모바일(sm 미만)** 갈래.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 직접 입력: 회사 칸에 autoFocus 가 안 걸린다 (열자마자 키보드가 덮던 iPhone 실기 2026-08-30)
 *  2. 🔴 공고 모드: 붙여넣기 칸에 autoFocus 가 안 걸린다 (공지 「지금 해보기」 딥링크 = initialMode)
 *  3. 지원 예정도 같다 (회사 칸 autoFocus 없음)
 *  4. 데스크탑(useIsMobile=false)은 그대로 autoFocus — 회귀 방지 대조군
 *
 * `useIsMobile` 을 통째로 mock 한다 — jsdom 은 matchMedia 가 없어 실제 훅은 항상 false 를 돌려주고,
 * 그 상태가 바로 기존 테스트들이 「데스크탑 경로」인 이유다.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AddCardModal } from './AddCardModal'
import { useAuthStore } from '@/stores/authStore'
import { usePendingCardStore } from '@/stores/pendingCardStore'
import type { AddCardMode } from '@/utils/postingNew'

let mobile = true
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mobile,
  useIsMobile: () => mobile,
}))

// 자동완성은 네트워크 의존 → stub. **autoFocus prop 을 그대로 DOM 에 드러낸다** (그게 이 spec 의 관심사)
vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) => (
    <input
      aria-label="회사명"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      autoFocus={props.autoFocus}
      data-autofocus={String(!!props.autoFocus)}
    />
  ),
}))

vi.mock('@/hooks/useApplications', () => ({
  useCreateApplication: () => ({ mutate: vi.fn(), isPending: false }),
  useApplications: () => ({ data: [] }),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({ useRequireAiConsent: () => async () => true }))
vi.mock('@/contexts/demoMode', () => ({
  useDemoMode: () => false,
  DemoModeContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/stores/pendingCardStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/pendingCardStore')>()),
  runPostingParse: vi.fn(),
}))

function renderModal(defaultStatus: 'PLANNED' | 'IN_PROGRESS' = 'IN_PROGRESS', initialMode?: AddCardMode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AddCardModal open onClose={vi.fn()} defaultStatus={defaultStatus} initialMode={initialMode} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mobile = true
  localStorage.clear()
  usePendingCardStore.getState().reset()
  useAuthStore.getState().setUser({
    id: 'u1',
    nickname: '테스터',
    email: null,
    role: 'user',
    onboardedAt: null,
    termsAgreedAt: null,
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: null,
    signupOtherText: null,
    signupSeriesId: null,
    signupJobTitle: null,
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
  })
})
afterEach(cleanup)

describe('AddCardModal — 모바일은 열자마자 키보드를 띄우지 않는다', () => {
  it('1) 🔴 직접 입력: 회사 칸 autoFocus 없음', () => {
    renderModal('IN_PROGRESS', 'manual')
    const input = screen.getByLabelText('회사명')
    expect(input).toHaveAttribute('data-autofocus', 'false')
    expect(input).not.toHaveFocus()
  })

  it('2) 🔴 공고 모드(딥링크 initialMode): 붙여넣기 칸 autoFocus 없음', () => {
    renderModal('IN_PROGRESS', 'posting')
    const ta = screen.getByLabelText('채용 공고 원문')
    expect(ta).not.toHaveFocus()
  })

  it('3) 지원 예정도 같다', () => {
    renderModal('PLANNED')
    expect(screen.getByLabelText('회사명')).toHaveAttribute('data-autofocus', 'false')
  })

  it('4) 데스크탑은 그대로 autoFocus (회귀 대조군)', () => {
    mobile = false
    renderModal('IN_PROGRESS', 'manual')
    expect(screen.getByLabelText('회사명')).toHaveAttribute('data-autofocus', 'true')
  })
})
