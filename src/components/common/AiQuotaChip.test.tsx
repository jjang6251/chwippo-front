/**
 * F6 PR 2 Phase 5.1 — AiQuotaChip 테스트.
 *
 * 시나리오:
 * 1. quota 미로드 (hook undefined) → 렌더 X (silent fail — 부모 버튼 정상 동작)
 * 2. 정상 (잔여 5/5) → "잔여 5/5회" 표시, variant normal
 * 3. enabled=false → Construction 아이콘 + "일시 중단" badge + disabled variant
 * 4. nextAvailableAt 미래 (cooldown) → Timer 아이콘 + "N초" + warn variant
 * 5. dayUsed >= dayLimit → "오늘 한도 소진" + danger variant
 * 6. dayLeft <= 20% → warn variant (잔여 부족 경고)
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiQuotaChip } from './AiQuotaChip'
import { useMyAiQuota } from '@/hooks/useMyAiQuotas'

vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiQuota: vi.fn(),
}))

const mocked = vi.mocked(useMyAiQuota)

describe('AiQuotaChip', () => {
  beforeEach(() => mocked.mockReset())
  afterEach(() => vi.useRealTimers())

  it('quota 미로드 시 렌더 X (silent fail)', () => {
    mocked.mockReturnValue(undefined)
    const { container } = render(<AiQuotaChip feature="note_summary" />)
    expect(container.firstChild).toBeNull()
  })

  it('5.6.2 — 무제한 (1000/10000) + 한가 → chip 숨김 (의식적 제한 없을 때)', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 0,
      dayLimit: 1000,
      monthUsed: 0,
      monthLimit: 10000,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    const { container } = render(<AiQuotaChip feature="note_summary" />)
    expect(container.firstChild).toBeNull()
  })

  it('5.6.2 — admin 좁은 한도 (dayLimit=5) + 한가 (dayUsed=0) → 아직 숨김', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 0,
      dayLimit: 5,
      monthUsed: 0,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    const { container } = render(<AiQuotaChip feature="note_summary" />)
    expect(container.firstChild).toBeNull()
  })

  it('5.6.2 — admin 좁은 한도 (dayLimit=5) + 20%+ 사용 → 표시', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 2,
      dayLimit: 5,
      monthUsed: 2,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    render(<AiQuotaChip feature="note_summary" />)
    expect(screen.getByText('잔여 3/5회')).toBeInTheDocument()
  })

  it('enabled=false → "일시 중단" badge (kill switch)', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: false,
      dayUsed: 0,
      dayLimit: 5,
      monthUsed: 0,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    render(<AiQuotaChip feature="note_summary" />)
    expect(screen.getByText('일시 중단')).toBeInTheDocument()
  })

  it('nextAvailableAt 미래 → "N초" 표시 (cooldown)', () => {
    const future = new Date(Date.now() + 25_000).toISOString()
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 1,
      dayLimit: 5,
      monthUsed: 1,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: future,
    })
    render(<AiQuotaChip feature="note_summary" />)
    const chip = screen.getByText(/\d+초/)
    expect(chip).toBeInTheDocument()
    expect(chip.textContent).toMatch(/초|분/)
  })

  it('dayUsed >= dayLimit → "오늘 한도 소진" (danger)', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 5,
      dayLimit: 5,
      monthUsed: 5,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    render(<AiQuotaChip feature="note_summary" />)
    expect(screen.getByText('오늘 한도 소진')).toBeInTheDocument()
  })

  it('cooldown 실시간 tick — 1초 경과 시 라벨 감소', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 1,
      dayLimit: 5,
      monthUsed: 1,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: new Date(now + 5000).toISOString(),
    })
    render(<AiQuotaChip feature="note_summary" />)
    expect(screen.getByText('5초')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('4초')).toBeInTheDocument()
  })

  it('60초 이상 cooldown → "분 초" 병기', () => {
    const future = new Date(Date.now() + 90_000).toISOString()
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 1,
      dayLimit: 5,
      monthUsed: 1,
      monthLimit: 100,
      cooldownSeconds: 120,
      nextAvailableAt: future,
    })
    render(<AiQuotaChip feature="note_summary" />)
    // 90초 → "1분 30초" (초 병기 — tick 체감)
    expect(screen.getByText(/1분 \d+초/)).toBeInTheDocument()
  })

  it('dayLeft ≤ 20% → warn variant (잔여 1/5)', () => {
    mocked.mockReturnValue({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 4,
      dayLimit: 5,
      monthUsed: 4,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    const { container } = render(<AiQuotaChip feature="note_summary" />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('잔여 1/5회')
    expect(span!.className).toContain('warning')
  })
})

