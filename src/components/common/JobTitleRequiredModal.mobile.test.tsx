/**
 * 직무 게이트 모달 — **모바일(sm 미만)** 갈래.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 모바일: 게이트가 열려도 직무 칸에 포커스가 안 걸린다 (2026-08-30 iPhone 실사고)
 *  2. 데스크탑(useIsMobile=false)은 그대로 포커스 — 회귀 방지 대조군
 *
 * 이 게이트는 AI 호출 직전에 **자동으로** 뜬다 — 사용자가 부른 적 없는 모달이 키보드까지
 * 끌고 올라오면 화면이 통째로 가려진다. `AddCardModal.mobile.test.tsx` 와 같은 결.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JobTitleRequiredModal } from './JobTitleRequiredModal'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { useAuthStore } from '@/stores/authStore'

let mobile = true
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mobile,
  useIsMobile: () => mobile,
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { id: 'app-1', companyName: '카카오' } }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

/** 게이트를 실제로 요청한 상태로 만든다 (기존 spec 과 같은 진입) */
function openGate() {
  useJobTitleGateStore.getState().request('app-1')
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <JobTitleRequiredModal />
    </QueryClientProvider>,
  )
}

const jobInput = () => screen.getByRole('combobox')

beforeEach(() => {
  mobile = true
  useJobTitleGateStore.setState({ applicationId: null, _resolve: null })
  useAuthStore.getState().clearAuth()
})
afterEach(cleanup)

describe('JobTitleRequiredModal — 모바일은 열자마자 키보드를 띄우지 않는다', () => {
  it('1) 🔴 모바일: 직무 칸에 포커스가 안 걸린다', () => {
    openGate()
    expect(jobInput()).not.toHaveFocus()
  })

  it('2) 데스크탑은 그대로 포커스 (회귀 대조군)', () => {
    mobile = false
    openGate()
    expect(jobInput()).toHaveFocus()
  })
})
