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
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'invisible' : ''}`}
    >
      {/* 드래그 핸들 — 모바일: 카드 상단 중앙 / 웹: 카드 왼쪽 외부 */}
      <button
        {...attributes}
        {...listeners}
        className="sm:hidden absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-8 flex items-center justify-center text-text-quaternary/50 hover:text-text-quaternary/80 cursor-grab active:cursor-grabbing transition-colors touch-none"
        aria-label="드래그해서 순서 변경"
      >
        <span className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-[3px] h-[3px] rounded-full bg-current" />
          ))}
        </span>
      </button>
      <button
        {...attributes}
        {...listeners}
        className="hidden sm:flex absolute top-2 -left-6 w-6 h-8 flex-col gap-[3.5px] items-center justify-center text-text-quaternary/40 hover:text-text-quaternary/70 cursor-grab active:cursor-grabbing transition-colors"
        aria-label="드래그해서 순서 변경"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex gap-[3.5px]">
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
          </span>
        ))}
      </button>

      {/* 섹션 제거 버튼 — 카드 우측 상단 외부 */}
      {editMode && (
        <button
          onClick={onRemove}
          className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center group z-10"
          aria-label="섹션 제거"
        >
          <span className="w-5 h-5 rounded-full bg-danger group-hover:brightness-110 transition-all flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}

      {/* 섹션 카드 */}
      <div className="bg-card border border-line[0.07] rounded-xl p-4">
        {children}
      </div>
    </div>
  )
}
