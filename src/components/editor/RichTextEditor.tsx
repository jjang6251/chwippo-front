import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { EditorToolbar } from './EditorToolbar'
import {
  buildEditorExtensions,
  parseEditorContent,
  type EditorFeatures,
} from './editorExtensions'
import { editorToMarkdown, handleMarkdownPaste, looksLikeCodeEditorHtml } from './markdownIO'
import type { StudyNoteMentionOptions } from './StudyNoteMention'
import { docToMemoValue, memoCounterColor, type TiptapDoc } from '@/utils/memoSections'

/**
 * card-detail-remodel — 공용 리치 텍스트 에디터 (tiptap).
 *
 * 준비 노트(StepNoteEditor)와 회사 메모(CompanyMemoCard)가 공유. 셋업 중복 제거.
 * - 자동 저장: 준비 노트 관례인 1.5s debounce. 빈 문서면 '' 전송(껍데기 JSON 저장 방지).
 * - characterLimit: 지정 시 CharacterCount(하드 리밋) + 하단 카운터(90% warning·100% danger).
 * - template: 지정 시 "기본 포맷 적용" 버튼(빈 문서일 때). StepNoteEditor 의 스텝 템플릿.
 * - header: 지정 시 툴바 위에 렌더 (회사 메모의 라벨·보조문구·시작 칩). editor 변경 시 재렌더 → ✓ 라이브.
 * - iOS 16px: contenteditable 본문 모바일 16px(max-lg:text-base), 데스크탑 기존 크기.
 *
 * study-notes Phase 2a — 확장 세트(체크리스트·토글·코드·표·형광펜 5색·마크다운)는
 * `editorExtensions.ts` 로 모았다. `features` 로 끌 수 있지만 **기본은 전부 on** 이라
 * 준비·활동 노트가 자동으로 같이 받는다 (plan §2 "펜은 같고 노트북이 다르다").
 *
 * 컨테이너(card-solid 등)는 소비 측이 감싼다.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_STATE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
}

interface Props {
  /** tiptap JSON 문자열 · legacy plain(문자열) · null */
  initialContent: string | null
  /** 저장 콜백 — 빈 문서면 '', 아니면 tiptap JSON 문자열 */
  onSave: (value: string) => Promise<void> | void
  placeholder: string
  /** 본문 최소 높이 Tailwind 클래스 (예: 'min-h-[360px]') */
  minHeightClass: string
  /** 글자수 제한 (지정 시 CharacterCount + 카운터) */
  characterLimit?: number
  /** 빈 문서일 때 노출되는 "기본 포맷 적용" 템플릿 */
  template?: object | null
  /** 툴바 위 헤더 슬롯 (editor 접근) — 회사 메모 라벨·칩 */
  header?: (editor: Editor) => ReactNode
  /**
   * 편집할 때마다 **아직 저장되지 않은** 본문을 plain text 로 흘려보낸다.
   *
   * 준비 노트 → 면접 질문 다리가 쓴다. 저장은 1.5s debounce 라, 방금 적은 기출을
   * 바로 넘기려는 사람은 서버 값만 보면 **직전 상태**를 가져가게 된다.
   * 블록 구분은 `\n` — 붙여넣기 파서가 줄 단위로 쪼갠다 (기본 `\n\n` 이면 빈 줄이 낀다).
   */
  onTextChange?: (plainText: string) => void
  /** 확장 on/off — 미지정이면 전부 on */
  features?: EditorFeatures
  /**
   * 읽기 모드. 편집은 막되 **토글 열고닫기는 살아 있다** —
   * Details 의 토글 버튼은 `isEditable` 과 무관하게 시각 상태를 바꾼다(문서에 저장만 안 됨).
   * 접은 채로 답을 맞혀 보는 self-test 가 읽기 모드의 존재 이유라 이건 꺼지면 안 된다.
   */
  readOnly?: boolean
  /** 지정 시 `[[`·`@` 멘션 활성 — 데이터 소스는 주입받는다 */
  mention?: StudyNoteMentionOptions
  /** 지정 시 툴바에 「내보내기」 노출. 인자는 직렬화된 마크다운 (열화 명세: markdownIO.ts) */
  onExportMarkdown?: (markdown: string) => void
  /**
   * 툴바 상단 고정 변형 — 'page'(공부 노트 풀페이지) · 'card'(준비 노트 card-solid 카드 안).
   * 배경이 문맥을 따라가야 해서 변형이 둘이다 (EditorToolbar 주석). 미지정 = 비고정.
   */
  stickyToolbar?: 'page' | 'card'
  /** AI 버튼 모바일 한정 (데스크탑 진입이 따로 있는 페이지 — EditorToolbar 주석) */
  aiEntryMobileOnly?: boolean
  /**
   * 지정 시 툴바 맨 앞에 AI 버튼 — 노트 AI 패널을 여는 손잡이 (패널·버블은 소비 측이 조립).
   * 미지정이면 버튼이 없다 — 회사 메모 등 다른 소비처는 무변경으로 남는다.
   */
  onAiOpen?: () => void
}

/** 붙여넣기가 글자 제한에 걸렸을 때 뜨는 안내 — 조용히 사라지면 사용자는 소실을 모른다 */
const TRUNCATED_NOTICE =
  '글자수 제한 때문에 붙여넣은 내용이 다 들어가지 못했어요. 나눠서 붙여넣어 주세요.'

