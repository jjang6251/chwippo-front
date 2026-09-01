/**
 * card-detail-remodel — 공용 RichTextEditor 저장 계약 spec.
 * 빈 문서면 '' 전송(껍데기 JSON 저장 방지 회귀), 내용 있으면 tiptap JSON 문자열. 1.5s debounce 자동 저장.
 *
 * study-notes Phase 2a 추가 시나리오:
 *   읽기모드  편집 불가 · 툴바 숨김 · **토글 열고닫기는 동작** (self-test)
 *   읽기↔편집 prop 을 뒤집으면 따라간다
 *   붙여넣기  마크다운이면 파싱 · 평문이면 기본 동작 · 제한 초과 안내
 *   카운터    천 단위 구분 (로캘 고정) · 네 자리 미만은 그대로
 *   회귀      옛 문서를 열어 저장해도 내용이 유지된다
 */
import { render, act, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Editor } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

function setup(props?: Partial<Parameters<typeof RichTextEditor>[0]>) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  let editor: Editor | null = null
  const utils = render(
    <RichTextEditor
      initialContent={null}
      onSave={onSave}
      placeholder="ph"
      minHeightClass="min-h-[80px]"
      characterLimit={2000}
      header={(e) => { editor = e; return null }}
      {...props}
    />,
  )
  return { onSave, editor: editor as unknown as Editor, ...utils }
}

afterEach(cleanup)

describe('RichTextEditor — 자동 저장 계약', () => {
  /**
   * 🔴 **열기만 해서는 저장되지 않는다.**
   *
   * `onUpdate` 는 이름과 달리 **본문이 그대로인 트랜잭션에도 불린다**(실측: 마운트 직후
   * `docChanged:false` 2회). 그걸 안 거르면 화면을 열기만 해도 1.5초 뒤 저장이 나가,
   * 카드 상세에 들어갈 때마다 「저장됐어요」 토스트가 떴다 (CEO 2026-08-25 신고).
   *
   * 토스트보다 조용한 쪽이 더 나빴다 — 안 건드린 메모가 매 방문마다 다시 쓰이고
   * (빈 메모는 `null` → `''`), `updated_at` 이 갱신되고, 쓸모없는 쓰기가 방문 수만큼 쌓였다.
   * 이 에디터는 **6곳**이 쓴다(회사 메모·준비 노트·시트 노트·공부 노트·면접 세션·AI 미리보기).
   */
  it('🔴 열기만 하면 저장되지 않는다 — 빈 문서', async () => {
    const { onSave } = setup()
    await wait(1800)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('🔴 열기만 하면 저장되지 않는다 — 기존 내용이 있어도', async () => {
    const { onSave } = setup({
      initialContent: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '이미 적어둔 메모' }] }],
      }),
    })
    await wait(1800)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('내용 입력 → 1.5s 후 tiptap JSON 저장', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('회사 문화 좋음') })
    await wait(1600)
    expect(onSave).toHaveBeenCalledTimes(1)
    const val = onSave.mock.calls[0][0] as string
    expect(val).not.toBe('')
    expect(JSON.parse(val).type).toBe('doc')
  })

  it('내용 비우면 "" 저장 (빈 껍데기 JSON 저장 방지)', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('임시') })
    await wait(1600)
    onSave.mockClear()
    act(() => { editor.commands.clearContent(true) }) // emitUpdate=true
    await wait(1600)
    expect(onSave).toHaveBeenCalledWith('')
  })

  it('1.5s 전에는 저장 안 함 (debounce)', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('a') })
    await wait(1000)
    expect(onSave).not.toHaveBeenCalled()
    await wait(700)
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

// ── study-notes Phase 2a ──

const DETAILS_DOC = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'details',
      attrs: { open: false },
      content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Q. 데드락 4조건은?' }] },
        {
          type: 'detailsContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '상호배제·점유대기' }] }],
        },
      ],
    },
  ],
})

