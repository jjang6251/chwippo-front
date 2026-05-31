import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useAwards } from '@/hooks/useMyinfo'

interface Props {
  open: boolean
  onToggle: () => void
  selectedAwardIds: Set<string>
  onSelectChange: (next: Set<string>) => void
}

/**
 * ChatPanel 사이드 — myinfo 수상 트리.
 * IDOR: backend 가 user_id 명시 조회. frontend 는 award id 만 전달.
 */
export function AwardTreeSection({
  open,
  onToggle,
  selectedAwardIds,
  onSelectChange,
}: Props) {
  const { data: awards = [], isLoading } = useAwards()
  const selectedCount = selectedAwardIds.size

  const toggle = (id: string) => {
    const next = new Set(selectedAwardIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectChange(next)
  }

  return (
    <div className="border-t border-line">
      <div className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 text-text-tertiary hover:text-text-secondary text-[11px] transition-colors text-left"
        >
          <span className="flex items-center gap-1.5">
            🏆 수상
            {selectedCount > 0 && (
              <span className="text-brand font-semibold font-mono">
                · {selectedCount} 선택
              </span>
            )}
          </span>
          <CollapsibleChevron open={open} />
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelectChange(new Set())
            }}
            className="shrink-0 text-text-quaternary hover:text-danger text-[11px] px-1.5 py-0.5 rounded transition-colors"
            title="수상 선택 초기화"
            aria-label="수상 선택 초기화"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="pb-2 space-y-1 max-h-[160px] overflow-y-auto">
          {isLoading ? (
            <p className="text-text-quaternary text-[11px] py-1">로딩중...</p>
          ) : awards.length === 0 ? (
            <p className="text-text-quaternary text-[11px] py-1 leading-relaxed">
              아직 등록된 수상이 없어요. 내정보 창고 → 수상에서 등록하면 여기서 선택할 수 있어요.
            </p>
          ) : (
            awards.map((a) => {
              const checked = selectedAwardIds.has(a.id)
              const meta = [a.award_name, a.org, a.awarded_at].filter(Boolean).join(' · ')
              return (
                <label
                  key={a.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    checked ? 'bg-brand/10' : 'hover:bg-card-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(a.id)}
                    className="mt-0.5 accent-brand"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-text-secondary truncate">
                      🏆 {a.contest_name}
                    </p>
                    {meta && (
                      <p className="text-[10px] text-text-quaternary truncate">
                        {meta}
                      </p>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
