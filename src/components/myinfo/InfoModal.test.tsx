/**
 * U14 — InfoModal 데스크탑 ESC 시나리오 (모바일 vaul 은 ESC 기본 제공 → 데스크탑 분기만 보완):
 * 1. ESC → onClose 호출
 * 2. saving 중 ESC → onClose 미호출 (오버레이 클릭과 동일 가드)
 * 3. 하위가 preventDefault 한 ESC → onClose 미호출 (오토컴플리트 드롭다운 닫기 선점)
 *
 * (jsdom 은 matchMedia 미구현 → useIsMobile=false → 데스크탑 분기)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InfoModal } from './InfoModal'

function renderModal(props: { onClose: () => void; saving?: boolean }) {
  return render(
    <InfoModal
      title="어학 성적"
      emoji="🗣"
      accent="brand"
      onClose={props.onClose}
      onSave={vi.fn()}
      saving={props.saving}
    >
      <input
        aria-label="인라인 입력"
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.preventDefault()
        }}
      />
    </InfoModal>,
  )
}

describe('InfoModal — 데스크탑 ESC (U14)', () => {
  it('1) ESC → onClose 1회', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('2) saving 중 ESC → onClose 미호출', () => {
    const onClose = vi.fn()
    renderModal({ onClose, saving: true })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('3) 하위가 preventDefault 한 ESC → onClose 미호출', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(screen.getByLabelText('인라인 입력'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