describe('읽기 모드', () => {
  it('편집이 막히고 툴바가 사라진다', () => {
    const { editor, container } = setup({ readOnly: true })
    expect(editor.isEditable).toBe(false)
    expect(container.querySelectorAll('[data-tool]')).toHaveLength(0)
  })

  it('편집 모드에서는 툴바가 있다', () => {
    const { container } = setup()
    expect(container.querySelectorAll('[data-tool]').length).toBeGreaterThan(0)
  })

  it('prop 을 뒤집으면 편집 가능 상태가 따라간다', () => {
    const onSave = vi.fn()
    let editor: Editor | null = null
    const view = render(
      <RichTextEditor
        initialContent={null}
        onSave={onSave}
        placeholder="ph"
        minHeightClass="min-h-[80px]"
        readOnly
        header={(e) => { editor = e; return null }}
      />,
    )
    expect((editor as unknown as Editor).isEditable).toBe(false)
    view.rerender(
      <RichTextEditor
        initialContent={null}
        onSave={onSave}
        placeholder="ph"
        minHeightClass="min-h-[80px]"
        readOnly={false}
        header={(e) => { editor = e; return null }}
      />,
    )
    expect((editor as unknown as Editor).isEditable).toBe(true)
  })

  /**
   * 🔴 읽기 모드의 존재 이유가 self-test 다 — 답을 접어두고 스스로 맞혀본 뒤 펼친다.
   * Details 토글 버튼은 `isEditable` 과 무관하게 시각 상태를 바꾼다 (문서 저장만 안 함).
   */
  it('🔴 읽기 모드에서도 토글이 열고 닫힌다', () => {
    const { container } = setup({ readOnly: true, initialContent: DETAILS_DOC })
    const details = container.querySelector('[data-type="details"]')!
    const toggle = details.querySelector('button')!
    expect(details.classList.contains('is-open')).toBe(false)
    fireEvent.click(toggle)
    expect(details.classList.contains('is-open')).toBe(true)
    fireEvent.click(toggle)
    expect(details.classList.contains('is-open')).toBe(false)
  })

  it('읽기 모드에서는 "기본 포맷 적용" 도 감춘다', () => {
    setup({ readOnly: true, template: { type: 'doc', content: [] } })
    expect(screen.queryByText('기본 포맷 적용 →')).toBeNull()
  })
})

