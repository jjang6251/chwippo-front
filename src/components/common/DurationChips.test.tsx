import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DurationChips } from './DurationChips'
import { SEMESTER_PRESETS, MILITARY_PRESETS } from '@/utils/durationPresets'

/**
 * 기간 보조 칩 — 시작일 + 프리셋 → 종료일.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. role=group + 접근성 이름
 *  2. 학력 프리셋 3종 라벨 (+1학기·+1년·+2년)
 *  3. 병역 프리셋 3종 라벨 (18·21·24개월)
 *  4. 클릭 → onPick(계산된 종료일)
 *  5. 🔴 말일 보정이 datetime 헬퍼를 그대로 탄다 (1/31 + 6개월 = 7/31, 8/31 + 6개월 = 2/28)
 *  6. 시작일 없음 → 칩 비활성 + 안내 문구 + 클릭해도 onPick 없음
 *  7. 시작일이 날짜 형식이 아님 → 같은 비활성 처리
 *  8. 모바일 44px 터치 타겟 + touch-manipulation
 *  9. type="button"
 * 10. 🔴 안내 문구는 aria-live="polite" — 시작일을 넣는 순간 칩이 살아나는 걸 알려야 한다
 * 11. `id` 를 주면 그 값이 묶음에 실린다 (종료일 칸의 `aria-describedby` 대상)
 *  ── 시작일 포함 기간 (복무)
 * 12. 🔴 inclusiveEnd → 2020-01-01 + 18개월은 2021-07-01 이 아니라 2021-06-30
 * 13. 🔴 말일 예외는 하루를 빼지 않는다 — 2020-01-31 + 1개월 → 2020-02-29 (윤년)
 * 14. inclusiveEnd 없는 칸(학력)은 종전 그대로다
 */
describe('DurationChips', () => {
  it('role=group + 접근성 이름', () => {
    render(<DurationChips start="2026-03-02" presets={SEMESTER_PRESETS} onPick={vi.fn()} label="재학 기간 자동 계산" />)
    expect(screen.getByRole('group', { name: '재학 기간 자동 계산' })).toBeInTheDocument()
  })

  it('학력 프리셋 3종', () => {
    render(<DurationChips start="2026-03-02" presets={SEMESTER_PRESETS} onPick={vi.fn()} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['+1학기', '+1년', '+2년'])
  })

  it('병역 프리셋 3종', () => {
    render(<DurationChips start="2026-03-02" presets={MILITARY_PRESETS} onPick={vi.fn()} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['18개월', '21개월', '24개월'])
  })

  it('클릭 → onPick(종료일)', () => {
    const onPick = vi.fn()
    render(<DurationChips start="2026-03-02" presets={MILITARY_PRESETS} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: '18개월' }))
    expect(onPick).toHaveBeenCalledWith('2027-09-02')
  })

  it('🔴 말일 보정 — 8/31 + 6개월은 3/2 가 아니라 2/28', () => {
    const onPick = vi.fn()
    render(<DurationChips start="2026-08-31" presets={SEMESTER_PRESETS} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: '+1학기' }))
    expect(onPick).toHaveBeenCalledWith('2027-02-28')
  })

  it('시작일이 없으면 비활성 + 안내 문구, 클릭해도 onPick 없음', () => {
    const onPick = vi.fn()
    render(<DurationChips start="" presets={SEMESTER_PRESETS} onPick={onPick} />)
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
    expect(screen.getByText(/시작일을 먼저 입력하면/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+1년' }))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('날짜 형식이 아니면 같은 비활성 처리 (렌더가 죽지 않는다)', () => {
    render(<DurationChips start="2026-03" presets={SEMESTER_PRESETS} onPick={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
  })

  it('모바일 44px 터치 타겟 · touch-manipulation · type=button', () => {
    render(<DurationChips start="2026-03-02" presets={SEMESTER_PRESETS} onPick={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('min-h-[44px]')
      expect(b.className).toContain('touch-manipulation')
      expect(b).toHaveAttribute('type', 'button')
    }
  })

  it('🔴 안내 문구는 aria-live="polite" — 시작일을 넣는 순간 칩이 살아난다', () => {
    render(<DurationChips start="" presets={SEMESTER_PRESETS} onPick={vi.fn()} />)
    expect(screen.getByText(/시작일을 먼저 입력하면/)).toHaveAttribute('aria-live', 'polite')
  })

  it('id 를 주면 묶음에 실린다 — 종료일 칸이 aria-describedby 로 가리킬 대상', () => {
    render(
      <>
        <DurationChips id="edu-chips" start="2026-03-02" presets={SEMESTER_PRESETS} onPick={vi.fn()} />
        <input aria-label="졸업/예정" aria-describedby="edu-chips" />
      </>,
    )
    const described = screen.getByLabelText('졸업/예정').getAttribute('aria-describedby')!
    expect(document.getElementById(described)).toBe(screen.getByRole('group'))
  })

  /**
   * 복무는 **입대일이 기간에 들어간다** — 전역일은 「해당일 −1」이다. 이 칸만 켠다:
   * 학력 재학 기간에 같은 −1일을 적용하면 졸업/예정이 하루씩 당겨진다.
   */
  describe('inclusiveEnd — 시작일이 포함되는 기간 (복무)', () => {
    it('🔴 2020-01-01 + 18개월 → 2021-07-01 이 아니라 2021-06-30', () => {
      const onPick = vi.fn()
      render(<DurationChips inclusiveEnd start="2020-01-01" presets={MILITARY_PRESETS} onPick={onPick} />)
      fireEvent.click(screen.getByRole('button', { name: '18개월' }))
      expect(onPick).toHaveBeenCalledWith('2021-06-30')
    })

    it('🔴 말일 예외는 하루를 빼지 않는다 — 2020-01-31 + 1개월 → 2020-02-29 (윤년)', () => {
      const onPick = vi.fn()
      render(
        <DurationChips inclusiveEnd start="2020-01-31" presets={[{ label: '1개월', months: 1 }]} onPick={onPick} />,
      )
      fireEvent.click(screen.getByRole('button', { name: '1개월' }))
      expect(onPick).toHaveBeenCalledWith('2020-02-29')
    })

    it('끄면(학력) 종전 그대로 — 2020-01-01 + 24개월 → 2022-01-01', () => {
      const onPick = vi.fn()
      render(<DurationChips start="2020-01-01" presets={SEMESTER_PRESETS} onPick={onPick} />)
      fireEvent.click(screen.getByRole('button', { name: '+2년' }))
      expect(onPick).toHaveBeenCalledWith('2022-01-01')
    })
  })
})
