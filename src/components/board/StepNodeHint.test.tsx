import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StepNodeHint } from './StepNodeHint'
import { hasSeenStepNodeHint } from '@/utils/stepNodeHint'

/**
 * 🔴 **기회는 「닫기를 눌렀을 때」가 아니라 「떴을 때」 소진된다.**
 *
 * 닫기를 소진 조건으로 두면 스크롤 밖에서 못 보고 지나친 사람에게 **매 방문마다 다시 뜬다**.
 * 반대로 마운트에서 기록하면 한 번 뜨고 끝난다 — X 는 「지금 치우는」 용도지 소진 조건이 아니다.
 * (`researchIntro` 의 「소진 = 떴다」와 같은 판단.)
 */
describe('StepNodeHint — 1회 노출', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('뜨는 순간 기회가 소진된다 (닫기를 안 눌러도)', () => {
    render(<StepNodeHint userId="u1" onDismiss={vi.fn()} />)
    expect(hasSeenStepNodeHint('u1')).toBe(true)
  })

  it('X 를 누르면 부모에게 알린다 — 치우는 것과 소진은 다른 일이다', () => {
    const onDismiss = vi.fn()
    render(<StepNodeHint userId="u1" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: '안내 닫기' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('userId 가 없으면 기록하지 않는다 — 누구의 기억인지 모른다', () => {
    render(<StepNodeHint userId={undefined} onDismiss={vi.fn()} />)
    expect(localStorage.length).toBe(0)
  })

  it('안내 문구가 무엇을 누르라는 것인지 말한다', () => {
    render(<StepNodeHint userId="u1" onDismiss={vi.fn()} />)
    expect(screen.getByText(/동그라미/)).toBeInTheDocument()
  })
})
