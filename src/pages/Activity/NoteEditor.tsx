import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'

// 💡 콜아웃 — mock 6311 의 .callout 블록 (이모지 + 본문)
// content: paragraph 1개 이상. HTML 출력: <div class="callout">...</div>
// 단순화: 이모지 변경 기능은 V1 에서 생략 (기본 💡), 향후 클릭으로 변경 가능하게 확장 여지
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.callout' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'callout' }),
      ['span', { class: 'cl-emoji', contenteditable: 'false' }, '💡'],
      ['div', { class: 'cl-body' }, 0],
    ]
  },
  addCommands() {
    return {
      toggleCallout:
        () =>
        ({ commands, state }) => {
          const { $from } = state.selection
          // 이미 callout 안이면 일반 단락으로 lift
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'callout') {
              return commands.lift('callout')
            }
          }
          // 아니면 현재 블록을 callout 으로 wrap
          return commands.wrapIn('callout')
        },
    }
  },
})

// 명령 타입 보강 — Tiptap Command 시그니처
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: () => ReturnType
    }
  }
}

// Notion 풍 toolbar tooltip — 명령 + 설명 + 단축키 + 마크다운 단축어 (mock 6589-6623 1:1)
type TtKey =
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'ul'
  | 'ol'
  | 'todo'
  | 'callout'
  | 'quote'
  | 'link'
  | 'hr'
  | 'paragraph'

interface TtEntry {
  title: string
  desc?: string
  keys: Array<{ lbl: string; kbd: string }>
}

const TT_DATA: Record<TtKey, TtEntry> = {
  h2: {
    title: '큰 제목',
    desc: '섹션 구분에 사용. 본문보다 강조',
    keys: [{ lbl: '단축어', kbd: '## ⎵' }],
  },
  h3: {
    title: '소제목',
    desc: '큰 제목 안의 세부 항목',
    keys: [{ lbl: '단축어', kbd: '### ⎵' }],
  },
  bold: {
    title: '굵게',
    desc: '중요한 단어 강조',
    keys: [{ lbl: '단축키', kbd: '⌘/Ctrl B' }],
  },
  italic: {
    title: '기울임',
    desc: '미묘한 강조·인용·외국어',
    keys: [{ lbl: '단축키', kbd: '⌘/Ctrl I' }],
  },
  strikethrough: {
    title: '취소선',
    desc: '작업 완료 · 번복 표시',
    keys: [{ lbl: '단축어', kbd: '~~text~~' }],
  },
  code: {
    title: '인라인 코드',
    desc: '변수 · 명령어 · KPI 명',
    keys: [{ lbl: '단축어', kbd: '`text`' }],
  },
  ul: {
    title: '글머리 리스트',
    desc: '순서 없는 항목 나열',
    keys: [{ lbl: '단축어', kbd: '- ⎵' }],
  },
  ol: {
    title: '번호 리스트',
    desc: '순서·단계가 있는 항목',
    keys: [{ lbl: '단축어', kbd: '1. ⎵' }],
  },
  todo: {
    title: '할 일 (체크리스트)',
    desc: '체크 가능한 항목 · "다음에 할 일" 정리',
    keys: [{ lbl: '단축어', kbd: '- [ ] ⎵' }],
  },
  callout: {
    title: '콜아웃 박스',
    desc: '💡 학습 · ⚠️ 주의 · ✨ 핵심 — 강조 박스',
    keys: [],
  },
  quote: {
    title: '인용 블록',
    desc: '다른 사람 말·중요한 발췌',
    keys: [{ lbl: '단축어', kbd: '> ⎵' }],
  },
  link: {
    title: '링크',
    desc: 'URL · 결과물 · 자료 첨부',
    keys: [],
  },
  hr: {
    title: '구분선',
    desc: '섹션 사이 시각적 구분',
    keys: [{ lbl: '단축어', kbd: '- - -' }],
  },
  paragraph: {
    title: '일반 문단',
    desc: '제목·리스트·인용을 평범한 텍스트로 되돌림',
    keys: [],
  },
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  initialContent: Record<string, unknown> | null
  /** content 변경 시 호출 — 부모가 PATCH 처리 */
  onSave: (note: Record<string, unknown>) => Promise<void>
  /** plain text length 변화 알림 (AI 요약 활성 조건 등) */
  onTextChange?: (plainText: string) => void
  /** 저장 상태 변화 알림 — 부모가 합쳐서 표시 */
  onSaveStateChange?: (state: SaveState) => void
  /** 툴바 우측 끝 slot — 데스크탑에서 저장 인디케이터 등 노출 */
  toolbarRight?: React.ReactNode
  /** 툴바 바로 아래에 들어갈 slot (title 등) — toolbar 와 함께 sticky 로 따라옴 */
  titleSlot?: React.ReactNode
}

