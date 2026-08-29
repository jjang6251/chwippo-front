/**
 * StartApplicationModal — **모바일(sm 미만)** 갈래.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 모바일: 직무 칸에 포커스가 안 걸린다 (열자마자 키보드가 덮던 iPhone 실기 2026-08-30)
 *  2. 데스크탑(useIsMobile=false)은 그대로 포커스 — 회귀 방지 대조군
 *
 * `useIsMobile` 을 통째로 mock 한다 — jsdom 은 matchMedia 가 없어 실제 훅은 늘 false 를 돌려주고,
 * 그 상태가 바로 기존 spec 들이 「데스크탑 경로」인 이유다. (`AddCardModal.mobile.test.tsx` 와 같은 결)
 */
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StartApplicationModal } from './StartApplicationModal'

let mobile = true
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mobile,
  useIsMobile: () => mobile,
}))

vi.mock('@/hooks/useApplications', () => ({
  useUpdateApplication: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderModal() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <StartApplicationModal
        open
        onClose={() => {}}
        applicationId="app-1"
        companyName="카카오"
      />
    </QueryClientProvider>,
  )
}

/** `role="combobox"` 는 `JobTitleField` 의 입력 칸만 가진다 */
const jobInput = () => screen.getByRole('combobox')

beforeEach(() => {
  mobile = true
})
afterEach(cleanup)

describe('StartApplicationModal — 모바일은 열자마자 키보드를 띄우지 않는다', () => {
  it('1) 🔴 모바일: 직무 칸에 포커스가 안 걸린다', () => {
    renderModal()
    expect(jobInput()).not.toHaveFocus()
  })

  it('2) 데스크탑은 그대로 포커스 (회귀 대조군)', () => {
    mobile = false
    renderModal()
    expect(jobInput()).toHaveFocus()
  })
})
