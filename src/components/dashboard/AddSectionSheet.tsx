import { useEffect } from 'react'

export interface SectionMeta {
  id: string
  label: string
  icon: string
  description: string
  available: boolean
}

export const ALL_SECTIONS: SectionMeta[] = [
  { id: 'dday',            label: 'D-day 임박',    icon: '📅', description: '마감일과 면접 일정을 한눈에',        available: true },
  { id: 'todos',           label: '오늘 할 일',    icon: '✅', description: '오늘의 준비 항목 체크',              available: true },
  { id: 'goals',           label: '내 스펙 목표',  icon: '🎯', description: '설정한 스펙 목표 확인',              available: true },
  { id: 'today_schedule',  label: '오늘 일정',     icon: '📆', description: '오늘 예정된 일정 모아보기',          available: false },
  { id: 'top_applications',label: '관심 지원',     icon: '⭐', description: '즐겨찾기 한 지원 카드',              available: false },
  { id: 'calendar_mini',   label: '미니 캘린더',   icon: '🗓️', description: '월별 일정 미리보기',                available: false },
]

interface AddSectionSheetProps {
  activeSectionIds: string[]
  onAdd: (id: string) => void
  onClose: () => void
}

export function AddSectionSheet({ activeSectionIds, onAdd, onClose }: AddSectionSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const addable = ALL_SECTIONS.filter((s) => s.id !== 'stats' && !activeSectionIds.includes(s.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-white/10 rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary text-sm font-semibold">섹션 추가</h3>
          <button onClick={onClose} className="text-text-quaternary hover:text-text-tertiary text-lg leading-none">×</button>
        </div>

        {addable.length === 0 ? (
          <p className="text-text-quaternary text-xs text-center py-6">추가할 수 있는 섹션이 없어요</p>
        ) : (
          <ul className="space-y-2">
            {addable.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => { if (s.available) { onAdd(s.id); onClose() } }}
                  disabled={!s.available}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors
                    ${s.available
                      ? 'border-white/8 hover:bg-white/5 cursor-pointer'
                      : 'border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                >
                  <span className="text-xl flex-none">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-text-primary text-xs font-medium">{s.label}</p>
                    <p className="text-text-quaternary text-[11px] truncate">{s.description}</p>
                  </div>
                  {!s.available && (
                    <span className="flex-none text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-text-quaternary">
                      준비 중
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
