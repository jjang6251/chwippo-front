import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedToggle } from './SegmentedToggle'

/**
 * 세그먼트 토글 — 창고 enum 필드(병역 9종·보훈·장애·본교/분교)의 공용 입력.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. role=group + aria-label 로 묶인다
 *  2. 옵션 수만큼 버튼, 라벨 순서 보존
 *  3. 🔴 선택된 것만 aria-pressed=true (스크린리더가 상태를 읽는 유일한 통로)
 *  3-a. 🔴 value=null → 전부 aria-pressed=false (미선택을 미선택으로 그린다)
 *  4. 클릭 → onChange(value) 1회
 *  5. 이미 선택된 것 클릭 → 그래도 onChange (호출 측이 멱등 저장을 판단)
 *  6. 키보드 — Tab 으로 닿고 Enter/Space 로 눌린다 (button 이므로 click 이 발생)
 *  7. 경계: 옵션 2개 · 9개 전부 렌더
 *  8. disabled — 버튼 전부 비활성 + 클릭해도 onChange 없음
 *  9. 모바일 터치 타겟 44px 클래스
 * 10. type="button" — 폼 안에서 submit 되지 않는다
 * 11. touch-manipulation — 모바일 300ms 탭 지연 제거
 * 12. 🔴 labelledBy → 화면의 그 글자가 그룹 이름 (aria-label 은 비운다 — 둘이 겹치면 이긴 쪽만 읽힌다)
 * 13. labelledBy 가 없으면 label 이 그대로 이름 (기존 호출부 회귀 방어)
 * 14. describedBy → 그룹의 aria-describedby
 */
const TWO = [
  { value: 'no', label: '비대상' },
  { value: 'yes', label: '대상' },
] as const

const NINE = Array.from({ length: 9 }, (_, i) => ({
  value: `v${i}` as const,
  label: `옵션${i}`,
}))

describe('SegmentedToggle', () => {
  it('role=group + aria-label 로 묶인다', () => {
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: '보훈 대상' })).toBeInTheDocument()
  })

  it('옵션 수만큼 버튼이 순서대로 렌더된다', () => {
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['비대상', '대상'])
  })

  it('🔴 선택된 것만 aria-pressed=true', () => {
    render(<SegmentedToggle label="보훈 대상" value="yes" options={TWO} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '비대상' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '대상' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('🔴 value=null — 아무것도 눌려 있지 않다 (보훈·장애처럼 저장 전인 칸)', () => {
    render(<SegmentedToggle label="보훈 대상" value={null} options={TWO} onChange={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false')
  })

  it('클릭 → onChange(value)', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '대상' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('yes')
  })

  it('이미 선택된 것을 눌러도 onChange 는 나간다 (멱등 판단은 호출 측 몫)', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '비대상' }))
    expect(onChange).toHaveBeenCalledWith('no')
  })

  it('키보드 — 포커스 가능하고 Enter 로 활성화된다', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={onChange} />)
    const target = screen.getByRole('button', { name: '대상' })
    target.focus()
    expect(target).toHaveFocus()
    // button 은 Enter/Space 를 브라우저가 click 으로 바꾼다 — jsdom 에선 click 으로 동치 확인
    fireEvent.click(target)
    expect(onChange).toHaveBeenCalledWith('yes')
  })

  it('경계 — 옵션 2개', () => {
    render(<SegmentedToggle label="2개" value="no" options={TWO} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('경계 — 옵션 9개 (병역 상태 최대치)', () => {
    render(<SegmentedToggle label="9개" value="v0" options={NINE} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(9)
    expect(screen.getByRole('button', { name: '옵션8' })).toBeInTheDocument()
  })

  it('disabled — 전부 비활성이고 클릭해도 onChange 없음', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={onChange} disabled />)
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '대상' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('모바일 터치 타겟 44px', () => {
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '대상' }).className).toContain('min-h-[44px]')
  })

  it('type="button" — 폼 안에서 submit 되지 않는다', () => {
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button')
  })

  it('touch-manipulation — 모바일 300ms 탭 지연 제거', () => {
    render(<SegmentedToggle label="보훈 대상" value="no" options={TWO} onChange={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) expect(b.className).toContain('touch-manipulation')
  })

  it('🔴 labelledBy 를 주면 화면의 그 글자가 그룹 이름이 된다 (aria-label 은 비운다)', () => {
    render(
      <>
        <p id="patriot-label">보훈 대상 여부</p>
        <SegmentedToggle
          label="쓰이지 않는 이름" labelledBy="patriot-label"
          value={null} options={TWO} onChange={vi.fn()}
        />
      </>,
    )
    const group = screen.getByRole('group', { name: '보훈 대상 여부' })
    expect(group).not.toHaveAttribute('aria-label')
    expect(screen.queryByRole('group', { name: '쓰이지 않는 이름' })).toBeNull()
  })

  it('labelledBy 가 없으면 label 이 그대로 이름이다 (기존 호출부 회귀 방어)', () => {
    render(<SegmentedToggle label="보훈 대상" value={null} options={TWO} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: '보훈 대상' })).toHaveAttribute('aria-label', '보훈 대상')
  })

  it('describedBy → 그룹의 aria-describedby (칸 아래 도움말과 잇는다)', () => {
    render(
      <SegmentedToggle
        label="보훈 대상" describedBy="hint" value={null} options={TWO} onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('group', { name: '보훈 대상' })).toHaveAttribute('aria-describedby', 'hint')
  })
})
