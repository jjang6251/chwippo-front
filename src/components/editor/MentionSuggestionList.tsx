import type { StudyNoteMentionItem } from './StudyNoteMention'

/**
 * `[[` · `@` 를 쳤을 때 뜨는 노트 고르기 목록.
 *
 * 키보드 탐색이 본체다 — 이 팝오버는 **타이핑 중에** 뜨므로 손이 이미 키보드에 있다.
 * 마우스로 가야만 고를 수 있으면 멘션은 안 쓰이게 된다 (plan §5 aria 항목).
 */

interface Props {
  items: StudyNoteMentionItem[]
  /** 현재 하이라이트된 인덱스 */
  selected: number
  onPick: (index: number) => void
  onHover: (index: number) => void
}

export function MentionSuggestionList({ items, selected, onPick, onHover }: Props) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-2.5 text-[11px] text-text-quaternary" data-testid="mention-empty">
        찾는 노트가 없어요
      </div>
    )
  }

  return (
    <ul role="listbox" aria-label="공부 노트 고르기" className="py-1">
      {items.map((item, i) => (
        <li key={item.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === selected}
            data-testid="mention-option"
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(i)
            }}
            onMouseEnter={() => onHover(i)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
              i === selected ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-card'
            }`}
          >
            <span aria-hidden="true">📄</span>
            <span className="flex-1 min-w-0 truncate">{item.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