/** 부모가 ref 로 호출 — pending debounce 즉시 flush. 닫기/모드 전환 직전 호출 */
export interface NoteEditorHandle {
  flush: () => Promise<void>
  setEditable: (editable: boolean) => void
}

export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(
  { initialContent, onSave, onTextChange, onSaveStateChange, toolbarRight, titleSlot },
  ref,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null)
  const editorRefInner = useRef<Editor | null>(null)
  const reportState = (s: SaveState) => onSaveStateChange?.(s)

  const editor = useEditor(
    {
      // 확장은 공용 세트로 승격 (study-notes Phase 2a). 여기서 따로 들고 있던 StarterKit·
      // Link·TaskList 배선이 `Duplicate extension names found: ['link','underline']` 를
      // 찍고 있었다 — 같은 확장이 두 벌 등록돼 어느 설정이 이기는지가 순서에 달려 있었다.
      // Callout 은 활동 노트 전용이라 여기 남는다.
      extensions: [
        ...buildEditorExtensions({
          placeholder:
            '여기에 자세히 적기 — Notion·블로그처럼.\n\n상단 툴바 또는 마크다운 단축어 (## 헤딩, - 리스트, > 인용)',
        }),
        Callout,
      ],
      content: initialContent ?? null,
      editorProps: {
        attributes: {
          // np-content 만 — mock 의 .note-page .np-content { font/line-height/color/min-height/outline + h2/h3/blockquote/code/hr 등 } 모두 적용
          // Tailwind prose 제거 (mock CSS 와 specificity 충돌해서 typography 가 prose 로 덮어써짐)
          class: 'np-content',
        },
        handleKeyDown: (_view, event) => {
          // Cmd/Ctrl+K → 링크 prompt (mock 6435)
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            const ed = editorRefInner.current
            if (!ed) return true
            // selection 캐싱 — prompt 가 ProseMirror selection 을 lose 시킴
            const prevHref = (ed.getAttributes('link').href as string) ?? ''
            const { from, to, empty } = ed.state.selection
            const url = window.prompt(
              '링크 URL 을 입력해주세요:',
              prevHref || 'https://',
            )
            if (url === null) return true
            if (url.trim() === '' || url.trim() === 'https://') {
              ed.chain().focus().setTextSelection({ from, to }).extendMarkRange('link').unsetLink().run()
            } else {
              const normalized = /^(https?:\/\/|mailto:|tel:|#)/i.test(url)
                ? url
                : `https://${url}`
              if (empty) {
                ed.chain().focus().setTextSelection(from).insertContent([
                  {
                    type: 'text',
                    text: normalized,
                    marks: [{ type: 'link', attrs: { href: normalized } }],
                  },
                ]).run()
              } else {
                ed.chain().focus().setTextSelection({ from, to }).extendMarkRange('link').setLink({ href: normalized }).run()
              }
            }
            return true
          }
          return false
        },
      },
      onUpdate: ({ editor }) => {
        const text = editor.getText()
        onTextChange?.(text)
        const doSave = async () => {
          reportState('saving')
          try {
            await onSave(editor.getJSON() as Record<string, unknown>)
            reportState('saved')
            setTimeout(() => reportState('idle'), 2000)
          } catch {
            reportState('error')
          } finally {
            pendingSaveRef.current = null
          }
        }
        pendingSaveRef.current = doSave
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(doSave, 1500)
      },
    },
    [],
  )

  // 초기 텍스트 길이 보고 + handleKeyDown 이 참조할 editor instance 등록
  useEffect(() => {
    editorRefInner.current = editor ?? null
    if (editor) onTextChange?.(editor.getText())
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // 부모가 ref.flush()/setEditable() 호출
  useImperativeHandle(ref, () => ({
    async flush() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      const pending = pendingSaveRef.current
      if (pending) await pending()
    },
    setEditable(editable: boolean) {
      editor?.setEditable(editable)
    },
  }))

  if (!editor) return null

  return (
    <>
      {/* title 은 일반 흐름 — 스크롤 시 자연스럽게 위로 사라짐 (Notion·Google Docs·Bear 표준)
          위치 맥락은 np-head 의 breadcrumb 이 제공. title 까지 sticky 면 화면 차지 ↑ */}
      {titleSlot}
      <Toolbar editor={editor} rightSlot={toolbarRight} />
      <div className="np-editor-surface">
        <EditorContent editor={editor} />
      </div>
      <div className="np-tip">
        <strong>💡 단축어:</strong>{' '}
        <code>## </code> 헤딩 · <code>- </code> 리스트 ·{' '}
        <code>&gt; </code> 인용 · <code>---</code> 구분선 ·{' '}
        <strong>⌘/Ctrl + B</strong> 굵게 · <strong>⌘/Ctrl + I</strong> 기울임 ·{' '}
        <strong>⌘/Ctrl + K</strong> 링크
      </div>
    </>
  )
})

