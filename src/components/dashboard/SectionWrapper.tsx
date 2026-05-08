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
        className="absolute top-3 -left-5 flex flex-col gap-[3.5px] items-center px-0.5 py-1 text-text-quaternary/35 hover:text-text-quaternary/65 cursor-grab active:cursor-grabbing transition-colors"
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
      <div className="relative bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        {editMode && (
          <button
            onClick={onRemove}
            className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full bg-danger/15 text-danger/80 hover:bg-danger/25 hover:text-danger transition-colors z-10"
            aria-label="섹션 제거"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
