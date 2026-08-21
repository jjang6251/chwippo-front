/**
 * study-note-media PR-A — image 노드 계약 spec (plan §4 「md 왕복」·「4소비처 렌더 회귀」 줄).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   게이트  1  🔴 기본 빌드(features 미지정)에는 image 노드가 **없다**
 *              — 준비 노트·활동 노트·회사 메모·AI 프리뷰가 전부 이 경로다
 *          2  features.image=true 에만 생긴다 (공부 노트)
 *          3  🔴 꺼진 소비처는 `![](url)` 을 받아도 노드를 안 만든다 (스키마에 없다)
 *          4  🔴 꺼진 소비처의 옛 문서 렌더 무손상 (image 추가로 아무것도 안 바뀐다)
 *   스킴    5  https·http 만 노드가 된다
 *          6  🔴 data:·javascript:·blob: 은 노드 자체가 안 생긴다 (alt 도 안 남는다)
 *   attrs   7  attachmentId 가 data-attachment-id 로 왕복한다
 *          8  md 로 수입된 외부 이미지는 attachmentId 가 null (우리 첨부가 아니다)
 *   md      9  수출 = `![](url)`
 *         10  수입 = image 노드 (alt 보존)
 *         11  왕복 — 넣은 src 가 그대로 돌아온다
 *   빈판정 12  🔴 이미지만 있는 문서는 **비어있지 않다** (editor.isEmpty)
 *         13  🔴 저장 값도 '' 가 아니다 (docToMemoValue — 여기가 ''면 이미지가 날아간다)
 *   자리표시 14 show → 위치를 찾을 수 있다
 *         15  🔴 자리 표시는 **문서에 안 들어간다** (저장·내보내기에 안 실린다)
 *         16  앞에 글을 더 써도 자리가 따라 밀린다 (tr.mapping)
 *         17  replace = image 노드 확정 + 자리 표시 회수
 *         18  hide = 문서 무변경 + 자리 표시 회수
 *         19  자리가 사라졌으면(문단 삭제) replace 는 false — 뒤늦게 튀어나오지 않는다
 */
import { describe, expect, it } from 'vitest'
import { Editor, type Extensions, type JSONContent } from '@tiptap/core'
import { buildEditorExtensions, parseEditorContent } from './editorExtensions'
import { editorToMarkdown, markdownToDocNodes } from './markdownIO'
import {
  hideImagePlaceholder,
  imagePlaceholderPos,
  isSafeImageSrc,
  replacePlaceholderWithImage,
  showImagePlaceholder,
} from './noteImage'
import { docToMemoValue, type TiptapDoc } from '@/utils/memoSections'

const SRC = 'https://cdn.example.com/study/abc-123.jpg'

/** 공부 노트 = image on · 그 밖의 소비처 = 미지정(기본 off) */
function extensions(image?: boolean): Extensions {
  return buildEditorExtensions({
    placeholder: 'ph',
    ...(image ? { features: { image: true } } : {}),
  })
}

function editor(options?: { image?: boolean; content?: JSONContent | string | null }) {
  return new Editor({
    extensions: extensions(options?.image),
    content: options?.content ?? null,
  })
}

interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
}

function tree(ed: Editor): DocNode {
  return JSON.parse(JSON.stringify(ed.getJSON())) as DocNode
}

/** 문서 어디든 image 노드를 모아 온다 */
function images(node: DocNode): DocNode[] {
  const here = node.type === 'image' ? [node] : []
  return here.concat(...(node.content ?? []).map(images))
}

const imageDoc: JSONContent = {
  type: 'doc',
  content: [{ type: 'image', attrs: { src: SRC, attachmentId: 'att-1' } }],
}

