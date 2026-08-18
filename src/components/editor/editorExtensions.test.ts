/**
 * study-notes Phase 2a — 공용 에디터 확장 계약 spec.
 *
 * 시나리오 (plan §5 「공용 에디터 회귀」 + 확장별 동작):
 *  🔴 회귀 1  기존 준비 노트 옛 JSON(제목·목록·굵게·하이라이트) 렌더 무손상
 *  🔴 회귀 2  기존 활동 노트 옛 JSON(체크리스트·링크) 렌더 무손상
 *  🔴 회귀 3  레거시 **평문** 본문이 확장 추가 전과 **똑같은 doc** 으로 열린다
 *  🔴 회귀 4  확장 이름 중복 0 (link·underline 두 벌 등록이 실제로 있었다)
 *     링크    javascript:·data: 차단 / https 통과
 *     체크    toggle 시 checked 왕복
 *     형광펜  다른 색 = 교체(중첩 없음) · 같은 색 = 해제 · 지우개 · inline style 미주입
 *     표      삽입 · 행/열 추가·삭제
 *     토글    setDetails 구조 · open 이 문서에 저장됨(persist)
 *     코드    language attr 보존
 *     멘션    노드 JSON = 백엔드 계약 · 목록 클라 필터
 */
import { describe, it, expect } from 'vitest'
import { Editor, type Extensions, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
  buildEditorExtensions,
  parseEditorContent,
  DEFAULT_TABLE,
  HIGHLIGHT_COLORS,
} from './editorExtensions'
import {
  STUDY_NOTE_MENTION_TYPE,
  filterMentionItems,
  type StudyNoteMentionItem,
} from './StudyNoteMention'

const exts = (overrides?: Parameters<typeof buildEditorExtensions>[0]) =>
  buildEditorExtensions({ placeholder: 'ph', ...overrides })

function editor(content?: JSONContent | string | null, extensions: Extensions = exts()) {
  return new Editor({ extensions, content: content ?? null })
}

/**
 * `getJSON()` 의 JSONContent 는 text 노드까지 포함한 유니온이라 체인 인덱싱이 막힌다.
 * spec 이 보는 건 노드 트리 하나뿐이라 여기서 한 번만 좁힌다.
 */
interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  content?: DocNode[]
  text?: string
}
function tree(source: Editor | JSONContent): DocNode {
  return JSON.parse(JSON.stringify('getJSON' in source ? source.getJSON() : source)) as DocNode
}

/** attrs 를 뺀 **구조**만 비교 — 확장이 늘면 attr 은 늘 수 있어도 내용은 그대로여야 한다 */
interface Shape {
  type: string
  text?: string
  marks?: string[]
  content?: Shape[]
}
function shape(node: DocNode): Shape {
  const out: Shape = { type: node.type ?? '?' }
  if (node.text) out.text = node.text
  if (node.marks?.length) out.marks = node.marks.map((m) => m.type)
  if (node.content) out.content = node.content.map(shape)
  return out
}

// ── 옛 문서 픽스처 (확장 추가 이전 스키마로 저장된 실제 형태) ──
const LEGACY_PREP_DOC: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '왜 이 회사?' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '성장성이 ' },
        { type: 'text', marks: [{ type: 'bold' }], text: '확실하다' },
        { type: 'text', text: ' 그리고 ' },
        { type: 'text', marks: [{ type: 'highlight' }], text: '문화가 좋다' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '초봉 5000' }] }],
        },
      ],
    },
    { type: 'horizontalRule' },
  ],
}

const LEGACY_ACTIVITY_DOC: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '자소서 초안' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '포트폴리오' }] }],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          text: '채용 공고',
        },
      ],
    },
  ],
}