export function RichTextEditor({
  initialContent,
  onSave,
  placeholder,
  minHeightClass,
  characterLimit,
  template,
  header,
  onTextChange,
  features,
  readOnly,
  mention,
  onExportMarkdown,
  stickyToolbar,
  onAiOpen,
  aiEntryMobileOnly,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [truncated, setTruncated] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 카운터·헤더(칩 ✓) 라이브 갱신 보장 (transaction 마다 재렌더)
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  // 확장 목록은 한 번만 만든다 — 매 렌더 새로 만들면 스키마가 갈려 문서가 초기화된다
  const extensions = useMemo(
    () => buildEditorExtensions({ placeholder, characterLimit, features, mention }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 에디터 생성 시점 값으로 고정 (useEditor deps 와 동일 계약)
    [],
  )

  // 🔴 문자열을 그대로 넘기면 Markdown 확장이 **마크다운으로 읽는다** — 레거시 평문 노트가
  //    재조립되는 회귀. 미리 doc 으로 고정한다 (editorExtensions.parseEditorContent 주석)
  const initialDoc = useMemo(
    () => parseEditorContent(initialContent, extensions),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 생성 시점 값 고정 (useEditor deps 와 동일 계약)
    [],
  )

  // handlePaste 는 editor 가 만들어지기 전에 정의돼야 해서 ref 로 뒤늦게 잡는다
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    extensions,
    content: initialDoc,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: `chw-prose ${minHeightClass} focus:outline-none px-4 py-3 text-text-primary leading-relaxed`,
      },
      handlePaste: (_view, event) => {
        const current = editorRef.current
        const text = event.clipboardData?.getData('text/plain')
        if (!text || !current) return false
        // HTML 이 함께 왔으면 원칙적으로 tiptap 기본 경로가 서식을 더 잘 살린다(웹페이지·노션).
        // 🔴 예외 — 코드 에디터(VS Code 등) 복사물: HTML 이 "색칠된 평문"이라 양보하면
        //    마크다운이 문자 그대로 박힌다. 그 경우만 md 판정을 계속한다 (markdownIO 주석)
        if (event.clipboardData?.types.includes('text/html')) {
          const html = event.clipboardData.getData('text/html')
          if (!looksLikeCodeEditorHtml(html)) return false
        }
        const result = handleMarkdownPaste(current, text, characterLimit)
        if (!result.handled) return false
        setTruncated(result.truncated)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      forceRender()
      // 다음 편집이 시작되면 안내를 내린다. 붙여넣기 경로에서는 이 onUpdate 가 **먼저**
      // 돌고(insertContent 가 동기라) 그 뒤에 setTruncated(true) 가 오므로 새 안내는 안 지워진다
      setTruncated(false)
      onTextChange?.(editor.getText({ blockSeparator: '\n' }))
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setSaveState('saving')
        try {
          const value = editor.isEmpty
            ? ''
            : docToMemoValue(editor.getJSON() as TiptapDoc)
          await onSave(value)
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 2000)
        } catch {
          setSaveState('error')
        }
      }, 1500)
    },
  })

  useEffect(() => {
    editorRef.current = editor ?? null
  }, [editor])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 읽기 ↔ 편집 전환 — 부모가 prop 을 뒤집으면 따라간다
  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  function applyTemplate() {
    if (editor && template) editor.commands.setContent(template)
  }

  const isEmpty = editor ? editor.isEmpty : true
  const chars =
    characterLimit && editor
      ? (editor.storage.characterCount?.characters?.() ?? 0)
      : 0

  return (
    <div>
      {editor && header?.(editor)}
      {editor && !readOnly && (
        <EditorToolbar
          editor={editor}
          sticky={stickyToolbar}
          aiEntryMobileOnly={aiEntryMobileOnly}
          onAiOpen={onAiOpen}
          hasMention={Boolean(mention)}
          onExportMarkdown={
            onExportMarkdown ? () => onExportMarkdown(editorToMarkdown(editor)) : undefined
          }
        />
      )}

      <EditorContent editor={editor} />

      {truncated && (
        <div
          role="status"
          className="mx-4 mb-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-[11px] text-warning"
        >
          {TRUNCATED_NOTICE}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-line">
        <div className="flex items-center gap-2">
          {template && isEmpty && !readOnly && (
            <button
              type="button"
              onClick={applyTemplate}
              className="text-[11px] text-brand hover:text-accent transition-colors"
            >
              기본 포맷 적용 →
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {characterLimit && (
            /*
              🔴 천 단위 구분 — `100000` 은 자릿수를 세어야 읽히지만 `100,000` 은 그냥 읽힌다.
              공부 노트는 상한이 10만이라 이 카운터가 다섯·여섯 자리로 굴러간다.
              로캘은 `'en-US'` 로 **고정**한다: 기기 로캘에 맡기면 같은 화면이 브라우저 설정에
              따라 `100.000`(유럽식)으로도 나오고, 서버가 한도 초과 문구에 쓰는 표기와도
              어긋난다 (`study-note.dto.ts` 가 같은 로캘을 박아 둔 이유).
            */
            <span className={`text-[10px] font-mono ${memoCounterColor(chars, characterLimit)}`}>
              {chars.toLocaleString('en-US')} / {characterLimit.toLocaleString('en-US')}
            </span>
          )}
          <span
            aria-live="polite"
            className={`text-[10px] font-medium transition-opacity ${
              saveState === 'idle' ? 'opacity-0' : 'opacity-100'
            } ${saveState === 'error' ? 'text-danger' : 'text-text-quaternary'}`}
          >
            {SAVE_STATE_LABEL[saveState]}
          </span>
        </div>
      </div>
    </div>
  )
}
