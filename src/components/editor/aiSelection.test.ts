/**
 * note-ai-panel — 에디터 기반부(선택 → 직렬화 → 삽입) spec.
 *
 * 시나리오 (plan §3 「프론트 · 선택→직렬화」「삽입」):
 *   확장   빈 선택 → null (패널은 생성 모드) / 문단 일부 → 문단 전체 / 두 문단 걸침 → 둘 다
 *   확장   리스트·표·토글 **내부** 선택 → 그 리스트·표·토글 통째 (depth 1 조상 — 의도된 동작)
 *   확장   전체 선택(depth 0 좌표) → 문서 전체
 *   직렬화 🔴 인라인 조각은 마크를 잃는다 / 블록 확장이면 `**…**` 가 산다 (확장 결정의 근거)
 *   직렬화 표·체크리스트·코드 언어 보존 · markdown 확장 꺼짐 → 평문 fallback · 낡은 좌표 무예외
 *   파싱   🔴 평문 산문(md 신호 0종)이 `looksLikeMarkdown` 게이트를 우회해 노드가 된다
 *   파싱   붙여넣기 게이트는 그대로 남아 있다 (평문 붙여넣기 회귀 잠금)
 *   삽입   교체/삽입이 **되돌리기 1회**로 복구 · 표 md 가 표 노드가 된다(이중 파싱 아님)
 *   삽입   빈 결과 무시 · 글자수 상한 초과 truncated · 상한 안/없음 false
 *   훅     빈 선택·선택·**문서 무변경 커서 이동에도 갱신** · 언마운트 해제 · editor 없음
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { buildEditorExtensions } from './editorExtensions'
import { handleMarkdownPaste, looksLikeMarkdown, markdownToDocNodes } from './markdownIO'
import {
  expandToBlockRange,
  serializeRange,
  replaceRangeWithMarkdown,
  insertMarkdownAt,
  useEditorSelection,
  type BlockRange,
} from './aiSelection'

/** 공부 노트에 실제로 들어 있는 모양 — 문단·마크·리스트·표·체크리스트·코드·토글 */
const FIXTURE_MD = `운영체제 정리를 시작한다

프로세스는 **독립된 주소 공간**을 가진다

- 데드락 4조건
- 기아 현상

| 구분 | 값 |
|---|---|
| 메모리 | 독립 |

- [x] 데드락 외우기
- [ ] 스케줄링 읽기

\`\`\`c
preempt();
\`\`\`

마지막 문단
`

/** 남겨 두면 파괴된 환경에서 prosemirror 의 DOM 관찰 타이머가 깨어난다 */
const opened: Editor[] = []
afterEach(() => {
  opened.splice(0).forEach((editor) => editor.destroy())
})

function makeEditor(opts?: { characterLimit?: number; markdown?: boolean }) {
  const editor = new Editor({
    extensions: buildEditorExtensions({
      placeholder: 'ph',
      characterLimit: opts?.characterLimit,
      features: opts?.markdown === false ? { markdown: false } : undefined,
    }),
    content: null,
  })
  opened.push(editor)
  return editor
}

/**
 * 픽스처 — 마크다운을 붙여넣어 문서를 짓고 트랜잭션을 한 번 흘린다. 그 한 번이 둘을 한다.
 *
 * ① 확장들의 **정규화**를 미리 태운다. StarterKit 의 TrailingNode 는 문서가 문단으로 안
 *    끝나면 첫 트랜잭션에 빈 문단을 덧붙인다(커서 이동 한 번으로도 일어난다) — 그게
 *    before/after 비교에 섞이면 판정이 흐려진다. 실제 화면에서는 첫 클릭이 이 역할을 한다.
 * ② `closeHistory` 로 **되돌리기 묶음을 끊는다**. prosemirror-history 는 500ms 안에 붙은
 *    변경을 한 묶음으로 합치는데, 테스트는 그보다 빨라서 픽스처를 짓는 붙여넣기까지 한
 *    묶음이 된다 — 그러면 undo 한 번이 문서를 통째로 비워 "undo 1회" 판정이 거짓이 된다.
 *    실제로는 AI 응답을 기다리는 몇 초가 이 경계를 만든다.
 */