describe('마크다운 붙여넣기', () => {
  function paste(container: HTMLElement, text: string, types = ['text/plain']) {
    const target = container.querySelector('.chw-prose')!
    fireEvent.paste(target, {
      // getData 는 **키를 봐야 한다** — 아무 키에나 본문을 돌려주면 codeBlock 확장이
      // `vscode-editor-data` 로 읽어 JSON.parse 하다 던진다
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : ''), types },
    })
  }

  it('마크다운이면 파싱해서 서식으로 들어간다', () => {
    const { editor, container } = setup()
    act(() => { paste(container, '## 프로세스\n\n- 독립 주소 공간\n- 스택만 분리') })
    const json = JSON.stringify(editor.getJSON())
    expect(json).toContain('"heading"')
    expect(json).toContain('"bulletList"')
  })

  it('평문이면 파싱하지 않는다 (오탐 방지)', () => {
    const { editor, container } = setup()
    act(() => { paste(container, '오늘 면접 봤다. 분위기가 좋았다.') })
    expect(JSON.stringify(editor.getJSON())).not.toContain('"heading"')
  })

  /** 서식이 붙은 복사(웹·노션 등)는 tiptap 이 HTML 로 더 잘 살린다 — 우리가 가로채지 않는다 */
  it('HTML 이 함께 온 붙여넣기는 tiptap 기본 경로에 맡긴다', () => {
    const { editor, container } = setup()
    act(() => { paste(container, '## 제목\n- 항목', ['text/plain', 'text/html']) })
    expect(JSON.stringify(editor.getJSON())).not.toContain('"heading"')
    expect(editor.getText()).toContain('## 제목')
  })

  it('글자 제한을 넘기면 안내가 뜬다', () => {
    const { container } = setup({ characterLimit: 30 })
    act(() => { paste(container, `## 제목\n\n${'가'.repeat(400)}\n\n- 항목`) })
    expect(screen.getByRole('status').textContent).toContain('다 들어가지 못했어요')
  })

  it('다음 편집을 시작하면 안내가 내려간다', () => {
    const { container, editor } = setup({ characterLimit: 30 })
    act(() => { paste(container, `## 제목\n\n${'가'.repeat(400)}\n\n- 항목`) })
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => { editor.commands.insertContent('가') })
    expect(screen.queryByRole('status')).toBeNull()
  })

  /**
   * 🔴 카운터는 **천 단위로 끊어 읽힌다**. 공부 노트 상한이 10만이라 자릿수를 세어야 하는
   * `1234 / 100000` 은 한눈에 안 들어온다. 로캘은 `'en-US'` 고정 — 기기 로캘에 맡기면
   * 유럽 설정에서 `100.000` 이 되고, 서버의 한도 초과 문구 표기와도 갈린다.
   */
  it('글자수 카운터가 천 단위로 끊긴다 (로캘 고정)', () => {
    const { editor } = setup({ characterLimit: 100_000 })
    act(() => { editor.commands.insertContent('가'.repeat(1234)) })
    expect(screen.getByText('1,234 / 100,000')).toBeInTheDocument()
  })

  it('네 자리 미만이면 구분자가 붙지 않는다', () => {
    const { editor } = setup({ characterLimit: 2000 })
    act(() => { editor.commands.insertContent('가'.repeat(12)) })
    expect(screen.getByText('12 / 2,000')).toBeInTheDocument()
  })

  /**
   * 노션 페이지를 복사하면 콜아웃이 `<aside>` 리터럴로 박혔다 (2026-09-02 실사용).
   * HTML 은 위 규칙대로 tiptap 기본 경로가 읽는데, 그 **직전**에 transformPastedHTML 이
   * 마커를 인용으로 바꾼다 (변환 규칙 자체는 notionPaste.test.ts).
   */
  it('노션 콜아웃 HTML 은 인용으로 들어간다 (리터럴이 안 남는다)', () => {
    const { editor, container } = setup()
    const html =
      "<meta charset='utf-8'><p>&lt;aside&gt;<br>\n⏰</p>\n<p>일정 확인하기</p>\n<p>&lt;/aside&gt;</p>"
    const plain = '<aside>\n⏰\n\n일정 확인하기\n</aside>'
    const target = container.querySelector('.chw-prose')!
    act(() => {
      fireEvent.paste(target, {
        // 위 paste 헬퍼와 같은 이유로 **키를 봐야 한다** (모르는 키엔 빈 문자열)
        clipboardData: {
          getData: (type: string) =>
            type === 'text/html' ? html : type === 'text/plain' ? plain : '',
          types: ['text/plain', 'text/html'],
        },
      })
    })
    const json = JSON.stringify(editor.getJSON())
    expect(json).toContain('"blockquote"')
    expect(json).not.toContain('aside')
    expect(editor.getText()).toContain('일정 확인하기')
  })
})

describe('🔴 옛 문서 회귀 — 열고 저장해도 내용이 유지된다', () => {
  it('준비 노트 옛 JSON 을 열어 한 글자 더 써도 기존 서식이 남는다', async () => {
    const legacy = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '연봉·처우' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: '초봉 5000' }],
        },
      ],
    })
    const { onSave, editor } = setup({ initialContent: legacy })
    act(() => { editor.commands.focus('end') })
    act(() => { editor.commands.insertContent('!') })
    await wait(1600)
    const saved = JSON.parse(onSave.mock.calls[0][0] as string)
    expect(saved.content[0]).toMatchObject({ type: 'heading', attrs: { level: 3 } })
    expect(saved.content[1].content[0].marks[0].type).toBe('bold')
  })

  it('레거시 평문은 마크다운으로 재조립되지 않는다', () => {
    const { editor } = setup({ initialContent: '연봉 3500\n- 사내식당 좋음' })
    expect(JSON.stringify(editor.getJSON())).not.toContain('bulletList')
  })

  it('내보내기 콜백은 마크다운 문자열을 받는다', () => {
    const onExportMarkdown = vi.fn()
    const { editor, container } = setup({ onExportMarkdown })
    act(() => {
      editor.commands.insertContent({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '운영체제' }],
      })
    })
    fireEvent.mouseDown(container.querySelector('[data-tool="export"]')!)
    expect(onExportMarkdown).toHaveBeenCalledTimes(1)
    expect(onExportMarkdown.mock.calls[0][0]).toContain('## 운영체제')
  })
})
