/**
 * study-notes Phase 2a — 툴바 spec.
 *
 * 시나리오 (plan UX 검토 ⑥⑦ + 구현 게이트):
 *   순서    모바일 첫 화면 = B·H2·목록·체크·토글·형광펜 5색+지우개·멘션 (배열 순서가 곧 스펙)
 *   순서    I·U·S·H1·코드·표·링크·내보내기는 뒤
 *   🔴 스크롤 가로 스크롤 컨테이너가 py-1.5 -my-1.5 로 세로 스크롤을 막는다
 *   조건부  멘션·내보내기 버튼은 기능이 켜졌을 때만
 *   표      행/열 조작은 커서가 표 안일 때만 노출
 *   동작    각 버튼이 실제로 문서를 바꾼다 (죽은 버튼 방지 — 데모 형광펜이 조용히 죽어 있던 사고)
 *   접근성  모든 버튼에 aria-label · 토글형은 aria-pressed
 *
 * 「내보내기」 형식 선택 메뉴 (2026-08-21 — 손잡이 하나에 형식 둘):
 *   기본    PDF 콜백이 있어야 메뉴가 된다 · 없으면 예전 그대로 곧장 마크다운
 *   항목    마크다운(.md) → PDF로 저장 순서 · 각각 콜백 1회 후 닫힘
 *   🔴 잘림 메뉴는 `overflow-x-auto` 스크롤 행 **밖**에 산다 (안에 두면 통째로 잘린다)
 *   닫힘    ESC · 바깥 클릭 · 다른 툴 버튼 · 트리거 재클릭
 *   접근성  aria-haspopup="menu" · aria-expanded 가 열림/닫힘을 따라간다
 *   겹침    메뉴가 열려 있으면 같은 자리(top-full)의 툴팁은 안 뜬다
 *   문구    마크다운 전용 열화 경고는 버튼 툴팁이 아니라 md **항목**에 붙는다
 *   키보드  ↓↑ 순환·Home/End·ESC 후 트리거 복귀 — 세 메뉴 **공용 계약**으로 잰다
 *           (Enter·Space 는 네이티브 button 몫이라 가로채지 않는다)
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import type { Editor as ReactEditor } from '@tiptap/react'
import { assertMenuKeyboardContract } from '@/test/menuKeyboardContract'
import { EditorToolbar } from './EditorToolbar'
import { buildEditorExtensions } from './editorExtensions'

function makeEditor(withMention = false) {
  return new Editor({
    extensions: buildEditorExtensions({
      placeholder: 'ph',
      mention: withMention ? { items: () => [] } : undefined,
    }),
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '기아 현상' }] }],
    },
  }) as unknown as ReactEditor
}

function setup(opts?: {
  mention?: boolean
  onExport?: () => void
  onExportPdf?: () => void
  onInsertImage?: () => void
}) {
  const editor = makeEditor(opts?.mention)
  const utils = render(
    <EditorToolbar
      editor={editor}
      hasMention={opts?.mention}
      onExportMarkdown={opts?.onExport}
      onExportPdf={opts?.onExportPdf}
      onInsertImage={opts?.onInsertImage}
    />,
  )
  const order = () =>
    Array.from(utils.container.querySelectorAll('[data-tool]')).map((el) =>
      el.getAttribute('data-tool'),
    )
  return { editor, order, ...utils }
}

afterEach(cleanup)

describe('툴바 — 사용 빈도순 배치', () => {
  it('🔴 모바일 첫 화면 7종이 맨 앞에 온다 (B·H2·목록·체크·토글·형광펜·멘션)', () => {
    const { order } = setup({ mention: true })
    expect(order().slice(0, 12)).toEqual([
      'bold',
      'h2',
      'bulletList',
      'taskList',
      'details',
      'hl-yellow',
      'hl-green',
      'hl-blue',
      'hl-red',
      'hl-purple',
      'hl-clear',
      'mention',
    ])
  })

  it('덜 쓰는 서식은 뒤로 밀린다', () => {
    const { order } = setup({ mention: true, onExport: vi.fn() })
    expect(order().slice(12)).toEqual([
      'italic',
      'underline',
      'strike',
      'h1',
      'h3',
      'codeBlock',
      'table',
      'link',
      'hr',
      'export',
    ])
  })

  it('형광펜은 5색 + 지우개', () => {
    const { order } = setup()
    expect(order().filter((k) => k?.startsWith('hl-'))).toEqual([
      'hl-yellow',
      'hl-green',
      'hl-blue',
      'hl-red',
      'hl-purple',
      'hl-clear',
    ])
  })
})

describe('🔴 가로 스크롤이 세로 스크롤을 부르지 않는다', () => {
  /**
   * `overflow-x-auto` 는 CSS 규칙상 `overflow-y: visible` 을 **강제로 auto** 로 만든다.
   * 버튼 focus ring 이 1~2px 삐져나오면 툴바가 세로로도 "약간" 스크롤된다.
   * jsdom 은 레이아웃을 모르니 클래스로 고정한다 (JobSiteChips.test 와 같은 패턴).
   */
  it('스크롤 컨테이너가 py-1.5 -my-1.5 로 넘침을 품는다', () => {
    const { container } = setup()
    const scroller = container.querySelector('.overflow-x-auto')
    expect(scroller?.className).toContain('py-1.5')
    expect(scroller?.className).toContain('-my-1.5')
  })

  it('버튼이 줄바꿈으로 도망가지 않는다 (w-max + shrink-0)', () => {
    const { container } = setup()
    const row = container.querySelector('.overflow-x-auto > div')
    expect(row?.className).toContain('w-max')
    expect(container.querySelector('[data-tool="bold"]')?.className).toContain('shrink-0')
    expect(container.querySelector('.flex-wrap')).toBeNull()
  })
})

