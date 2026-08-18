/**
 * study-notes Phase 2a — 멘션 칩 렌더 spec.
 *
 * 시나리오:
 *   정상  📄 + 제목 스냅샷 · /study-notes/:id 링크 · onNavigate 주입 시 SPA 이동
 *   dead  「삭제된 노트」 점선 칩 · 이동 불가 (plan 결정 10)
 *   빈값  noteId 가 없으면 dead 취급 (빈 칩·죽은 링크 방지)
 *   라벨  제목 스냅샷이 비면 「제목 없음」
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'
import { StudyNoteMentionChip } from './StudyNoteMentionChip'
import type { StudyNoteMentionOptions } from './StudyNoteMention'

const NOTE_ID = '11111111-1111-4111-8111-111111111111'

function renderChip(
  attrs: { noteId?: string | null; label?: string },
  options: Partial<StudyNoteMentionOptions> = {},
) {
  const props = {
    node: { attrs },
    extension: { options: { items: () => [], ...options } },
  } as unknown as NodeViewProps
  return render(<StudyNoteMentionChip {...props} />)
}

afterEach(cleanup)

describe('멘션 칩 — 정상', () => {
  it('📄 + 삽입 시점 제목 · 노트 경로 링크', () => {
    renderChip({ noteId: NOTE_ID, label: '네트워크 정리' })
    const chip = screen.getByTestId('study-note-mention')
    expect(chip).toHaveTextContent('네트워크 정리')
    expect(chip).toHaveTextContent('📄')
    expect(chip).toHaveAttribute('href', `/study-notes/${NOTE_ID}`)
  })

  it('brand 틴트 칩 (mockup 시각 스펙)', () => {
    renderChip({ noteId: NOTE_ID, label: 'CS 기출' })
    expect(screen.getByTestId('study-note-mention').className).toContain('bg-brand/10')
  })

  it('제목 스냅샷이 비면 「제목 없음」', () => {
    renderChip({ noteId: NOTE_ID, label: '  ' })
    expect(screen.getByTestId('study-note-mention')).toHaveTextContent('제목 없음')
  })

  it('onNavigate 를 주입하면 SPA 이동으로 가로챈다', () => {
    const onNavigate = vi.fn()
    renderChip({ noteId: NOTE_ID, label: '운영체제' }, { onNavigate })
    fireEvent.click(screen.getByTestId('study-note-mention'))
    expect(onNavigate).toHaveBeenCalledWith(NOTE_ID)
  })

  it('onNavigate 가 없으면 기본 링크 이동에 맡긴다', () => {
    renderChip({ noteId: NOTE_ID, label: '운영체제' })
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
    screen.getByTestId('study-note-mention').dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(false)
  })
})

describe('멘션 칩 — 삭제된 노트', () => {
  it('isDeadNote 가 true 면 점선 「삭제된 노트」 칩', () => {
    renderChip({ noteId: NOTE_ID, label: '옛 노트' }, { isDeadNote: () => true })
    const dead = screen.getByTestId('study-note-mention-dead')
    expect(dead).toHaveTextContent('삭제된 노트')
    expect(dead.className).toContain('border-dashed')
    expect(dead.className).toContain('cursor-not-allowed')
    expect(screen.queryByTestId('study-note-mention')).toBeNull()
  })

  it('noteId 가 비면 dead 로 본다 (이동할 곳이 없다)', () => {
    renderChip({ noteId: null, label: '이름만 남은 칩' })
    expect(screen.getByTestId('study-note-mention-dead')).toBeInTheDocument()
  })

  it('기본값은 살아 있는 칩 — 이번 Phase 는 판정자를 안 넘긴다', () => {
    renderChip({ noteId: NOTE_ID, label: '살아 있음' })
    expect(screen.getByTestId('study-note-mention')).toBeInTheDocument()
  })
})