describe('🔴 회귀 — 옛 문서가 그대로 열린다', () => {
  it('준비 노트 옛 JSON — 구조·텍스트·마크 무손상', () => {
    const ed = editor(LEGACY_PREP_DOC)
    expect(shape(tree(ed))).toEqual(shape(tree(LEGACY_PREP_DOC)))
    expect(ed.getText()).toContain('성장성이 확실하다')
  })

  it('준비 노트 옛 JSON — heading level·highlight 가 살아 있다', () => {
    const ed = editor(LEGACY_PREP_DOC)
    const json = tree(ed)
    expect(json.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 3 } })
    const marks = json.content?.[1]?.content?.[3]?.marks
    expect(marks?.[0]?.type).toBe('highlight')
  })

  it('활동 노트 옛 JSON — 체크 상태·링크 href 무손상', () => {
    const ed = editor(LEGACY_ACTIVITY_DOC)
    const json = tree(ed)
    expect(json.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
    expect(json.content?.[0]?.content?.[1]?.attrs?.checked).toBe(false)
    expect(json.content?.[1]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe('https://example.com')
  })

  /**
   * 목록에 `tight` attr 이 **새로 붙는다** (tiptap-markdown 의 MarkdownTightLists 전역 attr).
   * 렌더에 쓰이는 `.tight` 클래스에 CSS 가 없어 화면은 그대로고, 백엔드는 본문 JSON 을
   * 멘션 추출 외에는 해석하지 않는다. 의도된 차이라 여기 못박아 둔다.
   */
  it('알려진 차이 — 목록에 tight attr 만 추가된다 (렌더 영향 없음)', () => {
    const json = tree(editor(LEGACY_PREP_DOC))
    expect(json.content?.[2]).toMatchObject({ type: 'bulletList', attrs: { tight: true } })
  })

  /**
   * 🔴 레거시 **평문** — Markdown 확장은 문자열 content 를 마크다운으로 읽는다.
   * `parseEditorContent` 가 미리 doc 으로 굳혀 옛 경로와 결과를 똑같이 유지한다.
   */
  it.each([
    '연봉 3500\n* 사내식당 좋음\n# 1차 면접 후기',
    '지원 동기 정리\n- 성장성\n- 문화',
    '1. 자소서\n2. 코테\n3. 면접',
    '평범한 한 줄 메모',
    '',
  ])('레거시 평문(%j) — 확장 추가 전 경로와 동일한 doc', (plain) => {
    // 확장 추가 이전 RichTextEditor 의 확장 목록 = 옛 경로
    const before = new Editor({
      extensions: [StarterKit, Underline, Highlight, Placeholder.configure({ placeholder: 'ph' })],
      content: plain || null,
    })
    const extensions = exts()
    const after = new Editor({
      extensions,
      content: parseEditorContent(plain || null, extensions),
    })
    expect(shape(tree(after))).toEqual(shape(tree(before)))
  })

  it('tiptap JSON 문자열은 그대로 파싱된다 (평문 경로로 새지 않는다)', () => {
    const extensions = exts()
    const parsed = parseEditorContent(JSON.stringify(LEGACY_PREP_DOC), extensions)
    expect(parsed).toEqual(LEGACY_PREP_DOC)
  })

  it('🔴 확장 이름 중복 0 — link·underline 이 두 벌 등록되지 않는다', () => {
    const names = editor().extensionManager.extensions.map((e) => e.name)
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dupes).toEqual([])
  })
})

describe('Link — 위험 프로토콜 차단', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox'])(
    '%s 는 링크가 되지 않는다',
    (href) => {
      const ed = editor({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '눌러보세요' }] }],
      })
      ed.commands.selectAll()
      ed.commands.setLink({ href })
      expect(JSON.stringify(tree(ed))).not.toContain('link')
    },
  )

  it('HTML 로 들어온 javascript: 링크도 벗겨진다', () => {
    const extensions = exts()
    const ed = new Editor({
      extensions,
      content: parseEditorContent('<p><a href="javascript:alert(1)">x</a></p>', extensions),
    })
    expect(JSON.stringify(tree(ed))).not.toContain('javascript:')
  })

  it('정상 https 링크는 통과한다', () => {
    const ed = editor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '공고' }] }],
    })
    ed.commands.selectAll()
    ed.commands.setLink({ href: 'https://chwippo.com' })
    expect(tree(ed).content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
      'https://chwippo.com',
    )
  })
})

describe('체크리스트', () => {
  it('toggleTaskList 로 만들고 체크 상태를 왕복한다', () => {
    const ed = editor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '데드락 4조건' }] }],
    })
    ed.chain().selectAll().toggleTaskList().run()
    const item = tree(ed).content?.[0]?.content?.[0]
    expect(item?.type).toBe('taskItem')
    expect(item?.attrs?.checked).toBe(false)

    // 툴바 active 표시는 커서가 항목 안에 있을 때 켜진다
    ed.commands.setTextSelection(3)
    expect(ed.isActive('taskList')).toBe(true)

    ed.commands.updateAttributes('taskItem', { checked: true })
    expect(tree(ed).content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
  })
})

