/**
 * A11 — BoardListRow 시나리오.
 *   1. 회사명·직군·스텝 칩·D-day 렌더
 *   2. 직군은 sm+ 에서만 (hidden sm:inline)
 *   3. 행 클릭 → /board/:id 내비게이션
 *   4. ★ 클릭 → 내비게이션 X (전파 차단) + 즐겨찾기 토글 호출
 *   5. isSample → 샘플 뱃지 렌더 / 아니면 미렌더
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'
import { BoardListRow } from './BoardListRow'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), updateApp: vi.fn() }))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => mocks.navigate }))
vi.mock('@/hooks/useApplications', () => ({ useUpdateApplication: () => ({ mutate: mocks.updateApp }) }))

function step(orderIndex: number, date: string | null): ApplicationStep {
  return { id: `s${orderIndex}`, applicationId: 'a', orderIndex, name: '1차 면접', scheduledDate: date, location: null, notes: null, pinnedContent: null }
}

function makeApp(over: Partial<Application>): Application {
  return {
    id: 'app-1',
    userId: 'u',
    companyName: '카카오',
    jobTitle: '백엔드 개발',
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [step(0, '2099-12-31')],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  mocks.navigate.mockClear()
  mocks.updateApp.mockClear()
})

describe('BoardListRow', () => {
  it('1) 회사명·직군·스텝 칩·D-day 렌더', () => {
    render(<BoardListRow application={makeApp({})} />)
    expect(screen.getByText('카카오')).toBeInTheDocument()
    expect(screen.getByText('백엔드 개발')).toBeInTheDocument()
    expect(screen.getByText('1차 면접')).toBeInTheDocument()
    // 미래 마감 → D-day 배지 (mono)
    expect(screen.getByText(/^D-/)).toBeInTheDocument()
  })

  it('2) 직군은 hidden sm:inline (모바일 숨김)', () => {
    render(<BoardListRow application={makeApp({})} />)
    expect(screen.getByText('백엔드 개발').className).toContain('hidden')
  })

  it('3) 행 클릭 → /board/:id 내비게이션', () => {
    render(<BoardListRow application={makeApp({ id: 'app-9' })} />)
    fireEvent.click(screen.getByText('카카오'))
    expect(mocks.navigate).toHaveBeenCalledWith('/board/app-9')
  })

  it('4) ★ 클릭 → 내비게이션 X, 즐겨찾기 토글 호출', () => {
    render(<BoardListRow application={makeApp({ isStarred: false })} />)
    fireEvent.click(screen.getByRole('button', { name: '즐겨찾기 추가' }))
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.updateApp).toHaveBeenCalledWith({ isStarred: true })
  })

  it('5) isSample=true → 샘플 뱃지 / false → 미렌더', () => {
    const { rerender } = render(<BoardListRow application={makeApp({ isSample: true })} />)
    expect(screen.getByText(/샘플/)).toBeInTheDocument()
    rerender(<BoardListRow application={makeApp({ isSample: false })} />)
    expect(screen.queryByText(/샘플/)).not.toBeInTheDocument()
  })

  it('Enter 키 → 내비게이션 (role=button 접근성)', () => {
    render(<BoardListRow application={makeApp({ id: 'app-e' })} />)
    const row = screen.getByText('카카오').closest('[role="button"]') as HTMLElement
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(mocks.navigate).toHaveBeenCalledWith('/board/app-e')
  })
})
