import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { CharacterCount } from '@tiptap/extensions'
import { EditorToolbar } from './EditorToolbar'
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
}

function parseContent(raw: string | null): object | string | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function RichTextEditor({
  initialContent,
  onSave,
  placeholder,
  minHeightClass,
  characterLimit,
  template,
  header,
  onTextChange,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 카운터·헤더(칩 ✓) 라이브 갱신 보장 (transaction 마다 재렌더)
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Placeholder.configure({ placeholder }),
      ...(characterLimit ? [CharacterCount.configure({ limit: characterLimit })] : []),
    ],
    content: parseContent(initialContent),
    editorProps: {
      attributes: {
        class: `chw-prose ${minHeightClass} focus:outline-none px-4 py-3 text-text-primary leading-relaxed`,
      },
    },
    onUpdate: ({ editor }) => {
      forceRender()
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

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
      {editor && <EditorToolbar editor={editor} />}

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-line">
        <div className="flex items-center gap-2">
          {template && isEmpty && (
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
            <span className={`text-[10px] font-mono ${memoCounterColor(chars, characterLimit)}`}>
              {chars} / {characterLimit}
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
