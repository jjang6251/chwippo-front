/**
 * U14 — 공용 Modal 키보드·모달 위생 시나리오:
 * 1. ESC → onClose 호출
 * 2. 하위가 preventDefault 한 ESC → onClose 미호출 (중첩 confirm·인라인 에디터 선점 보장)
 * 3. 열렸다 닫힌 뒤 ESC → 무반응 (keydown 리스너 cleanup)
 * 4. 닫기 X 버튼 aria-label="닫기" (아이콘 only → 이름 필수)
 * 5. 스크롤 body overscroll-contain (뒤 페이지 scroll chaining 차단)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal — ESC·aria 위생 (U14)', () => {
  it('1) ESC → onClose 1회', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('2) 하위가 preventDefault 한 ESC → onClose 미호출', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="테스트 모달">
        {/* InlineNoteEditor 처럼 ESC 를 자기 취소로 선점하는 하위 요소 */}
        <input
          aria-label="인라인 입력"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault()
          }}
        />
      </Modal>,
    )
    fireEvent.keyDown(screen.getByLabelText('인라인 입력'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('3) 닫힌 뒤 ESC → 무반응 (리스너 cleanup)', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    rerender(
      <Modal open={false} onClose={onClose} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('4) 닫기 버튼 aria-label="닫기" → 클릭 시 onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    const closeBtn = screen.getByRole('button', { name: '닫기' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('5) 스크롤 body → overscroll-contain', () => {
    render(
      <Modal open onClose={vi.fn()} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    const scrollBody = screen.getByText('본문').parentElement!
    expect(scrollBody.className).toContain('overflow-y-auto')
    expect(scrollBody.className).toContain('overscroll-contain')
  })
})
