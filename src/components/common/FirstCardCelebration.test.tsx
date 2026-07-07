/**
 * A5 — 첫 카드 보상 연출 렌더 시나리오:
 * 1. store 비면 렌더 없음
 * 2. full (템플릿+마감일): 체크 3개 + D-day 뱃지, 유도 문구 없음
 * 3. 마감일 없음: 템플릿 체크 + 💡 유도, D-day·캘린더 체크 없음
 * 4. planned: 등록 체크 + 유도, 템플릿 체크 없음 (거짓 체크 금지)
 * 5. CTA → navigate(/board/:id) + dismiss
 * 6. 배경 클릭 → dismiss
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstCardCelebration } from './FirstCardCelebration'
import {
  useCelebrationStore,
  type FirstCardCelebrationData,
} from '@/stores/celebrationStore'
import dayjs from 'dayjs'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

const show = (over: Partial<FirstCardCelebrationData> = {}) =>
  useCelebrationStore.getState().showFirstCard({
    appId: 'app-1',
    companyName: '카카오',
    hadTemplate: true,
    deadline: dayjs().add(14, 'day').format('YYYY-MM-DD'),
    planned: false,
    ...over,
  })

describe('FirstCardCelebration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCelebrationStore.getState().dismissFirstCard()
  })

  it('1) store 비면 렌더 없음', () => {
    const { container } = render(<FirstCardCelebration />)
    expect(container.firstChild).toBeNull()
  })

  it('2) full — 체크 3개 + D-day 뱃지, 유도 문구 없음', () => {
    show()
    render(<FirstCardCelebration />)
    expect(screen.getByText('첫 카드 완성')).toBeInTheDocument()
    expect(screen.getByText('카카오')).toBeInTheDocument()
    expect(screen.getByText('전형 단계 템플릿 적용')).toBeInTheDocument()
    expect(screen.getByText('마감 D-day 계산 완료')).toBeInTheDocument()
    expect(screen.getByText('D-14')).toBeInTheDocument()
    expect(screen.getByText('캘린더에 자동 등록')).toBeInTheDocument()
    expect(screen.queryByText(/마감일을 넣으면/)).toBeNull()
  })

  it('3) 마감일 없음 — 유도 문구, D-day·캘린더 체크 없음', () => {
    show({ deadline: null })
    render(<FirstCardCelebration />)
    expect(screen.getByText('전형 단계 템플릿 적용')).toBeInTheDocument()
    expect(screen.getByText(/마감일을 넣으면 D-day·캘린더가 자동/)).toBeInTheDocument()
    expect(screen.queryByText('마감 D-day 계산 완료')).toBeNull()
    expect(screen.queryByText('캘린더에 자동 등록')).toBeNull()
  })

  it('4) planned — 등록 체크 + 유도, 템플릿 체크 없음', () => {
    show({ planned: true, hadTemplate: false, deadline: null })
    render(<FirstCardCelebration />)
    expect(screen.getByText('지원 예정 보드에 등록 완료')).toBeInTheDocument()
    expect(screen.getByText(/지원을 시작하면 전형 단계·D-day·캘린더가 자동/)).toBeInTheDocument()
    expect(screen.queryByText('전형 단계 템플릿 적용')).toBeNull()
  })

  it('5) CTA → navigate + dismiss', () => {
    show()
    render(<FirstCardCelebration />)
    fireEvent.click(screen.getByRole('button', { name: '카드 보러가기 →' }))
    expect(navigateMock).toHaveBeenCalledWith('/board/app-1')
    expect(useCelebrationStore.getState().firstCard).toBeNull()
  })

  it('6) 배경 클릭 → dismiss', () => {
    show()
    render(<FirstCardCelebration />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(useCelebrationStore.getState().firstCard).toBeNull()
  })
})