function makeNote(opts?: { characterLimit?: number; markdown?: boolean }) {
  const editor = makeEditor(opts)
  handleMarkdownPaste(editor, FIXTURE_MD, opts?.characterLimit)
  editor.view.dispatch(closeHistory(editor.state.tr))
  return editor
}

/** 표 픽스처 — 커서 블록 대상 판정용 (요일 계획표 시나리오) */
function makeTableNote() {
  const editor = makeEditor()
  // 붙여넣기 게이트(신호 2종+)는 표 하나짜리 md 를 거른다 — AI 삽입과 같은 게이트 우회 경로로 심는다
  const nodes = markdownToDocNodes(editor, '| 요일 | 계획 |\n| --- | --- |\n| 월요일 | |\n| 화요일 | |')
  editor.chain().insertContent(nodes).run()
  editor.view.dispatch(closeHistory(editor.state.tr))
  return editor
}

/** 본문에서 텍스트 위치를 찾는다 — 픽스처 구조가 바뀌어도 spec 이 안 깨지게 */
function findText(editor: Editor, text: string): BlockRange {
  const hits: BlockRange[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const index = node.text.indexOf(text)
    if (index >= 0) hits.push({ from: pos + index, to: pos + index + text.length })
  })
  const hit = hits[0]
  if (!hit) throw new Error(`픽스처에서 못 찾음: ${text}`)
  return hit
}

/** 선택 후 확장 범위 (선택이 비면 실패) */
function selectAndExpand(editor: Editor, text: string): BlockRange {
  editor.commands.setTextSelection(findText(editor, text))
  const range = expandToBlockRange(editor)
  if (!range) throw new Error('확장 범위가 없다')
  return range
}

describe('expandToBlockRange — 선택을 최상위 블록 경계로', () => {
  /** 🔴 2026-08-19 CEO 실기 — "표에 커서 두고 채워달라" 가 생성 모드로 빠져 모델이
      기존 표를 못 봤다. 빈 선택 = 커서가 놓인 블록이 대상, 빈 문단에서만 생성 모드 */
  it('커서만 있어도 내용 블록 위면 그 블록이 대상이 된다', () => {
    const editor = makeNote()
    const cursor = findText(editor, '마지막 문단').from
    editor.commands.setTextSelection(cursor)
    const range = expandToBlockRange(editor)
    expect(range).not.toBeNull()
    expect(serializeRange(editor, range!)).toContain('마지막 문단')
  })

  it('빈 문단에 커서면 null — 패널은 생성 모드로 간다', () => {
    const editor = makeNote()
    // 문서 끝에 빈 문단 추가 후 커서 이동
    editor.commands.focus('end')
    editor.commands.insertContent({ type: 'paragraph' })
    editor.commands.focus('end')
    expect(expandToBlockRange(editor)).toBeNull()
  })

  it('표 안 셀에 커서만 둬도 표 전체가 대상이 된다 (요일 계획표 채우기 시나리오)', () => {
    const editor = makeTableNote()
    editor.commands.setTextSelection(findText(editor, '월요일').from)
    const range = expandToBlockRange(editor)
    expect(range).not.toBeNull()
    const md = serializeRange(editor, range!)
    expect(md).toContain('|')
    expect(md).toContain('월요일')
  })

  it('문단 일부만 잡아도 문단 전체가 된다', () => {
    const editor = makeNote()
    expect(serializeRange(editor, selectAndExpand(editor, '정리를'))).toBe('운영체제 정리를 시작한다')
  })

  it('두 문단에 걸치면 두 문단 전체', () => {
    const editor = makeNote()
    const first = findText(editor, '정리를')
    const second = findText(editor, '프로세스는')
    editor.commands.setTextSelection({ from: first.from, to: second.to })
    const range = expandToBlockRange(editor)
    expect(range).not.toBeNull()
    expect(serializeRange(editor, range!)).toBe(
      '운영체제 정리를 시작한다\n\n프로세스는 **독립된 주소 공간**을 가진다',
    )
  })

  /** 🔴 의도된 동작 — depth 1 조상이 리스트/표/토글이라 통째로 잡힌다 (하이라이트 데코가 그걸 보여 준다) */
  it('리스트 항목 안을 선택하면 리스트 전체', () => {
    const editor = makeNote()
    expect(serializeRange(editor, selectAndExpand(editor, '기아 현상'))).toBe(
      '- 데드락 4조건\n- 기아 현상',
    )
  })

  it('표 셀 안을 선택하면 표 전체', () => {
    const editor = makeNote()
    const md = serializeRange(editor, selectAndExpand(editor, '메모리'))
    expect(md).toContain('| 구분 | 값 |')
    expect(md).toContain('| 메모리 | 독립 |')
  })

  it('토글 안을 선택하면 토글 전체 (제목까지)', () => {
    const editor = makeEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'details',
          attrs: { open: false },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Q. 데드락 4조건은?' }] },
            {
              type: 'detailsContent',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '상호배제·점유대기' }] },
              ],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: '마지막 문단' }] },
      ],
    })
    expect(serializeRange(editor, selectAndExpand(editor, '상호배제'))).toBe(
      '**Q. 데드락 4조건은?**\n\n상호배제·점유대기',
    )
  })

  it('전체 선택(블록 사이 좌표 = depth 0)도 그대로 통한다', () => {
    const editor = makeNote()
    editor.commands.selectAll()
    expect(expandToBlockRange(editor)).toEqual({ from: 0, to: editor.state.doc.content.size })
  })
})

