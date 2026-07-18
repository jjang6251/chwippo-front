/**
 * U20 — AddCardModal 서류 마감일 과거 경고 시나리오 (지난 공고 기록 허용 → 저장 차단 아님):
 * 1. 과거 마감일 입력 → 경고 문구 노출
 * 2. 미래 마감일 입력 → 경고 없음
 *
 * 날짜는 컴포넌트와 동일 유틸(todayLocal/addDays, KST) 로 계산 → CI TZ 안전.
 * (데스크탑 Modal 경로 — jsdom matchMedia 미구현 → useIsMobile=false)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import { AddCardModal } from './AddCardModal'
import { addDays, todayLocal } from '@/utils/datetime'

// 회사명 자동완성 = 네트워크 의존 → 단순 stub 로 대체
vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="회사명" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}))

vi.mock('@/hooks/useApplications', () => ({
  useCreateApplication: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderModal() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={qc}>
      <AddCardModal open onClose={() => {}} />
    </QueryClientProvider>,
  )
  const dateInput = utils.container.querySelector('input[type="date"]') as HTMLInputElement
  return { ...utils, dateInput }
}

describe('AddCardModal — 과거 마감일 경고 (U20)', () => {
  it('1) 과거 마감일 → 경고 노출', () => {
    const { dateInput } = renderModal()
    fireEvent.change(dateInput, { target: { value: addDays(todayLocal(), -5) } })
    expect(screen.getByText(/지난 마감일이에요/)).toBeInTheDocument()
  })

  it('2) 미래 마감일 → 경고 없음', () => {
    const { dateInput } = renderModal()
    fireEvent.change(dateInput, { target: { value: addDays(todayLocal(), 5) } })
    expect(screen.queryByText(/지난 마감일이에요/)).toBeNull()
  })
})
