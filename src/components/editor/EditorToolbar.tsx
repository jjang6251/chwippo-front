import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
}

interface ToolBtn {
  label: string
  title: string
  action: () => void
  active: () => boolean
}

export function EditorToolbar({ editor }: Props) {
  const tools: ToolBtn[] = [
    {
      label: 'B',
      title: '굵게',
      action: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive('bold'),
    },
    {
      label: 'I',
      title: '기울임',
      action: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive('italic'),
    },
    {
      label: 'U',
      title: '밑줄',
      action: () => editor.chain().focus().toggleUnderline().run(),
      active: () => editor.isActive('underline'),
    },
    {
      label: 'H2',
      title: '큰 제목',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'H3',
      title: '중간 제목',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => editor.isActive('heading', { level: 3 }),
    },
    {
      label: '—',
      title: '가로선',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      active: () => false,
    },
  ]

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8 flex-wrap">
      {tools.map((t) => (
        <button
          key={t.label}
          type="button"
          title={t.title}
          onMouseDown={(e) => {
            e.preventDefault()
            t.action()
          }}
          className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors ${
            t.active()
              ? 'bg-brand/20 text-brand'
              : 'text-text-quaternary hover:bg-white/6 hover:text-text-secondary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
