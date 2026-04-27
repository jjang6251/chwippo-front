import { JOB_CATEGORIES, JOB_CATEGORY_COLOR, JOB_CATEGORY_EMOJI } from '@/utils/tags'

interface TagSelectorProps {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function TagSelector({ selected, onChange }: TagSelectorProps) {
  const toggle = (cat: string) => {
    onChange(
      selected.includes(cat)
        ? selected.filter((t) => t !== cat)
        : [...selected, cat],
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {JOB_CATEGORIES.map((cat) => {
        const isSelected = selected.includes(cat)
        const colorClass = JOB_CATEGORY_COLOR[cat] ?? JOB_CATEGORY_COLOR['기타']
        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-all font-medium
              ${isSelected ? colorClass : 'bg-white/4 border-white/8 text-text-quaternary hover:border-white/15 hover:text-text-tertiary'}
            `}
          >
            {JOB_CATEGORY_EMOJI[cat]} {cat}
          </button>
        )
      })}
    </div>
  )
}
