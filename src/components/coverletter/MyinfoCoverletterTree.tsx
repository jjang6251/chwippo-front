import { useMemo } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useCoverletter } from '@/hooks/useMyinfo'
import type { MyinfoFieldKey } from '@/api/coverletterDoc'

/**
 * ChatPanel 사이드 — myinfo 자소서 소재 (6 카테고리 + custom) 트리.
 * 선택된 key 들이 chat sendChat 시 backend prompt 로 inject.
 * IDOR: backend 가 user_id 명시 조회. frontend 는 key 만 전달.
 */

const FIXED_FIELDS: ReadonlyArray<{
  key: Exclude<MyinfoFieldKey, `custom:${string}`>
  label: string
  emoji: string
}> = [
  { key: 'personality', label: '성격 장단점', emoji: '🧬' },
  { key: 'background', label: '성장 배경', emoji: '🌱' },
  { key: 'job_competency', label: '직무 역량·핵심 경험', emoji: '💼' },
  { key: 'own_strength', label: '나만의 강점', emoji: '⭐' },
  { key: 'collaboration', label: '협업·갈등 해결', emoji: '🤝' },
  { key: 'challenge', label: '도전·실패 경험', emoji: '🔥' },
]

interface Props {
  open: boolean
  onToggle: () => void
  selectedKeys: Set<MyinfoFieldKey>
  onSelectChange: (next: Set<MyinfoFieldKey>) => void
}

export function MyinfoCoverletterTree({
  open,
  onToggle,
  selectedKeys,
  onSelectChange,
}: Props) {
  const { data, isLoading } = useCoverletter()

  const items = useMemo(() => {
    if (!data) return [] as Array<{ key: MyinfoFieldKey; label: string; preview: string; emoji?: string }>
    const list: Array<{ key: MyinfoFieldKey; label: string; preview: string; emoji?: string }> = []
    for (const f of FIXED_FIELDS) {
      const content = (data.coverletter as Record<string, string | undefined | null>)[f.key]
      if (content && content.trim().length > 0) {
        list.push({
          key: f.key,
          label: f.label,
          emoji: f.emoji,
          preview: content.trim().slice(0, 60),
        })
      }
    }
    for (const c of data.custom ?? []) {
      if (c.content && c.content.trim().length > 0) {
        list.push({
          key: `custom:${c.id}` as MyinfoFieldKey,
          label: c.label,
          emoji: '📝',
          preview: c.content.trim().slice(0, 60),
        })
      }
    }
    return list
  }, [data])

  const toggle = (key: MyinfoFieldKey) => {
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectChange(next)
  }

  const selectedCount = selectedKeys.size

  return (
    <div className="border-t border-line">
      <div className="flex items-center justify-between gap-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-2 text-text-tertiary hover:text-text-secondary text-[11px] transition-colors text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-1.5">
            ✍️ 자소서 소재
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
            title="자소서 소재 선택 초기화"
            aria-label="자소서 소재 선택 초기화"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="pb-2 space-y-1 max-h-[160px] overflow-y-auto">
          {isLoading ? (
            <p className="text-text-quaternary text-[11px] py-1">로딩중...</p>
          ) : items.length === 0 ? (
            <p className="text-text-quaternary text-[11px] py-1 leading-relaxed">
              아직 작성된 자소서 소재가 없어요. 내정보 창고 → 자소서 소재에서 작성하면 여기서 선택할 수 있어요.
            </p>
          ) : (
            items.map((it) => {
              const checked = selectedKeys.has(it.key)
              return (
                <label
                  key={it.key}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    checked ? 'bg-brand/10' : 'hover:bg-card-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(it.key)}
                    className="mt-0.5 accent-brand"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-text-secondary truncate">
                      {it.emoji} {it.label}
                    </p>
                    <p className="text-[10px] text-text-quaternary truncate">
                      {it.preview}
                    </p>
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
