/**
 * card-detail-remodel — 회사 메모 리치 에디터 카드 spec.
 * 라벨·칩 3종(지인·인맥 제거)·칩 H3 삽입·중복 가드·✓·legacy plain 변환·카운터.
 * (순수 유틸 spec 은 memoSections.test.ts. 여기선 tiptap 통합.)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CompanyMemoCard } from './CompanyMemoCard'

function renderCard(value = '', onSave = vi.fn()) {
  return render(<CompanyMemoCard value={value} onSave={onSave} />)
}

describe('CompanyMemoCard — 리치 에디터', () => {
  it('라벨 + 보조문구 + 칩 3종 (지인·인맥 제거)', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: '회사 메모' })).toBeInTheDocument()
    expect(screen.getByText(/각 전형의 메모는 스텝 안에서/)).toBeInTheDocument()
    for (const t of [/왜 이 회사/, /연봉·처우/, /면접 분위기/]) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /지인·인맥/ })).not.toBeInTheDocument()
  })

  it('칩 클릭 → H3 heading 삽입 + ✓(aria-pressed)', () => {
    const { container } = renderCard()
    const chip = screen.getByRole('button', { name: /왜 이 회사/ })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelectorAll('.chw-prose h3').length).toBe(0)

    fireEvent.click(chip)

    expect(container.querySelectorAll('.chw-prose h3').length).toBe(1)
    expect(container.querySelector('.chw-prose h3')?.textContent).toBe('왜 이 회사?')
    expect(screen.getByRole('button', { name: /왜 이 회사/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('중복 칩 클릭 → H3 하나만 (중복 삽입 가드)', () => {
    const { container } = renderCard()
    const chip = () => screen.getByRole('button', { name: /왜 이 회사/ })
    fireEvent.click(chip())
    expect(container.querySelectorAll('.chw-prose h3').length).toBe(1)
    fireEvent.click(chip()) // 중복 — 가드
    expect(container.querySelectorAll('.chw-prose h3').length).toBe(1)
  })

  it('legacy plain 메모([제목] 포함) → H3/문단으로 변환 렌더 + 칩 ✓', () => {
    const { container } = renderCard('[왜 이 회사?]\n성장성이 좋다')
    const h3 = container.querySelector('.chw-prose h3')
    expect(h3?.textContent).toBe('왜 이 회사?')
    expect(screen.getByText('성장성이 좋다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /왜 이 회사/ })).toHaveAttribute('aria-pressed', 'true')
  })

  /* 카운터 표기는 천 단위로 끊긴다 (`RichTextEditor` — 로캘 `en-US` 고정) */
  it('카운터 노출 (N / 2,000)', () => {
    renderCard()
    expect(screen.getByText(/\/ 2,000/)).toBeInTheDocument()
  })
})