describe('serializeRange — 범위 → 마크다운', () => {
  /**
   * 🔴 **블록 확장을 택한 이유**(2026-08-19 실측). 인라인 조각은 직렬화는 되지만 마크가
   * 사라진다 — 굵게 걸린 글자가 맨 글자로 서버에 넘어가고, 그대로 교체되면 서식이 증발한다.
   */
  it('인라인 조각은 마크를 잃고, 블록으로 확장하면 살아난다', () => {
    const editor = makeNote()
    const inline = findText(editor, '독립된 주소')
    expect(serializeRange(editor, inline)).toBe('독립된 주소')
    expect(serializeRange(editor, selectAndExpand(editor, '독립된 주소'))).toBe(
      '프로세스는 **독립된 주소 공간**을 가진다',
    )
  })

  it('체크 상태·코드 언어가 보존된다', () => {
    const editor = makeNote()
    expect(serializeRange(editor, selectAndExpand(editor, '데드락 외우기'))).toContain(
      '- [x] 데드락 외우기',
    )
    expect(serializeRange(editor, selectAndExpand(editor, 'preempt'))).toContain('```c')
  })

  it('markdown 확장이 꺼진 소비처에서는 평문으로 떨어진다 (던지지 않는다)', () => {
    const editor = makeEditor({ markdown: false })
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '메모', marks: [{ type: 'bold' }] }],
        },
      ],
    })
    editor.commands.selectAll()
    const range = expandToBlockRange(editor)
    expect(range).not.toBeNull()
    expect(serializeRange(editor, range!)).toBe('메모')
  })

  /** 패널이 들고 있던 좌표는 사용자가 본문을 지우면 문서 밖을 가리킨다 — 렌더 중 예외 = 화면 사망 */
  it('문서 밖 좌표를 줘도 던지지 않는다 (문서 크기로 조인다)', () => {
    const editor = makeNote()
    const size = editor.state.doc.content.size
    expect(() => serializeRange(editor, { from: size + 500, to: size + 900 })).not.toThrow()
    expect(serializeRange(editor, { from: 0, to: size + 900 })).toContain('운영체제')
  })
})

describe('markdownToDocNodes — 붙여넣기 게이트 우회', () => {
  /** 🔴 plan 최대 함정 — 「쉽게 풀어쓰기」 결과는 마크다운 신호가 0종이다 */
  it('평문 산문은 붙여넣기 게이트를 못 통과하지만, AI 경로는 노드로 만든다', () => {
    const editor = makeEditor()
    const prose = '프로세스는 프로그램이 실행되는 단위이고, 스레드는 그 안의 작은 실행 흐름이다.'
    expect(looksLikeMarkdown(prose)).toBe(false)
    expect(markdownToDocNodes(editor, prose)).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: prose }] },
    ])
  })

  /** 게이트는 붙여넣기 경로에 그대로 남아 있어야 한다 — 평범한 메모가 목록으로 튀는 회귀 잠금 */
  it('붙여넣기 경로의 게이트는 그대로다', () => {
    const editor = makeEditor()
    expect(handleMarkdownPaste(editor, '준비할 것\n- 자소서\n- 포트폴리오')).toEqual({
      handled: false,
      truncated: false,
    })
    expect(editor.isEmpty).toBe(true)
  })

  it('markdown 확장이 꺼져 있으면 빈 배열', () => {
    expect(markdownToDocNodes(makeEditor({ markdown: false }), '# 제목')).toEqual([])
  })
})

