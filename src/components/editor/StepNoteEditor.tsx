import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorToolbar } from './EditorToolbar'
import { getDefaultTemplate } from '@/utils/stepTemplates'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  stepName: string
  initialContent: string | null
  onSave: (json: string) => Promise<void>
}

const SAVE_STATE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: '저장 중...',
  saved: '저장됨',
  error: '저장 실패',
}

export function StepNoteEditor({ stepName, initialContent, onSave }: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Placeholder.configure({ placeholder: '이 단계에서 준비한 것들을 자유롭게 기록해 보세요...' }),
    ],
    content: parseContent(initialContent),
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[120px] px-4 py-3 text-text-primary',
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setSaveState('idle')
      debounceRef.current = setTimeout(async () => {
        setSaveState('saving')
        try {
          await onSave(JSON.stringify(editor.getJSON()))
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
    if (!editor) return
    const tmpl = getDefaultTemplate(stepName)
    if (tmpl) {
      editor.commands.setContent(tmpl)
    }
  }

  const template = getDefaultTemplate(stepName)
  const isEmpty = editor ? editor.isEmpty : true

  return (
    <div className="border border-white/8 bg-surface-2 rounded-2xl overflow-hidden">
      {editor && <EditorToolbar editor={editor} />}

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between px-4 py-2 border-t border-white/6">
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
        <span
          className={`text-[10px] font-medium transition-opacity ${
            saveState === 'idle' ? 'opacity-0' : 'opacity-100'
          } ${saveState === 'error' ? 'text-danger' : 'text-text-quaternary'}`}
        >
          {SAVE_STATE_LABEL[saveState]}
        </span>
      </div>
    </div>
  )
}

function parseContent(raw: string | null): object | string | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