describe('형광펜 5색', () => {
  const seed = (): Editor =>
    editor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '기아 현상' }] }],
    })

  it('색 5종 — 노랑·초록·파랑·빨강·보라', () => {
    expect(HIGHLIGHT_COLORS.map((c) => c.value)).toEqual([
      'yellow',
      'green',
      'blue',
      'red',
      'purple',
    ])
  })

  it('🔴 다른 색 적용 = 교체 (중첩 mark 없음)', () => {
    const ed = seed()
    ed.commands.selectAll()
    ed.commands.toggleHighlight({ color: 'yellow' })
    ed.commands.toggleHighlight({ color: 'blue' })
    const marks = tree(ed).content?.[0]?.content?.[0]?.marks ?? []
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ type: 'highlight', attrs: { color: 'blue' } })
  })

  it('같은 색 재클릭 = 해제', () => {
    const ed = seed()
    ed.commands.selectAll()
    ed.commands.toggleHighlight({ color: 'yellow' })
    expect(ed.isActive('highlight', { color: 'yellow' })).toBe(true)
    ed.commands.toggleHighlight({ color: 'yellow' })
    expect(tree(ed).content?.[0]?.content?.[0]?.marks ?? []).toHaveLength(0)
  })

  it('지우개 — unsetHighlight 로 선택 영역 제거', () => {
    const ed = seed()
    ed.commands.selectAll()
    ed.commands.toggleHighlight({ color: 'red' })
    ed.commands.unsetHighlight()
    expect(tree(ed).content?.[0]?.content?.[0]?.marks ?? []).toHaveLength(0)
  })

  it('🔴 색은 data-color 로만 — inline style 을 문서에 박지 않는다 (라이트 모드 보호)', () => {
    const ed = seed()
    ed.commands.selectAll()
    ed.commands.toggleHighlight({ color: 'green' })
    const html = ed.getHTML()
    expect(html).toContain('data-color="green"')
    expect(html).not.toContain('background-color')
  })
})

describe('표', () => {
  const withTable = () => {
    const ed = editor()
    ed.commands.insertTable(DEFAULT_TABLE)
    return ed
  }

  it('3×3 헤더 표를 삽입한다', () => {
    const table = tree(withTable()).content?.[0]
    expect(table?.type).toBe('table')
    expect(table?.content).toHaveLength(3)
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader')
    expect(table?.content?.[1]?.content?.[0]?.type).toBe('tableCell')
  })

  it('행 추가·삭제', () => {
    const ed = withTable()
    ed.commands.addRowAfter()
    expect(tree(ed).content?.[0]?.content).toHaveLength(4)
    ed.commands.deleteRow()
    expect(tree(ed).content?.[0]?.content).toHaveLength(3)
  })

  it('열 추가·삭제', () => {
    const ed = withTable()
    ed.commands.addColumnAfter()
    expect(tree(ed).content?.[0]?.content?.[0]?.content).toHaveLength(4)
    ed.commands.deleteColumn()
    expect(tree(ed).content?.[0]?.content?.[0]?.content).toHaveLength(3)
  })

  it('표 삭제', () => {
    const ed = withTable()
    ed.commands.deleteTable()
    expect(JSON.stringify(tree(ed))).not.toContain('"table"')
  })
})

describe('토글(Details)', () => {
  it('setDetails — summary/content 구조를 만든다', () => {
    const ed = editor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q. 데드락?' }] }],
    })
    ed.commands.selectAll()
    ed.commands.setDetails()
    const details = tree(ed).content?.[0]
    expect(details?.type).toBe('details')
    expect(details?.content?.[0]?.type).toBe('detailsSummary')
    expect(details?.content?.[1]?.type).toBe('detailsContent')
  })

  /** 🔴 접고 저장하면 다음에도 접혀 있어야 self-test 가 성립한다 (plan §3) */
  it('🔴 open 상태가 문서에 저장·복원된다 (persist)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Q.' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A.' }] }],
            },
          ],
        },
      ],
    }
    const saved = JSON.stringify(tree(editor(doc)))
    expect(JSON.parse(saved).content[0].attrs.open).toBe(true)
    // 닫아서 저장 → 다시 열어도 닫힘
    const ed = editor(JSON.parse(saved) as JSONContent)
    ed.commands.updateAttributes('details', { open: false })
    const reopened = editor(tree(ed))/*keep*/
    expect(tree(reopened).content?.[0]?.attrs?.open).toBe(false)
  })
})

describe('코드 블록', () => {
  it('language attr 이 보존된다', () => {
    const ed = editor({
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: 'c' }, content: [{ type: 'text', text: 'int x;' }] },
      ],
    })
    expect(tree(ed).content?.[0]?.attrs?.language).toBe('c')
  })
})