describe('replaceRangeWithMarkdown / insertMarkdownAt', () => {
  it('확장 범위가 결과로 갈리고, 되돌리기 한 번에 원본이 돌아온다', () => {
    const editor = makeNote()
    const before = JSON.stringify(editor.getJSON())
    const range = selectAndExpand(editor, '독립된 주소')

    expect(replaceRangeWithMarkdown(editor, range, '## 프로세스\n\n독립된 공간을 가진다')).toEqual({
      ok: true,
      truncated: false,
    })
    expect(editor.getText()).toContain('독립된 공간을 가진다')
    expect(editor.getText()).not.toContain('프로세스는 독립된 주소 공간을 가진다')

    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON())).toBe(before)
  })

  /** 🔴 게이트 우회 확인 — 평문 결과가 통째로 버려지면 이 spec 이 먼저 깨진다 */
  it('평문(md 신호 0종) 결과도 교체된다', () => {
    const editor = makeNote()
    const range = selectAndExpand(editor, '독립된 주소')
    const plain = '프로세스는 자기만의 메모리 공간을 가진다.'

    expect(replaceRangeWithMarkdown(editor, range, plain).ok).toBe(true)
    expect(editor.getText()).toContain(plain)
  })

  /**
   * 🔴 문자열을 그대로 넘겼다면 Markdown 확장이 한 번 더 파싱해 `&lt;table&gt;` 평문이 박힌다.
   * 표가 **노드**로 생겼다는 것이 JSON 경로로 갔다는 증거다.
   */
  it('표 마크다운이 표 노드가 된다 (이중 파싱 아님)', () => {
    const editor = makeEditor()
    const at = editor.state.doc.content.size
    expect(insertMarkdownAt(editor, at, '| 구분 | 값 |\n|---|---|\n| 메모리 | 독립 |').ok).toBe(true)

    const types = new Set<string>()
    editor.state.doc.descendants((node) => {
      types.add(node.type.name)
    })
    expect(types).toContain('table')
    expect(editor.getText()).not.toContain('&lt;')
  })

  it('삽입은 기존 내용을 남기고 뒤에 붙는다 — 되돌리기 한 번에 복구', () => {
    const editor = makeNote()
    const before = JSON.stringify(editor.getJSON())
    const range = selectAndExpand(editor, '독립된 주소')

    expect(insertMarkdownAt(editor, range.to, '### 요약\n\n한 줄로 정리').ok).toBe(true)
    expect(editor.getText()).toContain('프로세스는 독립된 주소 공간을 가진다')
    expect(editor.getText()).toContain('한 줄로 정리')

    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON())).toBe(before)
  })

  /** 요청 사이에 본문이 줄어들면 패널이 들고 있던 좌표가 문서 밖을 가리킨다 — 던지면 패널이 멈춘다 */
  it('낡은(문서 밖) 좌표로 적용해도 던지지 않는다', () => {
    const editor = makeNote()
    const size = editor.state.doc.content.size

    expect(() => insertMarkdownAt(editor, size + 500, '뒤늦은 결과')).not.toThrow()
    expect(() =>
      replaceRangeWithMarkdown(editor, { from: size + 300, to: size + 800 }, '뒤늦은 교체'),
    ).not.toThrow()
    expect(editor.getText()).toContain('뒤늦은 결과')
  })

  it('빈·공백뿐인 결과는 무시한다 (빈 줄을 박지 않는다)', () => {
    const editor = makeNote()
    const before = JSON.stringify(editor.getJSON())

    expect(insertMarkdownAt(editor, 1, '   \n  ')).toEqual({ ok: false, truncated: false })
    expect(replaceRangeWithMarkdown(editor, selectAndExpand(editor, '기아 현상'), '')).toEqual({
      ok: false,
      truncated: false,
    })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
  })

  /**
   * CharacterCount 는 상한을 넘는 트랜잭션을 **통째로 거부**한다 — 한 글자도 안 들어간다.
   * 사용자에겐 "적용을 눌렀는데 아무 일도 안 일어난" 상태라 안내가 없으면 소실을 모른다.
   */
  it('글자수 상한을 넘기면 ok=false · truncated=true', () => {
    const editor = makeNote({ characterLimit: 200 })
    const before = JSON.stringify(editor.getJSON())

    expect(insertMarkdownAt(editor, 1, '가'.repeat(500))).toEqual({ ok: false, truncated: true })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
  })

  it('상한 안이면 truncated=false', () => {
    const editor = makeNote({ characterLimit: 5000 })
    expect(insertMarkdownAt(editor, 1, '짧은 요약')).toEqual({ ok: true, truncated: false })
  })

  it('상한이 없는 소비처는 truncated 가 늘 false', () => {
    const editor = makeNote()
    expect(insertMarkdownAt(editor, 1, '가'.repeat(5000))).toEqual({ ok: true, truncated: false })
  })
})

