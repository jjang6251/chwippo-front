/**
 * AddExamScheduleModal 테스트
 *
 * 시나리오:
 * 1. open=false → 렌더 안 됨
 * 2. open=true → 다이얼로그 노출, 디폴트 어학 모드
 * 3. 어학 → cert_type 드롭다운 (TOEIC/OPIC/...), 시험명 자유입력 없음
 * 4. 자격증 → 자유 입력 폼, 드롭다운 없음
 * 5. 어학 디폴트 → 추가 버튼 enabled (cert_type=TOEIC 자동 채움)
 * 6. 자격증 + 시험명 빈 → 추가 버튼 disabled
 * 7. 자격증 + 시험명 입력 → 추가 버튼 enabled
 * 8. 정상 추가 → createMutate({ exam_type, cert_type, name, exam_date, ... })
 * 9. initial=ExamSchedule → 수정 모드, prefill
 * 10. 취소·X → onClose
 * 11. defaultDate prop → 날짜 input 초기값
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { createMutate, updateMutate } = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
}))

vi.mock('@/hooks/useExamSchedules', () => ({
  useCreateExamSchedule: vi.fn(() => ({ mutate: createMutate, isPending: false })),
  useUpdateExamSchedule: vi.fn(() => ({ mutate: updateMutate, isPending: false })),
}))

import { AddExamScheduleModal } from './AddExamScheduleModal'
import type { ExamSchedule } from '@/types/exam-schedule'

describe('AddExamScheduleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('open 상태', () => {
    it('open=false → 렌더 안 됨 (null 반환)', () => {
      const { container } = render(<AddExamScheduleModal open={false} onClose={() => {}} />)
      expect(container.textContent).toBe('')
    })

    it('open=true → 다이얼로그 노출', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      expect(screen.getByRole('dialog')).toBeDefined()
    })
  })

  describe('어학·자격증 토글', () => {
    it('디폴트 어학 → 시험명 select(TOEIC 등) 노출, 자유 입력 없음', () => {
      const { container } = render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      const select = container.querySelector('select')
      expect(select).toBeDefined()
      const options = Array.from(select!.options).map((o) => o.value)
      expect(options).toContain('TOEIC')
      expect(options).toContain('OPIC')
      // 자유 입력 placeholder 없음
      expect(screen.queryByPlaceholderText('예: 정보처리기사 필기')).toBeNull()
    })

    it('자격증 토글 → 자유 입력 폼 노출, select 없음', () => {
      const { container } = render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: '자격증' }))

      expect(screen.getByPlaceholderText('예: 정보처리기사 필기')).toBeDefined()
      // 자격증 모드에선 cert_type select 없음
      const select = container.querySelector('select')
      expect(select).toBeNull()
    })
  })

  describe('추가 버튼 enabled/disabled', () => {
    it('어학 디폴트(cert_type=TOEIC 자동) + 디폴트 날짜 → 추가 버튼 enabled', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      const btn = screen.getByRole('button', { name: '추가' })
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })

    it('자격증 + 시험명 비어있음 → 추가 버튼 disabled', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: '자격증' }))
      const btn = screen.getByRole('button', { name: '추가' })
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })

    it('자격증 + 시험명 입력 → 추가 버튼 enabled', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: '자격증' }))
      fireEvent.change(screen.getByPlaceholderText('예: 정보처리기사 필기'), { target: { value: '정보처리기사 필기' } })
      const btn = screen.getByRole('button', { name: '추가' })
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })
  })

  describe('추가 동작', () => {
    it('어학 추가 → createMutate({ exam_type:"language", cert_type:"TOEIC", name:"TOEIC", ... })', () => {
      createMutate.mockImplementation((_payload: any, options: any) => options?.onSuccess?.())
      const onClose = vi.fn()
      render(<AddExamScheduleModal open={true} onClose={onClose} defaultDate="2026-06-15" />)
      fireEvent.click(screen.getByRole('button', { name: '추가' }))

      expect(createMutate).toHaveBeenCalled()
      const payload = createMutate.mock.calls[0][0]
      expect(payload.exam_type).toBe('language')
      expect(payload.cert_type).toBe('TOEIC')
      expect(payload.name).toBe('TOEIC')
      expect(payload.exam_date).toContain('2026-06-15')
      expect(onClose).toHaveBeenCalled()
    })

    it('자격증 추가 → cert_type 없이 name만', () => {
      createMutate.mockImplementation((_payload: any, options: any) => options?.onSuccess?.())
      render(<AddExamScheduleModal open={true} onClose={() => {}} defaultDate="2026-06-15" />)
      fireEvent.click(screen.getByRole('button', { name: '자격증' }))
      fireEvent.change(screen.getByPlaceholderText('예: 정보처리기사 필기'), { target: { value: 'SQLD' } })
      fireEvent.click(screen.getByRole('button', { name: '추가' }))

      const payload = createMutate.mock.calls[0][0]
      expect(payload.exam_type).toBe('cert')
      expect(payload.cert_type).toBeUndefined()
      expect(payload.name).toBe('SQLD')
    })
  })

  describe('수정 모드 (initial 제공)', () => {
    const existing: ExamSchedule = {
      id: 'x1',
      user_id: 'u1',
      exam_type: 'language',
      cert_type: 'OPIC',
      name: 'OPIC',
      exam_date: '2026-07-01T10:00:00+09:00',
      location: '서울',
      memo: '메모',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    }

    it('타이틀이 "시험 일정 수정"', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} initial={existing} />)
      expect(screen.getByText('시험 일정 수정')).toBeDefined()
    })

    it('수정 버튼 라벨 "수정"', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} initial={existing} />)
      expect(screen.getByRole('button', { name: '수정' })).toBeDefined()
    })

    it('initial 값으로 prefill (location/memo)', () => {
      render(<AddExamScheduleModal open={true} onClose={() => {}} initial={existing} />)
      const locationInput = screen.getByPlaceholderText(/홍익대학교/) as HTMLInputElement
      expect(locationInput.value).toBe('서울')
    })

    it('저장 클릭 → updateMutate 호출', () => {
      updateMutate.mockImplementation((_payload: any, options: any) => options?.onSuccess?.())
      render(<AddExamScheduleModal open={true} onClose={() => {}} initial={existing} />)
      fireEvent.click(screen.getByRole('button', { name: '수정' }))
      expect(updateMutate).toHaveBeenCalled()
      expect(createMutate).not.toHaveBeenCalled()
    })
  })

  describe('닫기', () => {
    it('취소 버튼 클릭 → onClose', () => {
      const onClose = vi.fn()
      render(<AddExamScheduleModal open={true} onClose={onClose} />)
      fireEvent.click(screen.getByRole('button', { name: '취소' }))
      expect(onClose).toHaveBeenCalled()
    })

    it('닫기(X) 버튼 클릭 → onClose', () => {
      const onClose = vi.fn()
      render(<AddExamScheduleModal open={true} onClose={onClose} />)
      fireEvent.click(screen.getByRole('button', { name: '닫기' }))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
