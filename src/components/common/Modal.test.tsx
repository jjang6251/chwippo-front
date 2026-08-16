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

  /**
   * 🔴 **터치 타겟 44px — 보이는 상자는 32px 그대로** (2026-08-17 `/uiux`).
   * `w-11 h-11` 로 키우면 헤더가 12px 자라 **앱 전역 모달의 세로 배치가 밀린다.**
   * 그래서 `::before` 로 히트 영역만 넓혔다 (실측 44×44 · 시각 32×32 유지).
   */
  it('6) 닫기 버튼 히트 영역이 ::before 로 확장돼 있다', () => {
    render(
      <Modal open onClose={vi.fn()} title="테스트 모달">
        <p>본문</p>
      </Modal>,
    )
    const btn = screen.getByRole('button', { name: '닫기' })
    expect(btn.className).toContain('w-8 h-8')
    expect(btn.className).toContain('before:-inset-1.5')
  })

  /**
   * 🔴 **`titleHidden` 닫기 버튼에 `relative` 를 붙이면 안 된다.**
   * `absolute` 와 같은 `position` 속성이라 **뒤에 오는 `.relative` 규칙이 이겨**
   * 버튼이 우상단을 벗어나 흐름 안으로 들어온다 (실측: 패널 높이 276 → 308px).
   * jsdom 은 Tailwind CSS 를 모르니 클래스 문자열로 고정한다 — 약하지만 재발은 막는다.
   */
  it('🔴 7) titleHidden 닫기 버튼은 absolute 이고 relative 가 섞이지 않는다', () => {
    render(
      <Modal open onClose={vi.fn()} title="테스트 모달" titleHidden>
        <p>본문</p>
      </Modal>,
    )
    const cls = screen.getByRole('button', { name: '닫기' }).className
    expect(cls).toContain('absolute top-3 right-3')
    expect(cls.split(/\s+/)).not.toContain('relative')
  })

  it('8) titleHidden → 제목은 sr-only 로 남아 접근성이 유지된다', () => {
    render(
      <Modal open onClose={vi.fn()} title="테스트 모달" titleHidden>
        <p>본문</p>
      </Modal>,
    )
    expect(screen.getByRole('heading', { name: '테스트 모달' }).className).toContain('sr-only')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '테스트 모달')
  })
})
