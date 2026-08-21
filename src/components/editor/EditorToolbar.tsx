import { useEffect, useReducer, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useMenuKeyboard } from '@/hooks/useMenuKeyboard'
import {
  HIGHLIGHT_COLORS,
  DEFAULT_TABLE,
  TABLE_ACTIONS,
  type HighlightColor,
} from './editorExtensions'

/**
 * study-notes Phase 2a — 공용 툴바.
 *
 * ## 배치 = 사용 빈도순 (plan UX 검토 ⑥)
 *
 * 모바일에서 툴바는 한 화면에 다 안 들어간다. 그래서 **먼저 보이는 자리**를 실제로 자주
 * 쓰는 것에 준다: 굵게·큰 제목·목록·체크·토글·형광펜·멘션. 기울임·밑줄·표·코드처럼
 * 가끔 쓰는 것은 스크롤 뒤로 민다. 순서 자체가 스펙이라 spec 이 배열 순서를 고정한다.
 *
 * ## 🔴 가로 스크롤이 세로 스크롤을 부른다
 *
 * `overflow-x-auto` 는 CSS 규칙상 `overflow-y: visible` 을 **강제로 auto** 로 바꾼다.
 * 버튼의 focus ring 이 1~2px 삐져나오면 툴바가 세로로도 "약간" 스크롤된다
 * (JobSiteChips 에서 실제로 났던 사고). 스크롤 컨테이너의 `py-1.5 -my-1.5` 가 그걸 품는다.
 */

interface Props {
  editor: Editor
  /** 지정 시 멘션 버튼 노출 — 확장이 켜져 있을 때만 의미가 있다 */
  hasMention?: boolean
  /** 지정 시 「내보내기」 버튼 노출 (md 내보내기는 공부 노트 전용 — plan §2) */
  onExportMarkdown?: () => void
  /**
   * 지정 시 「내보내기」가 **형식 선택 메뉴**가 된다 (마크다운 / PDF).
   *
   * 미지정이면 버튼은 예전 그대로 — 누르면 곧장 마크다운이다. 형식이 하나뿐인데 메뉴를
   * 열면 **선택 없는 한 번 더 누르기**라서, 항목이 1개로 줄어드는 경우(앱 웹뷰·PDF 를
   * 안 주는 소비처)는 메뉴 자체를 만들지 않는다.
   */
  onExportPdf?: () => void
  /**
   * 지정 시 📷 버튼 노출 — 파일 선택창을 여는 손잡이. 업로드 자체는 소비 측이 한다.
   * 붙여넣기·드롭이 같은 일을 하지만 **눌러서 넣는 길**이 없으면 기능이 있는 줄 모른다.
   */
  onInsertImage?: () => void
  /**
   * 지정 시 1군 **맨 앞**에 AI 버튼 노출 — 노트 AI 패널을 여는 손잡이.
   *
   * 모바일에는 드래그 팝오버(BubbleMenu)를 두지 않으므로 **이 버튼이 유일한 진입점**이다.
   * 미지정이면 버튼 자체가 없다 (AI 비활성·읽기 모드·AI 미지원 소비처).
   */
  onAiOpen?: () => void
  /**
   * 상단 고정 — 긴 문서를 내려가며 쓸 때 툴바가 따라온다. 배경이 문맥마다 달라 변형이 둘:
   *   'page' = 페이지 바닥(bg) 위 풀페이지 문서 (공부 노트)
   *   'card' = card-solid 카드 안 에디터 (준비 노트 — bg/95 를 쓰면 카드 속 이색 띠가 된다.
   *            card-solid 는 통값 토큰이라 알파 부착이 no-op — 불투명 그대로 쓴다)
   * 🔴 조상에 overflow-visible 아닌 요소가 있으면 sticky 는 조용히 죽는다 — 카드 래퍼는
   * overflow-clip(스크롤 컨테이너를 안 만든다) 로. hidden 이 원인이던 실사고: 2026-08-19.
   * 미지정 = 비고정 (활동 노트 등 기존 배치 유지).
   */
  sticky?: 'page' | 'card'
  /**
   * AI 버튼을 모바일(<lg)에서만 노출. 공부 노트는 데스크탑 진입이 목차 레일 버튼 + 드래그
   * 버블이라 툴바 ✦ 가 중복이다 (2026-08-19 CEO 실기 — "툴바에서 빼서 목차 공간에").
   * 레일이 없는 스텝 페이지는 미지정 = 전 폭 노출.
   */
  aiEntryMobileOnly?: boolean
}

