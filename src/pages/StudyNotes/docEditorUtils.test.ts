/**
 * 문서 페이지가 tiptap 문서를 읽는 두 지점 — 목차·토글 일괄 (plan §5 「읽기모드/일괄 접기」).
 *
 * 시나리오:
 *   TOC 1  h1·h2·h3 를 뽑는다 (h4 제외 · h1 포함은 2026-08-18 정정)
 *       2  빈 제목 줄은 건너뛴다
 *       3  본문 순서 그대로 · `pos` 로 DOM 을 찾을 수 있다
 *       4  제목이 없으면 빈 목차 (패널 자체를 숨길 근거)
 *   토글 5  총 개수·열린 개수를 센다
 *       6  일괄 접기 → 전부 open:false, 일괄 펼치기 → 전부 true
 *       7  🔴 바꿀 게 없으면 문서를 건드리지 않는다 (빈 트랜잭션도 자동 저장을 깨운다)
 *       8  🔴 undo 한 번으로 되돌아온다 (트랜잭션을 하나로 모았다는 증거)
 *   왕복 9  일괄 접기 결과가 **문서에 저장된다** (persist:true — 다음에 열어도 접혀 있다)
 */
import { describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'
import {
  countDetails,
  extractToc,
  setAllDetailsOpen,
  tocAncestorPositions,
  tocIndentClass,
} from './docEditorUtils'

function makeEditor(content: JSONContent) {
  return new Editor({
    extensions: buildEditorExtensions({ placeholder: 'ph' }),
    content,
  })
}

const heading = (level: number, text?: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: text ? [{ type: 'text', text }] : undefined,
})

const toggle = (open: boolean, summary: string): JSONContent => ({
  type: 'details',
  attrs: { open },
  content: [
    { type: 'detailsSummary', content: [{ type: 'text', text: summary }] },
    { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: '답' }] }] },
  ],
})

describe('extractToc', () => {
  it('1 h1·h2·h3 를 뽑고 h4 는 버린다 (h1 포함은 2026-08-18 정정 — 툴바·마크다운이 h1 을 만든다)', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        heading(1, '문서 제목'),
        heading(2, '프로세스와 스레드'),
        heading(3, '컨텍스트 스위칭'),
        heading(4, '너무 깊은 절'),
      ],
    })
    expect(extractToc(editor).map((t) => [t.level, t.text])).toEqual([
      [1, '문서 제목'],
      [2, '프로세스와 스레드'],
      [3, '컨텍스트 스위칭'],
    ])
  })

  it('2 빈 제목 줄은 건너뛴다', () => {
    const editor = makeEditor({ type: 'doc', content: [heading(2), heading(2, '스케줄링')] })
    expect(extractToc(editor).map((t) => t.text)).toEqual(['스케줄링'])
  })

  it('3 순서를 지키고 pos 로 문서 위치를 가리킨다', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [heading(2, '첫째'), { type: 'paragraph', content: [{ type: 'text', text: '본문' }] }, heading(2, '둘째')],
    })
    const toc = extractToc(editor)
    expect(toc.map((t) => t.text)).toEqual(['첫째', '둘째'])
    expect(toc[0].pos).toBeLessThan(toc[1].pos)
    expect(editor.state.doc.nodeAt(toc[1].pos)?.textContent).toBe('둘째')
  })

  it('4 제목이 없으면 빈 목차', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(extractToc(editor)).toEqual([])
  })
})

describe('countDetails · setAllDetailsOpen', () => {
  const docWithToggles = (): JSONContent => ({
    type: 'doc',
    content: [toggle(true, 'Q1'), { type: 'paragraph' }, toggle(false, 'Q2'), toggle(false, 'Q3')],
  })

  it('5 총 개수·열린 개수를 센다', () => {
    expect(countDetails(makeEditor(docWithToggles()))).toEqual({ total: 3, open: 1 })
    expect(countDetails(makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] }))).toEqual({
      total: 0,
      open: 0,
    })
  })

  it('6 일괄 접기·펼치기', () => {
    const editor = makeEditor(docWithToggles())
    setAllDetailsOpen(editor, false)
    expect(countDetails(editor)).toEqual({ total: 3, open: 0 })
    setAllDetailsOpen(editor, true)
    expect(countDetails(editor)).toEqual({ total: 3, open: 3 })
  })

  it('7 🔴 바꿀 게 없으면 문서를 건드리지 않는다', () => {
    const editor = makeEditor({ type: 'doc', content: [toggle(false, 'Q1')] })
    const before = editor.state
    setAllDetailsOpen(editor, false)
    expect(editor.state).toBe(before)
  })

  it('8 🔴 undo 한 번으로 되돌아온다 (트랜잭션 1개)', () => {
    const editor = makeEditor(docWithToggles())
    setAllDetailsOpen(editor, false)
    expect(countDetails(editor).open).toBe(0)
    editor.commands.undo()
    expect(countDetails(editor).open).toBe(1)
  })

  it('9 접힘 상태가 저장 형태(JSON)에 남는다 — 다음에 열어도 접혀 있다', () => {
    const editor = makeEditor(docWithToggles())
    setAllDetailsOpen(editor, false)
    const saved = JSON.stringify(editor.getJSON())
    const reopened = makeEditor(JSON.parse(saved) as JSONContent)
    expect(countDetails(reopened)).toEqual({ total: 3, open: 0 })
  })
})

describe('tocIndentClass — 최상위 레벨 기준 상대 들여쓰기 (2026-08-18)', () => {
  it('h2 만 쓰는 문서(템플릿 전부)는 기존 모습 그대로', () => {
    expect(tocIndentClass(2, 2)).toBe('pl-3')
    expect(tocIndentClass(3, 2)).toBe('pl-5')
  })
  it('h1 챕터 문서는 3단 위계가 생긴다', () => {
    expect(tocIndentClass(1, 1)).toBe('pl-3')
    expect(tocIndentClass(2, 1)).toBe('pl-5')
    expect(tocIndentClass(3, 1)).toBe('pl-7')
  })
  it('깊이 캡 — 셋째 단을 넘지 않는다', () => {
    expect(tocIndentClass(5, 1)).toBe('pl-7')
  })
})

describe('tocAncestorPositions — 활성 항목의 조상 챕터 경로 (2026-08-18)', () => {
  // pos 는 실제 문서 위치가 아니어도 된다 — 순서·레벨만 본다
  const toc = [
    { level: 1, text: '1장', pos: 10 },
    { level: 2, text: '1-A', pos: 20 },
    { level: 3, text: '1-A-i', pos: 30 },
    { level: 2, text: '1-B', pos: 40 },
    { level: 1, text: '2장', pos: 50 },
    { level: 2, text: '2-A', pos: 60 },
  ]

  it('h3 활성 → 소속 h2·h1 이 조상', () => {
    expect([...tocAncestorPositions(toc, 30)].sort()).toEqual([10, 20])
  })
  it('뒤 챕터의 h2 활성 → 그 챕터의 h1 만 (앞 챕터 안 켜짐)', () => {
    expect([...tocAncestorPositions(toc, 60)]).toEqual([50])
  })
  it('h1 활성 → 조상 없음 · activePos null → 빈 집합', () => {
    expect(tocAncestorPositions(toc, 50).size).toBe(0)
    expect(tocAncestorPositions(toc, null).size).toBe(0)
  })
  it('h2 만 있는 문서(템플릿) → 조상 개념 자체가 없다', () => {
    const flat = [
      { level: 2, text: 'A', pos: 1 },
      { level: 2, text: 'B', pos: 2 },
    ]
    expect(tocAncestorPositions(flat, 2).size).toBe(0)
  })
})