describe('image 게이트 — 소비처별 on/off', () => {
  it('1 🔴 기본 빌드에는 image 노드가 없다 (준비·활동·메모·AI 프리뷰)', () => {
    const ed = editor()
    expect(ed.schema.nodes.image).toBeUndefined()
    ed.destroy()
  })

  it('2 features.image=true 에만 생긴다 (공부 노트)', () => {
    const ed = editor({ image: true })
    expect(ed.schema.nodes.image).toBeDefined()
    ed.destroy()
  })

  it('3 🔴 꺼진 소비처는 `![](url)` 을 받아도 노드를 안 만든다', () => {
    const ed = editor()
    const nodes = markdownToDocNodes(ed, `![도식](${SRC})`)
    const json = { type: 'doc', content: nodes } as unknown as DocNode
    expect(images(json)).toHaveLength(0)
    ed.destroy()
  })

  it('4 🔴 꺼진 소비처의 옛 문서 렌더가 그대로다', () => {
    const legacy: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '왜 이 회사?' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '성장성이 높다' }] },
      ],
    }
    const ed = editor({ content: legacy })
    expect(tree(ed)).toEqual(JSON.parse(JSON.stringify(legacy)))
    ed.destroy()
  })
})

describe('src 스킴 — 허용 목록', () => {
  it('5 https·http 만 통과', () => {
    expect(isSafeImageSrc('https://a.example/x.png')).toBe(true)
    expect(isSafeImageSrc('http://a.example/x.png')).toBe(true)
    // 앞뒤 공백은 다듬고 본다
    expect(isSafeImageSrc('  https://a.example/x.png ')).toBe(true)
  })

  it('6 🔴 위험·상대 스킴은 노드 자체가 안 생긴다', () => {
    for (const bad of [
      'data:image/png;base64,iVBORw0KGgo=',
      'javascript:alert(1)',
      'blob:https://a.example/1',
      'file:///etc/passwd',
      '/relative/x.png',
      '',
      null,
    ]) {
      expect(isSafeImageSrc(bad)).toBe(false)
    }

    // 파서 경로에서도 통째로 떨어진다 (판정 함수만 맞고 파서가 새면 의미가 없다)
    const ed = editor({ image: true })
    const nodes = markdownToDocNodes(ed, '![x](data:image/png;base64,iVBORw0KGgo=)')
    expect(images({ type: 'doc', content: nodes } as unknown as DocNode)).toHaveLength(0)
    ed.destroy()
  })
})

describe('attrs · 마크다운 왕복', () => {
  it('7 attachmentId 가 data-attachment-id 로 왕복한다', () => {
    const ed = editor({ image: true, content: imageDoc })
    const html = ed.getHTML()
    expect(html).toContain('data-attachment-id="att-1"')

    // 레거시 HTML 본문이 열리는 것과 **같은 경로**로 되읽는다 (parseEditorContent → generateJSON).
    // 문자열을 그대로 content 에 넘기면 Markdown 확장이 마크다운으로 읽어 버린다
    const parsed = parseEditorContent(html, extensions(true)) as DocNode
    expect(images(parsed)[0].attrs?.attachmentId).toBe('att-1')
    ed.destroy()
  })

  it('8 md 로 수입된 외부 이미지는 attachmentId 가 null', () => {
    const ed = editor({ image: true })
    const nodes = markdownToDocNodes(ed, `![](${SRC})`)
    const found = images({ type: 'doc', content: nodes } as unknown as DocNode)
    expect(found[0].attrs?.attachmentId).toBeNull()
    ed.destroy()
  })

  it('9 수출 = `![](url)`', () => {
    const ed = editor({ image: true, content: imageDoc })
    expect(editorToMarkdown(ed).trim()).toBe(`![](${SRC})`)
    ed.destroy()
  })

  it('10 수입 = image 노드 (alt 보존)', () => {
    const ed = editor({ image: true })
    const nodes = markdownToDocNodes(ed, `![회로도](${SRC})`)
    const found = images({ type: 'doc', content: nodes } as unknown as DocNode)
    expect(found).toHaveLength(1)
    expect(found[0].attrs?.src).toBe(SRC)
    expect(found[0].attrs?.alt).toBe('회로도')
    ed.destroy()
  })

  it('11 왕복 — 넣은 src 가 그대로 돌아온다', () => {
    const first = editor({ image: true, content: imageDoc })
    const markdown = editorToMarkdown(first)

    const second = editor({ image: true })
    const nodes = markdownToDocNodes(second, markdown)
    expect(images({ type: 'doc', content: nodes } as unknown as DocNode)[0].attrs?.src).toBe(SRC)
    first.destroy()
    second.destroy()
  })
})

