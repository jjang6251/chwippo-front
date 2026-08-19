/**
 * qa_toggle 후처리 — Q/A 텍스트를 진짜 토글 노드로 (2026-08-19 실측: md 엔 토글 문법이 없다).
 *
 * 시나리오:
 *   1  기본 2문항 → Details 2개 · 접힌 채(open:false) · summary=질문, content=답
 *   2  답의 `A.` 접두 제거 · 여러 줄 답(리스트 포함)은 노드 그대로 살아 있다
 *   3  패턴이 없으면 null (호출부는 일반 md 폴백)
 *   4  답 없는 문항은 스킵 · 전부 답이 없으면 null
 */
import { describe, expect, it, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'
import { qaMarkdownToToggleNodes } from './qaToggles'

let editor: Editor
function make() {
  editor = new Editor({ extensions: buildEditorExtensions({ placeholder: 'p' }) })
  return editor
}
afterEach(() => editor?.destroy())

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string }

describe('qaMarkdownToToggleNodes', () => {
  it('1 기본 2문항 → 접힌 토글 2개', () => {
    const md = '**Q. 프로세스란?**\nA. 자원 할당의 단위다.\n\n**Q. 스레드란?**\nA. 실행 흐름의 단위다.'
    const nodes = qaMarkdownToToggleNodes(make(), md) as Node[]
    expect(nodes).toHaveLength(2)
    for (const n of nodes) {
      expect(n.type).toBe('details')
      expect(n.attrs?.open).toBe(false)
    }
    expect(nodes[0].content?.[0].type).toBe('detailsSummary')
    expect(nodes[0].content?.[0].content?.[0].text).toBe('프로세스란?')
    // 답에서 A. 접두가 벗겨졌다
    const answerText = JSON.stringify(nodes[0].content?.[1])
    expect(answerText).toContain('자원 할당의 단위다.')
    expect(answerText).not.toContain('A. ')
  })

  it('2 여러 줄·리스트 답도 구조 그대로', () => {
    const md = '**Q. 스레드가 공유하는 영역은?**\nA. 다음을 공유한다:\n- Code\n- Data\n- Heap'
    const nodes = qaMarkdownToToggleNodes(make(), md) as Node[]
    expect(nodes).toHaveLength(1)
    const content = JSON.stringify(nodes[0].content?.[1])
    expect(content).toContain('bulletList')
    expect(content).toContain('Heap')
  })

  it('3 패턴 없으면 null — 일반 md 폴백', () => {
    expect(qaMarkdownToToggleNodes(make(), '그냥 문단입니다.\n\n표도 없어요.')).toBeNull()
  })

  it('4 답 없는 문항 스킵 · 전부 없으면 null', () => {
    const md = '**Q. 답이 없는 질문?**\n\n**Q. 답이 있는 질문?**\nA. 있다.'
    const nodes = qaMarkdownToToggleNodes(make(), md) as Node[]
    expect(nodes).toHaveLength(1)
    expect(nodes[0].content?.[0].content?.[0].text).toBe('답이 있는 질문?')
    expect(qaMarkdownToToggleNodes(make(), '**Q. 혼자인 질문?**')).toBeNull()
  })
})