function Toolbar({
  editor,
  rightSlot,
}: {
  editor: Editor
  rightSlot?: React.ReactNode
}) {
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs) ? 'active' : ''
  const handleLink = () => {
    // window.prompt 가 ProseMirror selection 을 lose 시키므로 미리 캐싱 후 복원
    const prevHref = (editor.getAttributes('link').href as string) ?? ''
    const { from, to, empty } = editor.state.selection
    const url = window.prompt(
      '링크 URL 을 입력해주세요:',
      prevHref || 'https://',
    )
    if (url === null) return
    // 'https://' 만 입력 (default 그대로) 또는 빈값 → 기존 링크 해제
    if (url.trim() === '' || url.trim() === 'https://') {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .extendMarkRange('link')
        .unsetLink()
        .run()
      return
    }
    const normalized = /^(https?:\/\/|mailto:|tel:|#)/i.test(url)
      ? url
      : `https://${url}`
    if (empty) {
      // 선택 없으면 URL 텍스트 자체를 link 로 insert
      editor
        .chain()
        .focus()
        .setTextSelection(from)
        .insertContent([
          {
            type: 'text',
            text: normalized,
            marks: [{ type: 'link', attrs: { href: normalized } }],
          },
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

  // hover 중인 버튼 + 화면 좌표 (mock 6624-6672 1:1)
  // visible=false 일 때도 tooltip element 는 portal 에 영구 mount — class .show 만 토글
  // → mount/unmount 사이 invisible 깜빡임·rect 측정 race 제거
  const [tt, setTt] = useState<{ key: TtKey | null; anchor: DOMRect | null }>({
    key: null,
    anchor: null,
  })
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter(key: TtKey, el: HTMLButtonElement) {
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    const rect = el.getBoundingClientRect()
    showTimerRef.current = setTimeout(() => setTt({ key, anchor: rect }), 180)
  }
  function handleLeave() {
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    setTt({ key: null, anchor: null })
  }

  return (
    <div className="np-toolbar">
      <TbButton ttKey="h2" className={isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        H2
      </TbButton>
      <TbButton ttKey="h3" className={isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        H3
      </TbButton>
      <div className="divider" />
      <TbButton ttKey="bold" className={isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        <strong>B</strong>
      </TbButton>
      <TbButton ttKey="italic" className={isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        <em>I</em>
      </TbButton>
      <TbButton ttKey="strikethrough" className={isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        <s>S</s>
      </TbButton>
      <TbButton ttKey="code" className={`${isActive('code')} font-mono`.trim()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        {'<>'}
      </TbButton>
      <div className="divider" />
      <TbButton ttKey="ul" className={isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        •
      </TbButton>
      <TbButton ttKey="ol" className={isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        1.
      </TbButton>
      <TbButton ttKey="todo" className={isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        ☑
      </TbButton>
      <TbButton ttKey="quote" className={isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        &quot;
      </TbButton>
      <div className="divider" />
      <TbButton ttKey="callout" className={isActive('callout')}
        onClick={() => editor.chain().focus().toggleCallout().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        💡
      </TbButton>
      <TbButton ttKey="link" className={isActive('link')}
        onClick={handleLink}
        onEnter={handleEnter} onLeave={handleLeave}>
        🔗
      </TbButton>
      <TbButton ttKey="hr"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        —
      </TbButton>
      <TbButton ttKey="paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        onEnter={handleEnter} onLeave={handleLeave}>
        P
      </TbButton>
      {rightSlot && (
        <div className="np-toolbar-right" style={{ marginLeft: 'auto' }}>
          {rightSlot}
        </div>
      )}
      <ToolbarTooltip
        visible={!!tt.key}
        data={tt.key ? TT_DATA[tt.key] : null}
        anchor={tt.anchor}
      />
    </div>
  )
}

function TbButton({
  ttKey,
  className = '',
  style,
  onClick,
  onEnter,
  onLeave,
  children,
}: {
  ttKey: TtKey
  className?: string
  style?: React.CSSProperties
  onClick: () => void
  onEnter: (key: TtKey, el: HTMLButtonElement) => void
  onLeave: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      // ProseMirror selection 유지를 위해 mousedown 의 default(=focus 이동)를 차단
      // → editor focus 유지 → setLink·toggle 등 selection 기반 명령이 정상 동작
      onMouseDown={(e) => {
        e.preventDefault()
        onLeave() // 클릭 직후 tooltip 숨김 (mock 의 mousedown handler)
      }}
      onClick={onClick}
      onMouseEnter={(e) => onEnter(ttKey, e.currentTarget)}
      onMouseLeave={onLeave}
    >
      {children}
    </button>
  )
}

/**
 * mock 의 #nt-tooltip 1:1 동작.
 * - portal 로 body 에 항상 mount (unmount 없음)
 * - visible=false 일 때도 element 유지, className 에서 .show 만 제거 → CSS opacity 0 + transition
 * - useLayoutEffect 로 paint 전에 위치 계산 → 첫 frame 부터 정확한 자리
 * - data 가 변경되면 className 도 .show 없이 한 번 적용 후 다음 frame 에 .show — transition 자연 발동
 */
function ToolbarTooltip({
  visible,
  data,
  anchor,
}: {
  visible: boolean
  data: TtEntry | null
  anchor: DOMRect | null
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  // visible=false 일 때 마지막 data 를 잠시 유지 (fade-out 중 컨텐츠 깜빡임 방지)
  const [stickyData, setStickyData] = useState<TtEntry | null>(data)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync: data 변경 시 마지막 데이터 stash (fade-out 깜빡임 방지). 의도된 derived state mirror
    if (data) setStickyData(data)
  }, [data])

  useLayoutEffect(() => {
    if (!visible || !anchor || !ref.current) return
    const el = ref.current
    const tr = el.getBoundingClientRect()
    const pad = 8
    let left = anchor.left + anchor.width / 2 - tr.width / 2
    let top = anchor.bottom + 8
    if (left < pad) left = pad
    if (left + tr.width > window.innerWidth - pad)
      left = window.innerWidth - tr.width - pad
    if (top + tr.height > window.innerHeight - pad)
      top = anchor.top - tr.height - 8
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [visible, anchor, stickyData])

  const display = stickyData ?? data
  return createPortal(
    <div
      ref={ref}
      className={`nt-tooltip${visible ? ' show' : ''}`}
      role="tooltip"
      aria-hidden={!visible}
    >
      {display && (
        <>
          <div className="tt-title">{display.title}</div>
          {display.desc && <div className="tt-desc">{display.desc}</div>}
          {display.keys.length > 0 && (
            <div className="tt-keys">
              {display.keys.map((k, i) => (
                <div key={i} className="tt-key-row">
                  <span className="lbl">{k.lbl}</span>
                  <span className="kbd">{k.kbd}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