/** 드롭다운 항목 — 지금은 「내보내기」의 형식 선택만 쓴다 */
interface MenuItem {
  key: string
  label: string
  /** 항목 아래 한 줄 — 툴팁 desc 와 같은 자리·같은 값(무엇이 열화되는지)을 여기로 옮겼다 */
  desc: string
  action: () => void
}

interface ToolBtn {
  key: string
  /** 툴팁 제목 */
  title: string
  /** 툴팁 한 줄 설명 */
  desc?: string
  render: () => React.ReactNode
  /** 누르면 곧장 실행. `menu` 가 있으면 대신 메뉴가 열리므로 그때는 비어 있다 */
  action?: () => void
  /** 지정 시 버튼이 **메뉴 트리거**가 된다 — 실행은 항목이 한다 */
  menu?: MenuItem[]
  active?: () => boolean
  /** 추가 클래스 (반응형 노출 제어용 — AI 버튼의 lg:hidden) */
  className?: string
}

const ICON = 'mx-auto'

/**
 * 드롭다운 폭 = DocMenu 의 `w-48`(192px)과 같은 값.
 *
 * 클래스가 아니라 숫자로 두는 이유: 툴바의 마지막 버튼이라 좌표를 화면 안으로 **잘라내야**
 * 하는데, 그 계산에 폭이 필요하다. 두 곳에 192 와 w-48 을 나눠 적으면 갈라진다.
 */
const MENU_W = 192

/**
 * 트리거 버튼 아래에 놓을 x (툴바 기준).
 *
 * 버튼 중앙 정렬을 원칙으로 두되 좌우 8px 안쪽으로 가둔다 — 「내보내기」는 툴바의 **마지막**
 * 버튼이라 그냥 중앙에 두면 좁은 화면에서 오른쪽이 화면 밖으로 나간다.
 */
function menuLeftOf(el: HTMLElement, wrap: HTMLElement): number {
  const b = el.getBoundingClientRect()
  const w = wrap.getBoundingClientRect()
  const centered = b.left - w.left + b.width / 2 - MENU_W / 2
  return Math.max(8, Math.min(centered, w.width - MENU_W - 8))
}

