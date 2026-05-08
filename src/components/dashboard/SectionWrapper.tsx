import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SectionWrapperProps {
  id: string
  editMode: boolean
  onRemove?: () => void
  children: React.ReactNode
}

export function SectionWrapper({ id, editMode, onRemove, children }: SectionWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative"
    >
      {/* 드래그 핸들 — 카드 왼쪽 외부, 패딩 영역 사용 */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 -left-6 w-6 h-8 flex flex-col gap-[3.5px] items-center justify-center text-text-quaternary/40 hover:text-text-quaternary/70 cursor-grab active:cursor-grabbing transition-colors"
        aria-label="드래그해서 순서 변경"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex gap-[3.5px]">
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
          </span>
        ))}
      </button>

      {/* 섹션 카드 — stats와 동일한 너비 */}
      <div className="relative bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
        {editMode && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger/70 hover:bg-danger/20 hover:text-danger transition-colors z-10"
            aria-label="섹션 제거"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
