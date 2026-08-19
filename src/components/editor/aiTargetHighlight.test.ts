/**
 * note-ai-panel — AI 대상 하이라이트 데코 spec.
 *
 * 시나리오 (plan §3 「프론트 · 하이라이트 데코 유지」):
 *   설정   setAiTarget → 지정 범위에 데코 1개 · 클래스는 `.chw-ai-target`
 *   🔴무해 데코 설정·해제가 **문서를 안 바꾼다** — doc 동일 객체 · `update` 미발화(자동 저장 미발화)
 *   해제   clearAiTarget → 데코 0 · 다시 설정하면 대체된다(누적 아님)
 *   추적   앞쪽을 편집하면 범위가 따라 밀린다 / 대상이 통째로 지워지면 사라진다
 *   경계   빈·역방향 범위는 무시 · 문서 밖 좌표를 줘도 던지지 않는다
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from './editorExtensions'
import { AI_TARGET_CLASS, getAiTargetRange } from './aiTargetHighlight'

/** 남겨 두면 파괴된 환경에서 prosemirror 의 DOM 관찰 타이머가 깨어난다 */
const opened: Editor[] = []
afterEach(() => {
  opened.splice(0).forEach((editor) => editor.destroy())
})

/**
 * 🔴 데코 확장은 `buildEditorExtensions` 에 **상시 등록**돼 있다 — 여기서 한 번 더 끼우면
 * prosemirror 가 `Adding different instances of a keyed plugin` 으로 던진다.
 * spec 이 소비 측과 같은 목록을 쓰는 것 자체가 「배선돼 있다」는 회귀 방어다.
 */
function makeEditor(text = '프로세스는 독립된 주소 공간을 가진다') {
  const editor = new Editor({
    extensions: buildEditorExtensions({ placeholder: 'ph' }),
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text }] },
        { type: 'paragraph', content: [{ type: 'text', text: '마지막 문단' }] },
      ],
    },
  })
  // 확장들의 정규화(TrailingNode 등)를 먼저 흘려보낸다 — 실제 화면에서는 첫 클릭이 한다
  editor.view.dispatch(editor.state.tr)
  opened.push(editor)
  return editor
}

/** 첫 문단 = 1 ~ 1+len */
const FIRST = { from: 1, to: 8 }

describe('AiTargetHighlight', () => {
  it('setAiTarget — 지정 범위에 데코가 하나 생긴다', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)

    expect(getAiTargetRange(editor)).toEqual(FIRST)
    expect(editor.view.dom.querySelector(`.${AI_TARGET_CLASS}`)).not.toBeNull()
  })

  /**
   * 🔴 이 spec 이 데코를 택한 이유 그 자체다.
   * 문서가 바뀌면 (a) 1.5s 자동 저장이 깨어나 AI 대상을 잡기만 해도 서버 쓰기가 나가고
   * (b) 되돌리기가 "하이라이트 켜기" 를 먹는다. meta 만 실은 트랜잭션이라 스텝이 0개다.
   */
  it('설정·해제가 문서를 건드리지 않는다 (자동 저장 미발화)', () => {
    const editor = makeEditor()
    const onUpdate = vi.fn()
    editor.on('update', onUpdate)
    const doc = editor.state.doc
    const json = JSON.stringify(editor.getJSON())

    editor.commands.setAiTarget(FIRST)
    editor.commands.clearAiTarget()

    expect(editor.state.doc).toBe(doc)
    expect(JSON.stringify(editor.getJSON())).toBe(json)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('clearAiTarget — 데코가 사라진다', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)
    editor.commands.clearAiTarget()

    expect(getAiTargetRange(editor)).toBeNull()
    expect(editor.view.dom.querySelector(`.${AI_TARGET_CLASS}`)).toBeNull()
  })

  it('다시 설정하면 대체된다 — 대상은 늘 하나', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)
    editor.commands.setAiTarget({ from: 10, to: 14 })

    expect(getAiTargetRange(editor)).toEqual({ from: 10, to: 14 })
    expect(editor.view.dom.querySelectorAll(`.${AI_TARGET_CLASS}`)).toHaveLength(1)
  })

  /** 요청 뒤 사용자가 위쪽을 고쳐도 하이라이트는 원래 문단에 붙어 있어야 한다 */
  it('앞쪽을 편집하면 범위가 따라 밀린다', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)
    editor.commands.insertContentAt(1, '앞에 추가')

    expect(getAiTargetRange(editor)).toEqual({ from: FIRST.from + 5, to: FIRST.to + 5 })
  })

  /** 패널은 이걸 [교체] 비활성 판정에 쓴다 — 대상이 없어졌으면 되돌릴 자리가 없다 */
  it('대상이 통째로 지워지면 하이라이트도 사라진다', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)
    editor.commands.deleteRange(FIRST)

    expect(getAiTargetRange(editor)).toBeNull()
  })

  it('빈·역방향 범위는 무시한다', () => {
    const editor = makeEditor()
    editor.commands.setAiTarget(FIRST)

    editor.commands.setAiTarget({ from: 5, to: 5 })
    expect(getAiTargetRange(editor)).toBeNull()

    editor.commands.setAiTarget({ from: 9, to: 4 })
    expect(getAiTargetRange(editor)).toBeNull()
  })

  it('문서 밖 좌표를 줘도 던지지 않는다', () => {
    const editor = makeEditor()
    const size = editor.state.doc.content.size

    expect(() => editor.commands.setAiTarget({ from: 1, to: size + 500 })).not.toThrow()
    expect(getAiTargetRange(editor)).toEqual({ from: 1, to: size })
  })
})
