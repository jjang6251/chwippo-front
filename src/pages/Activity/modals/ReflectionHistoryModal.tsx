import { useEffect } from 'react'
import { toast } from '@/stores/toastStore'
import { useReflections, useRemoveReflection } from '@/hooks/useActivities'
import type { Activity, ActivityReflection } from '@/types/activity'
import { getISOWeekMonday } from '../utils'

interface Props {
  open: boolean
  activity: Activity | null
  onClose: () => void
  onEditReflection: (refl: ActivityReflection) => void
}

export function ReflectionHistoryModal({
  open,
  activity,
  onClose,
  onEditReflection,
}: Props) {
  const { data: refls = [] } = useReflections(activity?.id)
  const remove = useRemoveReflection(activity?.id ?? '')

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open || !activity) return null

  // weekStart desc (없는 건 createdAt desc)
  const sorted = [...refls].sort((a, b) => {
    if (a.weekStart && b.weekStart) return b.weekStart.localeCompare(a.weekStart)
    return b.createdAt.localeCompare(a.createdAt)
  })

  const thisWeek = getISOWeekMonday()

  function handleDelete(refl: ActivityReflection) {
    if (
      !confirm(
        `${refl.weekStart ?? refl.createdAt.slice(0, 10)} 회고를 삭제할까요?\n복구할 수 없습니다.`,
      )
    )
      return
    remove.mutate(refl.id, {
      onSuccess: () => toast.success('회고가 삭제되었어요'),
      onError: () => toast.error('삭제에 실패했어요'),
    })
  }

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal max-w-[540px]">
        <div className="head">
          <div className="ic-box bg-accent/15 text-accent">✶</div>
          <div className="flex-1">
            <div className="t">{activity.name} — 회고 히스토리</div>
            <div className="s">
              총 {refls.length}개 · 클릭하면 편집할 수 있어요
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          {sorted.length === 0 ? (
            <div className="py-8 px-[18px] text-center text-text-tertiary text-[13px]">
              아직 회고가 없어요.
              <br />
              이번주 회고를 남겨보세요.
            </div>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {sorted.map((r) => {
                const isCurrent = r.weekStart === thisWeek
                const date = r.weekStart ?? r.createdAt.slice(0, 10)
                return (
                  <li
                    key={r.id}
                    className="border border-line rounded-[10px] px-3 py-2.5 bg-surface-2 cursor-pointer"
                    onClick={() => onEditReflection(r)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[11px] font-semibold tracking-wider ${
                          isCurrent ? 'text-brand' : 'text-text-tertiary'
                        }`}
                      >
                        {date} 주{isCurrent ? ' · 이번주' : ''}
                      </span>
                      <button
                        type="button"
                        title="회고 삭제"
                        aria-label="회고 삭제"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(r)
                        }}
                        className="appearance-none bg-transparent border-0 text-text-quaternary text-[11px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <p
                      className="m-0 text-text-primary leading-normal whitespace-pre-wrap overflow-hidden"
                      style={{
                        fontSize: 12.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {r.content}
                    </p>
                    {(r.growth.length > 0 ||
                      r.challenges.length > 0 ||
                      r.nextActions.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-text-tertiary">
                        {r.growth.length > 0 && (
                          <span>🌱 {r.growth.length}</span>
                        )}
                        {r.challenges.length > 0 && (
                          <span>· 😮‍💨 {r.challenges.length}</span>
                        )}
                        {r.nextActions.length > 0 && (
                          <span>· → {r.nextActions.length}</span>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