describe('useEditorSelection', () => {
  it('커서가 내용 블록 위면 empty=false — 그 블록이 대상 (2026-08-19 계약 승격)', () => {
    const editor = makeNote()
    editor.commands.setTextSelection(findText(editor, '마지막 문단').from)
    const { result } = renderHook(() => useEditorSelection(editor))
    expect(result.current.empty).toBe(false)
    expect(result.current.charCount).toBeGreaterThan(0)
  })

  it('빈 문단에 커서면 empty=true · charCount 0 — 생성 모드', () => {
    const editor = makeNote()
    editor.commands.focus('end')
    editor.commands.insertContent({ type: 'paragraph' })
    editor.commands.focus('end')
    const { result } = renderHook(() => useEditorSelection(editor))
    expect(result.current.empty).toBe(true)
    expect(result.current.charCount).toBe(0)
  })

  it('선택 — 확장 범위와 그 범위의 텍스트 길이를 준다', () => {
    const editor = makeNote()
    const { result } = renderHook(() => useEditorSelection(editor))

    act(() => {
      editor.commands.setTextSelection(findText(editor, '독립된 주소'))
    })
    const range = expandToBlockRange(editor)

    expect(result.current.empty).toBe(false)
    expect({ from: result.current.from, to: result.current.to }).toEqual(range)
    expect(result.current.charCount).toBe('프로세스는 독립된 주소 공간을 가진다'.length)
  })

  /**
   * 🔴 `transaction` 을 구독하는 이유 — 커서만 움직이면 문서가 안 바뀌어서 `onUpdate` 가
   * 안 온다. 부모 재렌더에만 기대면 패널의 대상·카운터가 직전 값에 멈춘다 (EditorToolbar 와 동형).
   */
  it('문서가 안 바뀌는 선택 변경에도 갱신된다', () => {
    const editor = makeNote()
    const { result } = renderHook(() => useEditorSelection(editor))
    const docBefore = editor.state.doc

    act(() => {
      editor.commands.setTextSelection(findText(editor, '기아 현상'))
    })
    const listRange = result.current

    act(() => {
      editor.commands.setTextSelection(findText(editor, '정리를'))
    })

    expect(editor.state.doc).toBe(docBefore)
    expect(result.current.from).not.toBe(listRange.from)
    expect(result.current.charCount).toBe('운영체제 정리를 시작한다'.length)
  })

  /** transaction 은 타이핑마다 흐른다 — 패널을 닫고도 남아 있으면 죽은 훅이 계속 계산한다 */
  it('언마운트하면 transaction 구독을 해제한다', () => {
    const editor = makeNote()
    const off = vi.spyOn(editor, 'off')
    const { unmount } = renderHook(() => useEditorSelection(editor))

    unmount()
    expect(off).toHaveBeenCalledWith('transaction', expect.any(Function))
  })

  it('editor 가 아직 없으면 기본값', () => {
    const { result } = renderHook(() => useEditorSelection(null))
    expect(result.current).toEqual({ empty: true, from: 0, to: 0, charCount: 0 })
  })
})
