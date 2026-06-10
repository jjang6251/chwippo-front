/**
 * PR_B2 Phase 4 — SlaCountdown spec (CTO 시각).
 *
 * 사용자 시각 못 잡는 영역 — overdue 시각 표시 / 시간 단위 변환 정확성 / null 케이스.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SlaCountdown } from './SlaCountdown'

describe('SlaCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('deadlineAt=null → "처리 기한 없음" 표시', () => {
    render(<SlaCountdown deadlineAt={null} />)
    expect(screen.getByText('처리 기한 없음')).toBeInTheDocument()
  })

  it('미래 deadline (3시간 후) → "3시간 0분" + tertiary 색', () => {
    const deadline = new Date('2026-06-09T03:00:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    expect(screen.getByText(/3시간/)).toBeInTheDocument()
  })

  it('과거 deadline (2시간 초과) → "초과" + danger 색', () => {
    const deadline = new Date('2026-06-08T22:00:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    const el = screen.getByText(/초과/)
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('danger')
  })

  it('1시간 미만 남음 → warning 색', () => {
    const deadline = new Date('2026-06-09T00:30:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    const el = screen.getByText(/시간/)
    expect(el.className).toContain('warning')
  })

  it('1일 이상 남음 → "N일 N시간" 형식', () => {
    const deadline = new Date('2026-06-12T12:00:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    expect(screen.getByText(/일/)).toBeInTheDocument()
  })

  it('tooltip 에 정확 시각 표시', () => {
    const deadline = new Date('2026-06-09T03:00:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    const el = screen.getByText(/시간/)
    expect(el.getAttribute('title')).toContain('처리 기한 남음')
  })

  it('overdue tooltip 에 "처리 기한 초과" 표시', () => {
    const deadline = new Date('2026-06-08T22:00:00Z').toISOString()
    render(<SlaCountdown deadlineAt={deadline} />)
    const el = screen.getByText(/초과/)
    expect(el.getAttribute('title')).toContain('처리 기한 초과')
  })
})