/**
 * 코드 블록 헤더 NodeView (mockup paste-demo·detail-desktop — 좌: 언어 · 우: 복사).
 *
 * 🔴 **vanilla NodeView 라 headless `new Editor` 에서도 그대로 뜬다.** 이 spec 이 그걸
 * 증명하는 자리이기도 하다 — React NodeView 였다면 템플릿을 headless 로 여는 spec 들이
 * 같이 깨졌을 것이다.
 *
 * 시나리오:
 *   1  헤더가 붙는다 — 언어 select(auto + 등록 16종) · 복사 버튼
 *   2  select 초기값 = `attrs.language` · auto 는 빈 값
 *   3  select 변경 → 문서의 language 가 바뀐다 (auto 로 되돌리면 null)
 *   4  🔴 읽기 모드에서는 변경이 먹지 않는다 — 값이 되돌아오고 문서는 그대로
 *   5  복사 → 클립보드에 **코드 원문** · 라벨이 「✓ 복사됨」으로 · 읽기 모드에서도 동작
 *   6  클립보드 실패는 조용히 무시된다 (에러가 새어 나오면 페이지가 죽는다)
 *   7  update() — 외부에서 language 를 바꾸면 select 가 따라간다
 */
describe('코드 블록 헤더 (NodeView)', () => {
  const CODE = 'int x = 1;'
  const withCode = (language: string | null) => ({
    type: 'doc',
    content: [
      { type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text: CODE }] },
    ],
  })

  /** jsdom 에는 `navigator.clipboard` 가 없다 — 환경을 채우고 호출만 관찰한다 */
  function stubClipboard(impl: () => Promise<void>) {
    const writeText = vi.fn(impl)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    return writeText
  }

  const head = (ed: Editor) => ed.view.dom.querySelector('.chw-codeblock-head')
  const select = (ed: Editor) =>
    ed.view.dom.querySelector<HTMLSelectElement>('.chw-codeblock-lang select')!
  const copyBtn = (ed: Editor) =>
    ed.view.dom.querySelector<HTMLButtonElement>('.chw-codeblock-copy')!
  const language = (ed: Editor) => tree(ed).content?.[0]?.attrs?.language

  it('1 헤더 — 언어 select(auto + 16종) · 복사 버튼', () => {
    const ed = editor(withCode('c'))
    expect(head(ed)).not.toBeNull()

    const options = Array.from(select(ed).options).map((o) => o.value)
    expect(options[0]).toBe('') // auto
    expect(options).toHaveLength(17) // auto + 등록 16종
    expect(options).toEqual(expect.arrayContaining(['c', 'sql', 'python', 'javascript']))

    expect(copyBtn(ed).textContent).toContain('복사')
    expect(select(ed).getAttribute('aria-label')).toBe('코드 언어')
  })

  it('2 select 초기값 = language attr · auto 는 빈 값', () => {
    expect(select(editor(withCode('sql'))).value).toBe('sql')
    expect(select(editor(withCode(null))).value).toBe('')
  })

  it('3 select 변경 → 문서의 language 가 바뀐다', () => {
    const ed = editor(withCode('c'))
    const el = select(ed)
    el.value = 'sql'
    el.dispatchEvent(new Event('change'))
    expect(language(ed)).toBe('sql')

    // auto 로 되돌리면 null — lowlight 가 다시 알아서 고른다
    el.value = ''
    el.dispatchEvent(new Event('change'))
    expect(language(ed)).toBeNull()
  })

  it('4 🔴 읽기 모드에서는 언어를 못 바꾼다 (값 되돌림 · 문서 무변경)', () => {
    const ed = editor(withCode('c'))
    ed.setEditable(false)
    const el = select(ed)
    expect(el.disabled).toBe(true)

    el.value = 'sql'
    el.dispatchEvent(new Event('change'))
    expect(language(ed)).toBe('c')
    expect(el.value).toBe('c') // 고른 값이 그대로 남아 있으면 바뀐 줄 안다
  })

  it('5 복사 → 클립보드에 코드 원문 · 라벨 전환 · 읽기 모드에서도 동작', async () => {
    const writeText = stubClipboard(() => Promise.resolve())
    const ed = editor(withCode('c'))
    ed.setEditable(false) // 읽기 모드가 복사의 주 무대다

    copyBtn(ed).click()
    expect(writeText).toHaveBeenCalledWith(CODE)
    await Promise.resolve()
    expect(copyBtn(ed).textContent).toContain('복사됨')
  })

  it('6 클립보드 실패는 조용히 무시된다', async () => {
    const writeText = stubClipboard(() => Promise.reject(new Error('denied')))
    const ed = editor(withCode('c'))

    expect(() => copyBtn(ed).click()).not.toThrow()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalled()
    // 라벨은 그대로 — 안 됐는데 됐다고 말하지 않는다
    expect(copyBtn(ed).textContent).not.toContain('복사됨')
  })

  it('7 외부에서 language 가 바뀌면 select 가 따라간다', () => {
    const ed = editor(withCode('c'))
    ed.commands.updateAttributes('codeBlock', { language: 'python' })
    expect(select(ed).value).toBe('python')
  })

  /**
   * 🔴 NodeView 로 DOM 을 직접 만들면 기본 `renderHTML` 의 `language-*` 클래스가 **통째로
   * 빠진다** — 실제로 그렇게 나갔다가 e2e 가 잡았다(2026-08-18). 하이라이팅 스팬은 lowlight
   * 플러그인이 따로 넣어 주므로 **색은 멀쩡한데 클래스만 없는** 상태라 눈으로는 안 보인다.
   */
  it('8 🔴 code 에 language-* 클래스가 붙는다 (auto 면 없다)', () => {
    const codeEl = (ed: Editor) => ed.view.dom.querySelector('.chw-codeblock pre code')!
    expect(codeEl(editor(withCode('javascript'))).className).toBe('language-javascript')
    expect(codeEl(editor(withCode(null))).className).toBe('')

    // 언어를 바꾸면 클래스도 따라간다
    const ed = editor(withCode('c'))
    ed.commands.updateAttributes('codeBlock', { language: 'sql' })
    expect(codeEl(ed).className).toBe('language-sql')
  })
})