function Icon({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg
      className={ICON}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

/** 형광펜 점 — 툴바에서 색을 바로 알아볼 수 있게 실제 색을 칠한다 */
function HighlightDot({ color }: { color: HighlightColor }) {
  return (
    <span
      data-hl-dot={color}
      className="w-3.5 h-3.5 rounded-full mx-auto block hl-dot"
      aria-hidden="true"
    />
  )
}

/** TABLE_ACTIONS 의 라벨과 1:1 — 체이닝 메서드를 키로 인덱싱하면 타입이 유니온으로 깨진다 */
const TABLE_HANDLERS: Record<(typeof TABLE_ACTIONS)[number]['key'], (e: Editor) => void> = {
  addRowAfter: (e) => e.chain().focus().addRowAfter().run(),
  deleteRow: (e) => e.chain().focus().deleteRow().run(),
  addColumnAfter: (e) => e.chain().focus().addColumnAfter().run(),
  deleteColumn: (e) => e.chain().focus().deleteColumn().run(),
  deleteTable: (e) => e.chain().focus().deleteTable().run(),
}

function promptLink(editor: Editor) {
  // window.prompt 가 ProseMirror selection 을 잃게 하므로 미리 캐싱 후 복원 (활동 노트 관례)
  const prevHref = (editor.getAttributes('link').href as string) ?? ''
  const { from, to, empty } = editor.state.selection
  const url = window.prompt('링크 URL 을 입력해주세요:', prevHref || 'https://')
  if (url === null) return
  if (url.trim() === '' || url.trim() === 'https://') {
    editor.chain().focus().setTextSelection({ from, to }).extendMarkRange('link').unsetLink().run()
    return
  }
  const normalized = /^(https?:\/\/|mailto:|tel:|#)/i.test(url) ? url : `https://${url}`
  if (empty) {
    editor
      .chain()
      .focus()
      .setTextSelection(from)
      .insertContent([
        { type: 'text', text: normalized, marks: [{ type: 'link', attrs: { href: normalized } }] },
      ])
      .run()
  } else {
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .extendMarkRange('link')
      .setLink({ href: normalized })
      .run()
  }
}

export function EditorToolbar({
  editor,
  hasMention,
  onExportMarkdown,
  onExportPdf,
  onInsertImage,
  sticky,
  onAiOpen,
  aiEntryMobileOnly,
}: Props) {
  const [tip, setTip] = useState<{ key: string; left: number } | null>(null)
  const [menu, setMenu] = useState<{ key: string; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const menuBoxRef = useRef<HTMLDivElement | null>(null)
  const menuTriggerRef = useRef<HTMLElement | null>(null)

  /**
   * 바깥 클릭으로 닫기 — DocMenu(StudyNoteDocPage)와 같은 구현.
   *
   * 🔴 판정 기준은 **툴바 전체**(wrapRef)지 메뉴 상자가 아니다. 트리거가 `mousedown` 에서
   * 열기 때문에, 메뉴 상자만 기준으로 잡으면 **여는 그 클릭이 곧바로 바깥 클릭으로 잡혀**
   * 열자마자 닫힌다 (React 가 이 리스너를 등록한 뒤에도 같은 mousedown 이 document 까지
   * 계속 올라온다 — jsdom 에서는 안 나고 실브라우저에서만 났다: 2026-08-21).
   * 툴바 안 다른 버튼을 눌렀을 때 닫는 일은 `press` 가 따로 한다.
   *
   * ESC 와 화살표 이동은 `useMenuKeyboard` 가 진다 (세 메뉴 공용 — 주인은 한 곳뿐이다).
   */
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as globalThis.Node)) setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
    }
  }, [menu])

  const { markOpenedByKeyboard } = useMenuKeyboard({
    open: menu !== null,
    menuRef: menuBoxRef,
    triggerRef: menuTriggerRef,
    onClose: () => setMenu(null),
  })

  /**
   * 🔴 `transaction` 을 직접 구독한다 — 부모의 `onUpdate` 재렌더만 믿으면 **커서만 움직인
   * 경우**를 놓친다(문서가 안 바뀌면 onUpdate 가 안 온다). 그러면 굵게 글자로 커서를 옮겨도
   * B 가 안 켜지고, 표 안으로 들어가도 행/열 조작 줄이 안 나온다.
   */
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])

  const has = (name: string) => Boolean(editor.schema.nodes[name] ?? editor.schema.marks[name])

  // ── 1군: 모바일 첫 화면 (사용 빈도 높은 순) ──
  const primary: ToolBtn[] = [
    // 맨 앞자리 — 선택한 부분을 다듬는 동선이 서식보다 먼저 손에 닿아야 한다
    ...(onAiOpen
      ? [
          {
            key: 'ai',
            title: 'AI 도움',
            desc: '선택한 부분을 다듬거나 새로 만들어요',
            render: () => <span className="text-brand">✦</span>,
            action: onAiOpen,
            className: aiEntryMobileOnly ? 'lg:hidden' : undefined,
          },
        ]
      : []),
    {
      key: 'bold',
      title: '굵게',
      desc: '중요한 단어 강조',
      render: () => <span className="font-bold">B</span>,
      action: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive('bold'),
    },
    {
      key: 'h2',
      title: '큰 제목',
      desc: '섹션을 나누는 제목',
      render: () => <span className="text-[11px] font-bold">H2</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive('heading', { level: 2 }),
    },
    {
      key: 'bulletList',
      title: '글머리 목록',
      desc: '순서 없는 항목 나열',
      render: () => <Icon d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: () => editor.isActive('bulletList'),
    },
    ...(has('taskList')
      ? [
          {
            key: 'taskList',
            title: '체크리스트',
            desc: '복습 진도를 체크하며 보기',
            render: () => <Icon d="M3 6.5 4.5 8 7.5 5M11 6.5h10M11 17.5h10M3 17.5 4.5 19l3-3" />,
            action: () => editor.chain().focus().toggleTaskList().run(),
            active: () => editor.isActive('taskList'),
          },
        ]
      : []),
    ...(has('details')
      ? [
          {
            key: 'details',
            title: '토글',
            desc: '답을 접어 self-test',
            render: () => <Icon d="m9 6 6 6-6 6" />,
            action: () => editor.chain().focus().setDetails().run(),
            active: () => editor.isActive('details'),
          },
        ]
      : []),
    // 필기 사진·도식 캡처가 공부 노트의 주 재료라 1군에 둔다 (스크롤 뒤로 밀면 안 쓰인다)
    ...(onInsertImage
      ? [
          {
            key: 'image',
            title: '이미지',
            desc: '붙여넣기·끌어다 놓기로도 들어가요',
            render: () => <Icon d="M3 5h18v14H3zM3 16l4.5-4.5 4 4 3.5-3.5L21 16M8.5 9.5h.01" />,
            action: onInsertImage,
          },
        ]
      : []),
  ]

  const highlights: ToolBtn[] = HIGHLIGHT_COLORS.map((c) => ({
    key: `hl-${c.value}`,
    title: c.label,
    desc: '같은 색을 다시 누르면 해제돼요',
    render: () => <HighlightDot color={c.value} />,
    // 같은 색 재클릭 = 해제 · 다른 색 = 교체(중첩 없음) — Tiptap mark 기본 동작
    action: () => editor.chain().focus().toggleHighlight({ color: c.value }).run(),
    active: () => editor.isActive('highlight', { color: c.value }),
  }))

  const eraser: ToolBtn = {
    key: 'hl-clear',
    title: '형광펜 지우개',
    desc: '선택 영역의 형광펜 제거',
    render: () => <span className="text-[11px]">⌫</span>,
    action: () => editor.chain().focus().unsetHighlight().run(),
  }

  const mention: ToolBtn[] = hasMention
    ? [
        {
          key: 'mention',
          title: '노트 멘션',
          desc: '본문에서 [[ 또는 @ 로도 열려요',
          render: () => <span className="text-[11px] font-mono">[[·]]</span>,
          // 버튼은 트리거 문자를 넣어 suggestion 을 여는 것과 같은 상태를 만든다 (모바일 배려)
          action: () => editor.chain().focus().insertContent('[[').run(),
        },
      ]
    : []

  /**
   * 「내보내기」 형식 — **둘 다 있을 때만** 메뉴가 된다.
   *
   * 앱(WebView)에서는 소비 측이 `onExportPdf` 를 안 넘긴다(WKWebView 는 `window.print()` 가
   * 무동작 — DocMenu 의 `onPrint` 와 같은 근거·같은 조건). 그러면 남는 형식이 마크다운
   * 하나뿐이라 메뉴 없이 예전처럼 곧장 실행한다. PDF 를 아예 안 쓰는 소비처(준비·활동·
   * 회사 메모 노트)도 같은 이유로 무변경이다.
   */
  const exportMenu: MenuItem[] | undefined =
    onExportMarkdown && onExportPdf
      ? [
          {
            key: 'md',
            label: '마크다운(.md)',
            desc: '토글·형광펜은 열화돼요',
            action: onExportMarkdown,
          },
          { key: 'pdf', label: 'PDF로 저장', desc: '인쇄 창에서 저장해요', action: onExportPdf },
        ]
      : undefined

  // ── 2군: 스크롤 뒤 ──
  const secondary: ToolBtn[] = [
    {
      key: 'italic',
      title: '기울임',
      desc: '미묘한 강조·인용',
      render: () => <span className="italic">I</span>,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive('italic'),
    },
    {
      key: 'underline',
      title: '밑줄',
      render: () => <span className="underline">U</span>,
      action: () => editor.chain().focus().toggleUnderline().run(),
      active: () => editor.isActive('underline'),
    },
    {
      key: 'strike',
      title: '취소선',
      desc: '번복·완료 표시',
      render: () => <span className="line-through">S</span>,
      action: () => editor.chain().focus().toggleStrike().run(),
      active: () => editor.isActive('strike'),
    },
    {
      key: 'h1',
      title: '가장 큰 제목',
      render: () => <span className="text-[11px] font-bold">H1</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: () => editor.isActive('heading', { level: 1 }),
    },
    {
      // 회사 메모의 시작 칩이 넣는 소제목 — 없애면 기존 문서 서식을 손으로 못 만든다
      key: 'h3',
      title: '소제목',
      render: () => <span className="text-[11px] font-bold">H3</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => editor.isActive('heading', { level: 3 }),
    },
    ...(has('codeBlock')
      ? [
          {
            key: 'codeBlock',
            title: '코드 블록',
            desc: '언어 문법 하이라이팅',
            render: () => <Icon d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
            action: () => editor.chain().focus().toggleCodeBlock().run(),
            active: () => editor.isActive('codeBlock'),
          },
        ]
      : []),
    ...(has('table')
      ? [
          {
            key: 'table',
            title: '표',
            desc: '3×3 표를 넣어요',
            render: () => <Icon d="M3 3h18v18H3zM3 9h18M3 15h18M12 3v18" />,
            action: () => editor.chain().focus().insertTable(DEFAULT_TABLE).run(),
            active: () => editor.isActive('table'),
          },
        ]
      : []),
    {
      key: 'link',
      title: '링크',
      desc: 'URL·자료 연결',
      render: () => (
        <Icon d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
      ),
      action: () => promptLink(editor),
      active: () => editor.isActive('link'),
    },
    {
      key: 'hr',
      title: '가로선',
      render: () => <span>—</span>,
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
    ...(onExportMarkdown
      ? [
          {
            key: 'export',
            // 형식이 둘이면 「내보내기」(고르는 손잡이), 하나면 예전 이름 그대로다
            title: exportMenu ? '내보내기' : '마크다운 내보내기',
            // 🔴 「토글·형광펜은 열화돼요」는 **마크다운 전용** 경고라, 형식을 고르게 된
            //    순간부터 버튼이 아니라 md 항목에 붙는다 (아래 exportMenu)
            desc: exportMenu ? '마크다운·PDF 중에 골라요' : '토글·형광펜은 열화돼요',
            render: () => <Icon d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
            action: exportMenu ? undefined : onExportMarkdown,
            menu: exportMenu,
          },
        ]
      : []),
  ]

  const groups: ToolBtn[][] = [primary, [...highlights, eraser], mention, secondary].filter(
    (g) => g.length > 0,
  )

  function showTip(key: string, el: HTMLElement) {
    const wrap = wrapRef.current
    if (!wrap) return
    const b = el.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    setTip({ key, left: b.left - w.left + b.width / 2 })
  }

  function toggleMenu(key: string, el: HTMLElement) {
    const wrap = wrapRef.current
    if (menu?.key === key || !wrap) {
      setMenu(null)
      return
    }
    setMenu({ key, left: menuLeftOf(el, wrap) })
  }

  /**
   * 툴바를 밀면 메뉴도 따라간다.
   *
   * 🔴 **닫지 않는다** — 「내보내기」는 툴바 맨 끝이라 모바일에서는 먼저 밀어야 닿는데,
   * 관성 스크롤이 탭 직후까지 이어져 `scroll` 이 늦게 도착한다. 닫는 구현은 열자마자
   * 닫히는 버튼이 된다 (2026-08-21 Playwright 에서 실제로 재현됐다).
   */
  function reanchorMenu() {
    const wrap = wrapRef.current
    if (!menu || !wrap) return
    const el = wrap.querySelector<HTMLElement>(`[data-tool="${menu.key}"]`)
    if (!el) return
    const left = menuLeftOf(el, wrap)
    if (left !== menu.left) setMenu({ key: menu.key, left })
  }

  /**
   * 버튼 하나 누름 — 메뉴 트리거는 열고, 나머지는 열려 있던 메뉴를 닫고 실행한다.
   *
   * `viaKeyboard` 는 첫 항목 자동 포커스 여부를 가른다 (`useMenuKeyboard` 주석 참고).
   */
  function press(t: ToolBtn, el: HTMLElement, viaKeyboard: boolean) {
    if (t.menu) {
      markOpenedByKeyboard(viaKeyboard)
      toggleMenu(t.key, el)
      return
    }
    setMenu(null)
    t.action?.()
  }

  const tipBtn = tip ? groups.flat().find((t) => t.key === tip.key) : null
  const menuBtn = menu ? groups.flat().find((t) => t.key === menu.key) : null

  return (
    /*
      🔴 sticky top-12 — 긴 문서 하단에서도 서식 도구가 손닿는 곳에 (2026-08-18 실기 · mockup 스펙).
      12(48px) = 앱 상단 고정 헤더 높이 (데스크탑 코인 칩 z-30 · 모바일 MobileHeader z-40 — 둘 다 h-12).
      z-20 으로 그 아래에 서고, 반투명+블러라 본문이 밑으로 지나가는 게 보인다.
      sticky 도 positioned 라 툴팁의 absolute 앵커는 그대로 동작한다 (relative 불필요).
    */
    <div
      ref={wrapRef}
      /* sticky 도 positioned 라 툴팁 absolute 앵커 유지 — 비고정일 땐 relative 가 그 역할 */
      /* print:hidden — 종이에 서식 도구가 찍힐 이유가 없다 (공부 노트 PDF 저장) */
      className={`${
        sticky === 'page'
          ? 'sticky top-12 z-20 bg-bg/95 backdrop-blur-sm'
          : sticky === 'card'
            ? 'sticky top-12 z-20 bg-card-solid'
            : 'relative'
      } border-b border-line py-1.5 print:hidden`}
    >
      {/* 🔴 py-1.5 -my-1.5 = 세로 스크롤 방지 (JobSiteChips 회귀 패턴).
          바깥 래퍼가 실제 여백을 주고, 스크롤 컨테이너 안쪽 6px 은 focus ring 을 품는 슬랙이다 */}
      <div className="overflow-x-auto px-2 py-1.5 -my-1.5" onScroll={reanchorMenu}>
        <div className="flex items-center gap-0.5 w-max">
          {groups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <span className="w-px h-4 bg-line-strong mx-1.5 shrink-0" aria-hidden="true" />}
              {group.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-tool={t.key}
                  /* 메뉴 트리거만 기억한다 — 메뉴가 닫힐 때 포커스가 돌아올 자리 */
                  ref={
                    t.menu
                      ? (el) => {
                          menuTriggerRef.current = el
                        }
                      : undefined
                  }
                  aria-label={t.title}
                  aria-pressed={t.active ? t.active() : undefined}
                  aria-haspopup={t.menu ? 'menu' : undefined}
                  aria-expanded={t.menu ? menu?.key === t.key : undefined}
                  // mousedown 의 기본 동작(포커스 이동)을 막아야 ProseMirror selection 이 살아
                  // 있고, 그래야 선택 영역 기반 명령(형광펜·링크)이 동작한다
                  onMouseDown={(e) => {
                    e.preventDefault()
                    press(t, e.currentTarget, false)
                  }}
                  // 🔴 키보드(Enter·Space)는 mousedown 을 안 낸다 — 이것 없으면 툴바 전체가
                  //    키보드로 못 쓰는 버튼이 된다. detail===0 = 키보드로 발생한 click
                  onClick={(e) => {
                    if (e.detail === 0) press(t, e.currentTarget, true)
                  }}
                  onMouseEnter={(e) => showTip(t.key, e.currentTarget)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => showTip(t.key, e.currentTarget)}
                  onBlur={() => setTip(null)}
                  className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors shrink-0 flex items-center justify-center ${
                    t.active?.()
                      ? 'bg-brand/12 text-brand'
                      : 'text-text-quaternary hover:bg-card active:bg-card-strong hover:text-text-secondary'
                  } ${t.className ?? ''}`}
                >
                  {t.render()}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/*
        「내보내기」 형식 선택 — 🔴 **스크롤 행 밖**이라 잘리지 않는다 (툴팁과 같은 기법:
        wrapRef 직계 자식 + 계산된 left 로 앵커). 안에 두면 overflow-x-auto 가 세로도 auto 로
        만들어 통째로 잘린다(파일 상단 주석).

        툴팁과 달리 `hidden lg:block`·`pointer-events-none` 은 **쓰지 않는다** — 모바일에서도
        보이고 눌려야 하는 진짜 손잡이다.

        생김새는 문서 메뉴(StudyNoteDocPage 의 DocMenu)와 같은 값으로 맞췄다. 트리거와
        앵커 방식이 서로 달라(⋯ 버튼 + relative 부모 ↔ 스크롤 행 안 버튼 + 좌표 계산)
        공용 컴포넌트로 뽑아도 남는 공유분이 클래스 두 줄뿐이라, 여기서는 값만 맞추고
        서로를 주석으로 가리킨다. 한쪽을 고치면 다른 쪽도 같이 고칠 것.
      */}
      {menuBtn?.menu && menu && (
        <div
          ref={menuBoxRef}
          role="menu"
          aria-label={menuBtn.title}
          data-testid="export-menu"
          style={{ left: menu.left, width: MENU_W }}
          className="absolute top-full z-30 mt-1 rounded-lg bg-surface-2 border border-line-strong shadow-xl py-1 text-[13px]"
        >
          {menuBtn.menu.map((m) => (
            <button
              key={m.key}
              type="button"
              role="menuitem"
              /* desc 까지 읽히면 이름이 길어진다 — 접근성 이름은 라벨로 고정 */
              aria-label={m.label}
              onClick={() => {
                setMenu(null)
                m.action()
              }}
              className="w-full px-3 py-2 text-left text-text-secondary hover:bg-card-hover transition-colors"
            >
              {m.label}
              <span className="block text-[10px] text-text-quaternary mt-0.5">{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* 표 안일 때만 나오는 행·열 조작 — 항상 띄우면 툴바가 두 배가 된다 */}
      {editor.isActive('table') && (
        <div className="overflow-x-auto px-2 pt-1.5 pb-1.5 -mb-1.5">
          <div className="flex items-center gap-1 w-max">
            {TABLE_ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                data-table-action={a.key}
                onMouseDown={(e) => {
                  e.preventDefault()
                  TABLE_HANDLERS[a.key](editor)
                }}
                onClick={(e) => {
                  if (e.detail === 0) TABLE_HANDLERS[a.key](editor)
                }}
                className="h-6 px-2 rounded text-[10px] text-text-quaternary hover:bg-card hover:text-text-secondary transition-colors shrink-0"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 데스크탑 hover 툴팁 — 스크롤 컨테이너 바깥이라 잘리지 않는다.
          메뉴가 열려 있으면 접는다 — 둘 다 `top-full` 이라 같은 자리에서 겹친다 */}
      {tipBtn && tip && !menu && (
        <div
          role="tooltip"
          style={{ left: tip.left }}
          className="hidden lg:block absolute top-full z-30 -translate-x-1/2 mt-1 px-2.5 py-1.5 rounded-lg bg-surface-3 border border-line-strong shadow-md whitespace-nowrap pointer-events-none"
        >
          <div className="text-[11px] font-medium text-text-primary">{tipBtn.title}</div>
          {tipBtn.desc && (
            <div className="text-[10px] text-text-quaternary mt-0.5">{tipBtn.desc}</div>
          )}
        </div>
      )}
    </div>
  )
}
