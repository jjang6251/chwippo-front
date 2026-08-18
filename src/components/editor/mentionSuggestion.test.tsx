/**
 * study-notes Phase 2a — 멘션 suggestion(팝오버) spec.
 *
 * 시나리오:
 *   트리거  `[[` 로 열린다 · `@` 로도 열린다 · 평범한 글자로는 안 열린다
 *   필터    질의로 목록이 좁혀진다 (주입 소스가 전체를 줘도)
 *   키보드  ↓·↑ 이동 · Enter 삽입 · Escape 닫기 (마우스 없이 완결)
 *   삽입    결과 노드 JSON = 백엔드 계약 (studyNoteMention · noteId · label 스냅샷)
 *   빈결과  "찾는 노트가 없어요"
 *   접근성  role=listbox / option + aria-selected
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from './editorExtensions'
import type { StudyNoteMentionItem } from './StudyNoteMention'

const ITEMS: StudyNoteMentionItem[] = [
  { id: '11111111-1111-4111-8111-111111111111', title: '네트워크 정리' },
  { id: '22222222-2222-4222-8222-222222222222', title: '운영체제 정리' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'CS 기출' },
]

let editor: Editor | null = null

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor = new Editor({
    element: host,
    // 소스는 **거르지 않고 전체**를 준다 — 확장이 클라 필터를 책임지는지 함께 본다
    extensions: buildEditorExtensions({ placeholder: 'ph', mention: { items: () => ITEMS } }),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  return editor
}

/**
 * suggestion 은 입력 트랜잭션에서 열린다 — 실제 타이핑처럼 한 글자씩 넣는다.
 * 🔴 `await` 가 필요하다: @tiptap/suggestion 은 `items` 를 항상 await 하므로
 * (동기로 돌려줘도) 팝오버는 마이크로태스크 한 틱 뒤에 뜬다.
 */
async function type(ed: Editor, text: string) {
  await act(async () => {
    for (const ch of text) ed.commands.insertContent(ch)
  })
}

const popover = () => document.querySelector('[data-testid="mention-suggestion"]')
const options = () =>
  Array.from(document.querySelectorAll('[data-testid="mention-option"]')).map(
    (el) => el.textContent?.replace('📄', '').trim() ?? '',
  )

async function press(ed: Editor, key: string) {
  await act(async () => {
    ed.view.someProp('handleKeyDown', (f) =>
      f(ed.view, new KeyboardEvent('keydown', { key, bubbles: true })),
    )
  })
}

afterEach(() => {
  editor?.destroy()
  editor = null
  document.body.innerHTML = ''
})

describe('멘션 트리거', () => {
  it('`[[` 를 치면 팝오버가 열린다', async () => {
    const ed = mount()
    await type(ed, '[[')
    expect(popover()).not.toBeNull()
    expect(options()).toEqual(['네트워크 정리', '운영체제 정리', 'CS 기출'])
  })

  it('`@` 로도 열린다 (모바일에서 대괄호가 멀다)', async () => {
    const ed = mount()
    await type(ed, '@')
    expect(popover()).not.toBeNull()
  })

  it('평범한 글자로는 안 열린다', async () => {
    const ed = mount()
    await type(ed, '오늘 면접')
    expect(popover()).toBeNull()
  })
})

describe('멘션 필터', () => {
  it('주입 소스가 전체를 줘도 질의로 좁혀진다', async () => {
    const ed = mount()
    await type(ed, '[[정리')
    expect(options()).toEqual(['네트워크 정리', '운영체제 정리'])
  })

  it('결과가 없으면 빈 상태 문구', async () => {
    const ed = mount()
    await type(ed, '[[없는노트')
    expect(document.querySelector('[data-testid="mention-empty"]')?.textContent).toContain(
      '찾는 노트가 없어요',
    )
  })
})

describe('멘션 키보드 탐색', () => {
  it('↓ 로 이동하고 aria-selected 가 따라간다', async () => {
    const ed = mount()
    await type(ed, '[[')
    const selected = () =>
      Array.from(document.querySelectorAll('[data-testid="mention-option"]')).findIndex(
        (el) => el.getAttribute('aria-selected') === 'true',
      )
    expect(selected()).toBe(0)
    await press(ed, 'ArrowDown')
    expect(selected()).toBe(1)
    await press(ed, 'ArrowUp')
    expect(selected()).toBe(0)
    // 끝에서 위로 = 마지막으로 순환
    await press(ed, 'ArrowUp')
    expect(selected()).toBe(2)
  })

  it('🔴 Enter 로 삽입되고 노드 JSON 이 백엔드 계약과 맞는다', async () => {
    const ed = mount()
    await type(ed, '[[운영')
    await press(ed, 'Enter')

    const json = JSON.parse(JSON.stringify(ed.getJSON())) as {
      content?: Array<{ content?: Array<{ type: string; attrs?: Record<string, unknown> }> }>
    }
    const node = json.content?.[0]?.content?.[0]
    expect(node?.type).toBe('studyNoteMention')
    expect(node?.attrs?.noteId).toBe(ITEMS[1].id)
    expect(node?.attrs?.label).toBe('운영체제 정리')
    // 트리거 문자(`[[운영`)는 남지 않는다
    expect(ed.getText()).not.toContain('[[')
    expect(popover()).toBeNull()
  })

  it('Escape 로 닫고 아무것도 삽입하지 않는다', async () => {
    const ed = mount()
    await type(ed, '[[')
    await press(ed, 'Escape')
    expect(popover()).toBeNull()
    expect(JSON.stringify(ed.getJSON())).not.toContain('studyNoteMention')
  })
})

describe('멘션 팝오버 접근성·정리', () => {
  it('role=listbox / option 구조', async () => {
    const ed = mount()
    await type(ed, '[[')
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    expect(document.querySelectorAll('[role="option"]').length).toBe(3)
  })

  it('🔴 팝오버는 body 에 붙는다 (툴바 overflow 안에 있으면 잘린다)', async () => {
    const ed = mount()
    await type(ed, '[[')
    expect(popover()?.parentElement).toBe(document.body)
    expect(popover()?.className).toContain('overscroll-contain')
  })

  it('닫히면 DOM 에서 사라진다 (팝오버 누수 없음)', async () => {
    const ed = mount()
    await type(ed, '[[')
    expect(popover()).not.toBeNull()
    await press(ed, 'Escape')
    expect(document.querySelectorAll('[data-testid="mention-suggestion"]')).toHaveLength(0)
  })
})