describe('🔴 「비었다」 판정 — 이미지만 있는 노트', () => {
  it('12 editor.isEmpty 가 false (빈 노트 자동 삭제가 이 값을 본다)', () => {
    const ed = editor({ image: true, content: imageDoc })
    expect(ed.isEmpty).toBe(false)
    ed.destroy()
  })

  it('13 🔴 저장 값이 `` 가 아니다 — 여기가 `` 면 이미지가 저장 순간 날아간다', () => {
    const ed = editor({ image: true, content: imageDoc })
    const value = docToMemoValue(ed.getJSON() as TiptapDoc)
    expect(value).not.toBe('')
    expect(value).toContain(SRC)
    ed.destroy()
  })
})

describe('업로드 자리 표시 — 데코레이션', () => {
  it('14 show 하면 위치를 찾을 수 있다', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    showImagePlaceholder(ed.view, 'up-1', 1)
    expect(imagePlaceholderPos(ed.view.state, 'up-1')).toBe(1)
    ed.destroy()
  })

  it('15 🔴 자리 표시는 문서에 안 들어간다 (저장·내보내기 무오염)', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    const before = ed.getJSON()
    showImagePlaceholder(ed.view, 'up-1', 1)
    expect(ed.getJSON()).toEqual(before)
    expect(editorToMarkdown(ed)).not.toContain('chw-image-uploading')
    ed.destroy()
  })

  it('16 앞에 글을 더 써도 자리가 따라 밀린다', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    showImagePlaceholder(ed.view, 'up-1', 4)
    ed.chain().setTextSelection(1).insertContent('앞말').run()
    expect(imagePlaceholderPos(ed.view.state, 'up-1')).toBe(6)
    ed.destroy()
  })

  it('17 replace = image 노드 확정 + 자리 표시 회수', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    showImagePlaceholder(ed.view, 'up-1', 1)
    const ok = replacePlaceholderWithImage(ed.view, 'up-1', {
      src: SRC,
      attachmentId: 'att-9',
    })

    expect(ok).toBe(true)
    const found = images(tree(ed))
    expect(found).toHaveLength(1)
    expect(found[0].attrs).toMatchObject({ src: SRC, attachmentId: 'att-9' })
    expect(imagePlaceholderPos(ed.view.state, 'up-1')).toBeNull()
    ed.destroy()
  })

  it('18 hide = 문서 무변경 + 자리 표시 회수', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    const before = ed.getJSON()
    showImagePlaceholder(ed.view, 'up-1', 1)
    hideImagePlaceholder(ed.view, 'up-1')

    expect(imagePlaceholderPos(ed.view.state, 'up-1')).toBeNull()
    expect(ed.getJSON()).toEqual(before)
    expect(images(tree(ed))).toHaveLength(0)
    ed.destroy()
  })

  it('19 자리가 사라졌으면 replace 는 false — 뒤늦게 튀어나오지 않는다', () => {
    const ed = editor({ image: true, content: '<p>한 줄</p>' })
    showImagePlaceholder(ed.view, 'up-1', 1)
    hideImagePlaceholder(ed.view, 'up-1')

    expect(
      replacePlaceholderWithImage(ed.view, 'up-1', { src: SRC, attachmentId: 'att-9' }),
    ).toBe(false)
    expect(images(tree(ed))).toHaveLength(0)
    ed.destroy()
  })
})
