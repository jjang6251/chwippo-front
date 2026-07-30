import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ToastContainer } from './ToastContainer'
import { toast, useToastStore } from '@/stores/toastStore'

/**
 * 위생 ③ — 토스트 스크린리더 공지.
 *
 * 라이브 영역은 **메시지보다 먼저 DOM 에 있어야** 스크린리더가 변화를 감지한다.
 * 그래서 토스트 0건일 때도 컨테이너를 유지한다.
 *
 * 🔴 별도 sr-only 영역을 두면 **문구가 DOM 에 두 번** 존재해 `getByText` 가 2개를 잡는다
 * (2026-07-30 e2e 실사고 — education validation 토스트). 라이브 속성은 시각 컨테이너에 둔다.
 *
 * 케이스:
 *  1. 토스트 0건에도 라이브 영역이 존재 (사후 마운트 금지)
 *  2. 토스트가 뜨면 그 영역에 문구가 들어간다
 *  3. **문구가 DOM 에 정확히 1번만** 존재 (중복 금지 — e2e 회귀 방어)
 *  4. 여러 개면 전부 한 영역 안에 있다
 */
describe('ToastContainer — 접근성 공지', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.setState({ toasts: [] })
    })
  })

  it('1. 토스트 0건에도 라이브 영역이 존재한다', () => {
    render(<ToastContainer />)
    const live = screen.getByRole('status')
    expect(live).toBeInTheDocument()
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('')
  })

  it('2. 토스트가 뜨면 그 영역에 문구가 들어간다', () => {
    render(<ToastContainer />)
    act(() => {
      toast.show('주소를 복사했어요.')
    })
    expect(screen.getByRole('status')).toHaveTextContent('주소를 복사했어요.')
  })

  it('3. 🔴 문구가 DOM 에 정확히 1번만 존재한다 (중복 = e2e strict mode 위반)', () => {
    render(<ToastContainer />)
    act(() => {
      toast.show('학교명을 입력해주세요.')
    })
    // getAllByText 로 개수를 직접 센다 — getByText 는 2개면 throw 해서 원인이 안 보인다
    expect(screen.getAllByText('학교명을 입력해주세요.')).toHaveLength(1)
  })

  it('4. 여러 개면 전부 한 라이브 영역 안에 있다', () => {
    render(<ToastContainer />)
    act(() => {
      toast.show('첫 번째')
      toast.show('두 번째')
    })
    const live = screen.getByRole('status')
    expect(live).toHaveTextContent('첫 번째')
    expect(live).toHaveTextContent('두 번째')
  })
})
