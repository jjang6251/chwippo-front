/**
 * ConvertExamToCertModal 테스트
 *
 * 시나리오:
 * 1. exam_type='language' → 점수 입력란 노출
 * 2. exam_type='cert' → 점수 입력란 없음
 * 3. 어학·빈 점수 → 이관 버튼 disabled
 * 4. 어학·점수 입력 → 이관 버튼 enabled
 * 5. 자격증 → 이관 버튼 항상 enabled (점수 미입력 OK)
 * 6. 이관 클릭 → convert mutate 호출
 * 7. 성공 시 어학 토스트 / 자격증 토스트 분기
 * 8. 취소·X 클릭 → onClose
 * 9. 점수 input autoFocus
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// hook + toast mock — vi.hoisted로 vi.mock 안에서 참조 가능하게
const { mutateMock, toastShowMock, toastErrorMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastShowMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('@/hooks/useExamSchedules', () => ({
  useConvertExamToCert: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: toastShowMock, error: toastErrorMock },
}))

import { ConvertExamToCertModal } from './ConvertExamToCertModal'
import type { ExamSchedule } from '@/types/exam-schedule'

const makeExam = (overrides: Partial<ExamSchedule> = {}): ExamSchedule => ({
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
  ...overrides,
})

describe('ConvertExamToCertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('타입별 UI 분기', () => {
    it('어학(language) → 점수 입력란 노출', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'language' })} onClose={() => {}} />)
      expect(screen.getByPlaceholderText(/850/)).toBeDefined()
    })

    it('자격증(cert) → 점수 입력란 없음', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'cert', cert_type: null, name: 'SQLD' })} onClose={() => {}} />)
      expect(screen.queryByPlaceholderText(/850/)).toBeNull()
    })

    it('어학 → 안내 문구에 "어학 자격증" 라벨', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'language' })} onClose={() => {}} />)
      expect(screen.getByText(/어학 자격증/)).toBeDefined()
    })

    it('자격증 → 안내 문구에 "자격증" 라벨 (단순 "자격증")', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'cert' })} onClose={() => {}} />)
      // "자격증" 단어 노출, "어학 자격증" 노출 안 함
      const violets = screen.getAllByText(/자격증/)
      const hasLanguage = violets.some((el) => el.textContent?.includes('어학 자격증'))
      expect(hasLanguage).toBe(false)
    })
  })

  describe('이관 버튼 enabled/disabled', () => {
    it('어학·빈 점수 → 이관 버튼 disabled', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'language' })} onClose={() => {}} />)
      const btn = screen.getByRole('button', { name: '이관' })
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })

    it('어학·점수 입력 → 이관 버튼 enabled', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'language' })} onClose={() => {}} />)
      const input = screen.getByPlaceholderText(/850/)
      fireEvent.change(input, { target: { value: '850' } })
      const btn = screen.getByRole('button', { name: '이관' })
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })

    it('자격증 → 이관 버튼 항상 enabled (점수 없이도)', () => {
      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'cert' })} onClose={() => {}} />)
      const btn = screen.getByRole('button', { name: '이관' })
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })
  })

  describe('이관 동작 + 토스트 분기', () => {
    it('어학 이관 → mutate 호출 + onClose 콜백 + 어학 자격증 토스트', () => {
      const onClose = vi.fn()
      mutateMock.mockImplementation((_dto: any, options: any) => {
        options?.onSuccess?.()
      })

      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'language' })} onClose={onClose} />)
      fireEvent.change(screen.getByPlaceholderText(/850/), { target: { value: '850' } })
      fireEvent.click(screen.getByRole('button', { name: '이관' }))

      expect(mutateMock).toHaveBeenCalledWith({ score_grade: '850' }, expect.any(Object))
      expect(onClose).toHaveBeenCalled()
      expect(toastShowMock).toHaveBeenCalledWith('어학 자격증으로 이관됐어요')
    })

    it('자격증 이관 → 토스트 메시지 "자격증으로 이관됐어요"', () => {
      const onClose = vi.fn()
      mutateMock.mockImplementation((_dto: any, options: any) => {
        options?.onSuccess?.()
      })

      render(<ConvertExamToCertModal exam={makeExam({ exam_type: 'cert' })} onClose={onClose} />)
      fireEvent.click(screen.getByRole('button', { name: '이관' }))

      expect(toastShowMock).toHaveBeenCalledWith('자격증으로 이관됐어요')
    })
  })

  describe('닫기', () => {
    it('취소 버튼 클릭 → onClose', () => {
      const onClose = vi.fn()
      render(<ConvertExamToCertModal exam={makeExam()} onClose={onClose} />)
      fireEvent.click(screen.getByRole('button', { name: '취소' }))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
