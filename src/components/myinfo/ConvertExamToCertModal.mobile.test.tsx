/**
 * ConvertExamToCertModal — **모바일(sm 미만)** 갈래 + 오버레이 껍데기.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 모바일: 점수 칸에 포커스가 안 걸린다 (열자마자 키보드가 덮던 iPhone 실기 2026-08-30)
 *  2. 데스크탑(useIsMobile=false)은 그대로 포커스 — 회귀 방지 대조군
 *  3. 🔴 오버레이 컨테이너는 탭바(z-50) 위이고 하단 여백이 없다 (`Modal.test.tsx` 9 와 같은 단언)
 *     — 여백을 주면 시트와 탭바 사이에 검은 띠만 남는다
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let mobile = true
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mobile,
  useIsMobile: () => mobile,
}))

vi.mock('@/hooks/useExamSchedules', () => ({
  useConvertExamToCert: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))

import { ConvertExamToCertModal } from './ConvertExamToCertModal'
import type { ExamSchedule } from '@/types/exam-schedule'

const exam: ExamSchedule = {
  id: 'x1',
  user_id: 'u1',
  exam_type: 'language',
  cert_type: 'TOEIC',
  name: 'TOEIC',
  exam_date: '2026-05-01T09:00:00+09:00',
  location: null,
  memo: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

const renderModal = () => render(<ConvertExamToCertModal exam={exam} onClose={() => {}} />)
const scoreInput = () => screen.getByPlaceholderText(/850/)

beforeEach(() => {
  mobile = true
})
afterEach(cleanup)

describe('ConvertExamToCertModal — 모바일은 열자마자 키보드를 띄우지 않는다', () => {
  it('1) 🔴 모바일: 점수 칸에 포커스가 안 걸린다', () => {
    renderModal()
    expect(scoreInput()).not.toHaveFocus()
  })

  it('2) 데스크탑은 그대로 포커스 (회귀 대조군)', () => {
    mobile = false
    renderModal()
    expect(scoreInput()).toHaveFocus()
  })

  it('3) 🔴 오버레이 컨테이너 — 탭바보다 위, 하단 여백 없음', () => {
    renderModal()
    const overlay = screen.getByRole('dialog').parentElement!
    const cls = overlay.className.split(/\s+/)
    expect(cls).toContain('items-end')
    expect(cls).toContain('z-[60]')
    expect(cls.some((c) => c.startsWith('pb-'))).toBe(false)
  })
})