describe('툴바 — 조건부 노출', () => {
  it('멘션 기능이 꺼져 있으면 버튼도 없다', () => {
    const { order } = setup()
    expect(order()).not.toContain('mention')
  })

  it('내보내기 콜백이 없으면 버튼도 없다', () => {
    const { order } = setup()
    expect(order()).not.toContain('export')
  })

  it('내보내기 버튼은 콜백을 부른다', () => {
    const onExport = vi.fn()
    const { container } = setup({ onExport })
    fireEvent.mouseDown(container.querySelector('[data-tool="export"]')!)
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  /* study-note-media PR-A — 📷 는 공부 노트에만 붙는다 (준비·활동·메모는 콜백이 없다) */
  it('🔴 이미지 콜백이 없으면 버튼도 없다 (공부 노트 외 소비처 무변경)', () => {
    const { order } = setup()
    expect(order()).not.toContain('image')
  })

  it('이미지 버튼은 1군 토글 뒤에 온다', () => {
    const { order } = setup({ onInsertImage: vi.fn() })
    expect(order().slice(0, 6)).toEqual([
      'bold',
      'h2',
      'bulletList',
      'taskList',
      'details',
      'image',
    ])
  })

  it('이미지 버튼은 콜백을 부른다 (파일 선택창 열기)', () => {
    const onInsertImage = vi.fn()
    const { container } = setup({ onInsertImage })
    fireEvent.mouseDown(container.querySelector('[data-tool="image"]')!)
    expect(onInsertImage).toHaveBeenCalledTimes(1)
  })
})

describe('툴바 — 「내보내기」 형식 선택 메뉴', () => {
  function openMenu(container: HTMLElement) {
    fireEvent.mouseDown(container.querySelector('[data-tool="export"]')!)
  }

  function withBoth(extra?: { onExport?: () => void; onExportPdf?: () => void }) {
    return setup({
      onExport: extra?.onExport ?? vi.fn(),
      onExportPdf: extra?.onExportPdf ?? vi.fn(),
    })
  }

  it('누르기 전에는 메뉴가 없다 (트리거는 haspopup 을 알린다)', () => {
    const { container } = withBoth()
    const btn = container.querySelector('[data-tool="export"]')!
    expect(btn.getAttribute('aria-haspopup')).toBe('menu')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.getAttribute('aria-label')).toBe('내보내기')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('누르면 항목 2개 — 마크다운(.md) → PDF로 저장', () => {
    const { container } = withBoth()
    openMenu(container)
    expect(screen.getAllByRole('menuitem').map((el) => el.getAttribute('aria-label'))).toEqual([
      '마크다운(.md)',
      'PDF로 저장',
    ])
    expect(container.querySelector('[data-tool="export"]')?.getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('마크다운 항목 = 기존 내보내기 1회 + 메뉴 닫힘', () => {
    const onExport = vi.fn()
    const onExportPdf = vi.fn()
    const { container } = withBoth({ onExport, onExportPdf })
    openMenu(container)
    fireEvent.click(screen.getByRole('menuitem', { name: '마크다운(.md)' }))

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExportPdf).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('PDF 항목 = 인쇄 콜백 1회 + 메뉴 닫힘', () => {
    const onExport = vi.fn()
    const onExportPdf = vi.fn()
    const { container } = withBoth({ onExport, onExportPdf })
    openMenu(container)
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF로 저장' }))

    expect(onExportPdf).toHaveBeenCalledTimes(1)
    expect(onExport).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /**
   * 🔴 툴바 행은 `overflow-x-auto` 라 세로도 auto 가 된다 — 그 안에 absolute 로 띄우면
   * 메뉴가 통째로 잘린다. 툴팁이 이미 피해 간 길(스크롤 행 바깥)을 그대로 탄다.
   * jsdom 은 레이아웃을 모르니 **어디에 사는지**로 고정하고, 실제 잘림 여부는 Playwright.
   */
  it('🔴 메뉴는 스크롤 컨테이너 밖에 있다', () => {
    const { container } = withBoth()
    openMenu(container)
    expect(screen.getByRole('menu').closest('.overflow-x-auto')).toBeNull()
  })

  it('🔴 모바일에서도 보이고 눌린다 — 툴팁의 hidden·pointer-events-none 을 안 베꼈다', () => {
    const { container } = withBoth()
    openMenu(container)
    const cls = screen.getByRole('menu').className
    expect(cls).not.toContain('hidden')
    expect(cls).not.toContain('pointer-events-none')
  })

  it('ESC 로 닫힌다', () => {
    const { container } = withBoth()
    openMenu(container)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('바깥 클릭으로 닫힌다', () => {
    const { container } = withBoth()
    openMenu(container)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('트리거를 다시 누르면 닫힌다', () => {
    const { container } = withBoth()
    openMenu(container)
    openMenu(container)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('다른 툴 버튼을 누르면 닫힌다 (메뉴가 남아 서식 위에 떠 있지 않게)', () => {
    const { container } = withBoth()
    openMenu(container)
    fireEvent.mouseDown(container.querySelector('[data-tool="bold"]')!)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /**
   * 키보드 탐색 — 세 `role="menu"` 가 **똑같이** 움직인다 (`useMenuKeyboard` 공용).
   * 계약 본문은 `src/test/menuKeyboardContract.ts` 에 한 벌만 있고, 노트 메뉴(DocMenu)·
   * 허브 ⋯(DotsMenu) spec 도 **같은 함수**를 부른다 — 그게 "같음" 의 증거다.
   */
  it('키보드 탐색 계약 — ↓↑ 순환 · Home/End · ESC 복귀 (항목 2개)', () => {
    const { container } = withBoth()
    const trigger = () => container.querySelector<HTMLElement>('[data-tool="export"]')!
    assertMenuKeyboardContract({
      trigger,
      // 툴바 트리거는 mousedown 에서 연다 (ProseMirror 선택 보존 — preventDefault)
      openByMouse: () => fireEvent.mouseDown(trigger()),
      // 키보드는 mousedown 을 안 낸다 — detail 0 click 이 그 경로다
      openByKeyboard: () => fireEvent.click(trigger(), { detail: 0 }),
    })
  })

  it('항목을 골라 닫혀도 포커스가 트리거로 돌아온다 (다음 Tab 이 페이지 맨 앞으로 안 튄다)', () => {
    const onExport = vi.fn()
    const { container } = withBoth({ onExport })
    const trigger = container.querySelector<HTMLElement>('[data-tool="export"]')!
    fireEvent.click(trigger, { detail: 0 })
    const first = screen.getByRole('menuitem', { name: '마크다운(.md)' })
    expect(document.activeElement).toBe(first)

    fireEvent.click(first)
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('마우스로 열면 첫 항목에 포커스를 주지 않는다 (안 누른 포커스 링·선택 영역 파괴 방지)', () => {
    const { container } = withBoth()
    openMenu(container)
    expect(screen.getAllByRole('menuitem')).not.toContain(document.activeElement)
  })

  it('메뉴가 열려 있으면 툴팁은 안 뜬다 (둘 다 top-full — 같은 자리다)', () => {
    const { container } = withBoth()
    const btn = container.querySelector('[data-tool="export"]')!
    fireEvent.mouseEnter(btn)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    openMenu(container)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('🔴 마크다운 열화 경고는 md 항목에 붙는다 (버튼 툴팁에서 옮겨졌다)', () => {
    const { container } = withBoth()
    fireEvent.mouseEnter(container.querySelector('[data-tool="export"]')!)
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('토글·형광펜은 열화돼요')

    openMenu(container)
    expect(screen.getByRole('menuitem', { name: '마크다운(.md)' })).toHaveTextContent(
      '토글·형광펜은 열화돼요',
    )
  })

  /**
   * 🔴 형식이 하나뿐이면 메뉴는 **선택 없는 한 번 더 누르기**다. 앱 웹뷰(print 무동작)와
   * PDF 를 안 쓰는 소비처(준비·활동·회사 메모 노트)가 모두 이 경로를 탄다.
   */
  it('🔴 PDF 콜백이 없으면 메뉴가 아니라 예전처럼 곧장 마크다운이다', () => {
    const onExport = vi.fn()
    const { container } = setup({ onExport })
    const btn = container.querySelector('[data-tool="export"]')!

    expect(btn.getAttribute('aria-haspopup')).toBeNull()
    expect(btn.getAttribute('aria-label')).toBe('마크다운 내보내기')

    fireEvent.mouseDown(btn)
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('키보드(Enter·Space)로도 메뉴가 열린다', () => {
    const { container } = withBoth()
    fireEvent.click(container.querySelector('[data-tool="export"]')!, { detail: 0 })
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })
})

describe('툴바 — 버튼이 실제로 문서를 바꾼다', () => {
  it('굵게', () => {
    const { editor, container } = setup()
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="bold"]')!)
    expect(editor.isActive('bold')).toBe(true)
  })

  it('형광펜 — 색 적용 후 같은 색 재클릭이면 해제', () => {
    const { editor, container } = setup()
    const btn = container.querySelector('[data-tool="hl-yellow"]')!
    editor.commands.selectAll()
    fireEvent.mouseDown(btn)
    expect(editor.isActive('highlight', { color: 'yellow' })).toBe(true)
    editor.commands.selectAll()
    fireEvent.mouseDown(btn)
    expect(editor.isActive('highlight')).toBe(false)
  })

  it('형광펜 — 다른 색이면 교체(중첩 없음)', () => {
    const { editor, container } = setup()
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="hl-yellow"]')!)
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="hl-blue"]')!)
    const marks = editor.getJSON().content?.[0]?.content?.[0]?.marks ?? []
    expect(marks).toHaveLength(1)
    expect(marks[0]?.attrs?.color).toBe('blue')
  })

  it('지우개', () => {
    const { editor, container } = setup()
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="hl-red"]')!)
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="hl-clear"]')!)
    expect(editor.isActive('highlight')).toBe(false)
  })

  it('체크리스트·토글·표·코드블록', () => {
    const { editor, container } = setup()
    fireEvent.mouseDown(container.querySelector('[data-tool="taskList"]')!)
    expect(JSON.stringify(editor.getJSON())).toContain('taskItem')

    fireEvent.mouseDown(container.querySelector('[data-tool="table"]')!)
    expect(JSON.stringify(editor.getJSON())).toContain('tableHeader')

    const ed2 = setup()
    fireEvent.mouseDown(ed2.container.querySelector('[data-tool="details"]')!)
    expect(JSON.stringify(ed2.editor.getJSON())).toContain('detailsSummary')

    const ed3 = setup()
    fireEvent.mouseDown(ed3.container.querySelector('[data-tool="codeBlock"]')!)
    expect(JSON.stringify(ed3.editor.getJSON())).toContain('codeBlock')
  })

  it('멘션 버튼은 트리거 문자를 넣어 suggestion 을 연다', () => {
    const { editor, container } = setup({ mention: true })
    editor.commands.focus('end')
    fireEvent.mouseDown(container.querySelector('[data-tool="mention"]')!)
    expect(editor.getText()).toContain('[[')
  })

  it('H2·H1·H3 위계', () => {
    const { editor, container } = setup()
    fireEvent.mouseDown(container.querySelector('[data-tool="h2"]')!)
    expect(editor.isActive('heading', { level: 2 })).toBe(true)
    fireEvent.mouseDown(container.querySelector('[data-tool="h1"]')!)
    expect(editor.isActive('heading', { level: 1 })).toBe(true)
    fireEvent.mouseDown(container.querySelector('[data-tool="h3"]')!)
    expect(editor.isActive('heading', { level: 3 })).toBe(true)
  })
})

describe('툴바 — 표 조작 UI', () => {
  it('표 밖에서는 행/열 버튼이 없다', () => {
    const { container } = setup()
    expect(container.querySelectorAll('[data-table-action]')).toHaveLength(0)
  })

  it('표 안이면 행/열 추가·삭제가 나온다', () => {
    const { editor, container } = setup()
    fireEvent.mouseDown(container.querySelector('[data-tool="table"]')!)
    const actions = Array.from(container.querySelectorAll('[data-table-action]')).map((el) =>
      el.getAttribute('data-table-action'),
    )
    expect(actions).toEqual([
      'addRowAfter',
      'deleteRow',
      'addColumnAfter',
      'deleteColumn',
      'deleteTable',
    ])

    fireEvent.mouseDown(container.querySelector('[data-table-action="addRowAfter"]')!)
    expect(editor.getJSON().content?.[0]?.content).toHaveLength(4)
  })
})

describe('툴바 — 접근성 · 툴팁', () => {
  it('모든 버튼에 aria-label 이 있다', () => {
    const { container } = setup({ mention: true, onExport: vi.fn() })
    const buttons = Array.from(container.querySelectorAll('[data-tool]'))
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect(b.getAttribute('aria-label')).toBeTruthy()
  })

  /**
   * 🔴 마우스 selection 을 지키려고 `mousedown` 에서 실행하는데, 키보드 Enter·Space 는
   * mousedown 을 내지 않는다 — `click` 도 받지 않으면 툴바 전체가 키보드로 못 쓰는 버튼이 된다.
   */
  it('🔴 키보드(Enter·Space)로도 눌린다', () => {
    const { editor, container } = setup()
    editor.commands.selectAll()
    // detail: 0 = 키보드로 발생한 click
    fireEvent.click(container.querySelector('[data-tool="bold"]')!, { detail: 0 })
    expect(editor.isActive('bold')).toBe(true)
  })

  it('마우스 클릭이 mousedown + click 으로 두 번 실행되지 않는다', () => {
    const { editor, container } = setup()
    const btn = container.querySelector('[data-tool="hl-yellow"]')!
    editor.commands.selectAll()
    fireEvent.mouseDown(btn)
    fireEvent.click(btn, { detail: 1 }) // 실제 마우스 클릭은 detail >= 1
    expect(editor.isActive('highlight', { color: 'yellow' })).toBe(true)
  })

  it('토글형 버튼은 aria-pressed 를 노출한다', () => {
    const { editor, container } = setup()
    editor.commands.selectAll()
    fireEvent.mouseDown(container.querySelector('[data-tool="bold"]')!)
    expect(container.querySelector('[data-tool="bold"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('hover 시 이름 + 한 줄 설명 툴팁 (데스크탑)', () => {
    const { container } = setup()
    fireEvent.mouseEnter(container.querySelector('[data-tool="details"]')!)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('토글')
    expect(tip).toHaveTextContent('답을 접어 self-test')
    // 모바일에선 숨긴다 (hover 가 없다)
    expect(tip.className).toContain('hidden')
    expect(tip.className).toContain('lg:block')
  })

  it('🔴 툴팁은 스크롤 컨테이너 밖에 있다 (안에 있으면 잘려서 안 보인다)', () => {
    const { container } = setup()
    fireEvent.mouseEnter(container.querySelector('[data-tool="bold"]')!)
    const tip = screen.getByRole('tooltip')
    expect(tip.closest('.overflow-x-auto')).toBeNull()
  })
})

describe('툴바 — 상단 고정은 opt-in (2026-08-19 준비 노트 실기)', () => {
  it('기본은 비고정 — 섹션 안 에디터(준비·활동 노트)는 툴바가 제자리에 남는다', () => {
    const { container } = setup()
    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toContain('sticky')
    // 툴팁 absolute 앵커는 여전히 필요하다 — 비고정이면 relative 가 그 역할
    expect(root.className).toContain('relative')
  })

  it("sticky='page' — 상단 고정 + 페이지 배경 비침 방지 (풀페이지 공부 노트)", () => {
    const editor = makeEditor()
    const { container } = render(<EditorToolbar editor={editor} sticky="page" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('sticky')
    expect(root.className).toContain('top-12')
    expect(root.className).toContain('bg-bg/95')
  })

  it("sticky='card' — 카드 안에선 카드색 불투명 배경 (bg/95 면 카드 속 이색 띠)", () => {
    const editor = makeEditor()
    const { container } = render(<EditorToolbar editor={editor} sticky="card" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('sticky')
    expect(root.className).toContain('top-12')
    expect(root.className).toContain('bg-card-solid')
    // card-solid 는 rgba 통값 토큰 — 알파(/95) 붙이면 클래스 자체가 no-op 으로 사라진다
    expect(root.className).not.toContain('bg-card-solid/')
    expect(root.className).not.toContain('backdrop-blur')
  })
})