describe('노트 멘션', () => {
  const items: StudyNoteMentionItem[] = [
    { id: '11111111-1111-4111-8111-111111111111', title: '네트워크 정리' },
    { id: '22222222-2222-4222-8222-222222222222', title: '운영체제 정리' },
    { id: '33333333-3333-4333-8333-333333333333', title: 'CS 기출' },
  ]
  const withMention = () => exts({ placeholder: 'ph', mention: { items: () => items } })

  /** 🔴 백엔드 `mention-links.ts` 가 이 노드 타입·attr 을 그대로 찾는다 */
  it('🔴 삽입 결과 JSON = 백엔드 계약 (studyNoteMention · attrs.noteId)', () => {
    const ed = editor(null, withMention())
    ed.commands.insertContent({
      type: STUDY_NOTE_MENTION_TYPE,
      attrs: { noteId: items[0].id, label: items[0].title },
    })
    const node = tree(ed).content?.[0]?.content?.[0]
    expect(node?.type).toBe('studyNoteMention')
    expect(node?.attrs?.noteId).toBe(items[0].id)
    expect(node?.attrs?.label).toBe('네트워크 정리')
  })

  it('label 은 삽입 시점 스냅샷 — 원본 제목이 바뀌어도 따라가지 않는다', () => {
    const ed = editor(null, withMention())
    ed.commands.insertContent({
      type: STUDY_NOTE_MENTION_TYPE,
      attrs: { noteId: items[0].id, label: '옛 제목' },
    })
    expect(tree(ed).content?.[0]?.content?.[0]?.attrs?.label).toBe('옛 제목')
  })

  it('mention 미지정이면 확장이 등록되지 않는다', () => {
    const names = editor().extensionManager.extensions.map((e) => e.name)
    expect(names).not.toContain(STUDY_NOTE_MENTION_TYPE)
  })

  it('클라 필터 — 제목 부분일치·대소문자 무시·빈 질의는 상위 N', () => {
    expect(filterMentionItems(items, '정리').map((i) => i.title)).toEqual([
      '네트워크 정리',
      '운영체제 정리',
    ])
    expect(filterMentionItems(items, 'cs').map((i) => i.title)).toEqual(['CS 기출'])
    expect(filterMentionItems(items, '')).toHaveLength(3)
    expect(filterMentionItems(items, '', 2)).toHaveLength(2)
    expect(filterMentionItems(items, '없는제목')).toEqual([])
  })
})

describe('features — 확장 on/off', () => {
  it('기본은 전부 on', () => {
    const all = editor().extensionManager.extensions
    const names = all.map((e) => e.name)
    expect(names).toEqual(
      expect.arrayContaining(['taskList', 'details', 'table', 'codeBlock', 'markdown']),
    )
    // codeBlock 은 StarterKit 것이 아니라 lowlight 버전이어야 한다 (이름이 같아 눈으로 못 가른다)
    expect(all.find((e) => e.name === 'codeBlock')?.options).toHaveProperty('lowlight')
  })

  it('개별로 끌 수 있다', () => {
    const names = editor(
      null,
      exts({ placeholder: 'ph', features: { table: false, details: false } }),
    ).extensionManager.extensions.map((e) => e.name)
    expect(names).not.toContain('table')
    expect(names).not.toContain('details')
    expect(names).toContain('taskList')
  })
})
