import { useEffect } from 'react'

export interface SectionMeta {
  id: string
  label: string
  icon: string
  description: string
  available: boolean
}

export const ALL_SECTIONS: SectionMeta[] = [
  { id: 'dday',              label: 'D-day 임박',         icon: '📅', description: '마감일과 면접 일정을 한눈에',           available: true },
  { id: 'todos',             label: '오늘 할 일',         icon: '✅', description: '오늘의 준비 항목 체크',                 available: true },
  { id: 'goals',             label: '내 스펙 목표',       icon: '🎯', description: '설정한 스펙 목표 확인',                 available: true },
  { id: 'today_schedule',    label: '오늘 일정',          icon: '📆', description: '오늘 예정된 일정 모아보기',             available: true },
  { id: 'top_applications',  label: '관심 지원',          icon: '⭐', description: '즐겨찾기 한 지원 카드',                 available: true },
  { id: 'calendar_mini',     label: '미니 캘린더',        icon: '🗓️', description: '월별 일정 미리보기',                   available: true },
  { id: 'cover_letter_quick',label: '자소서 소재',        icon: '📋', description: '면접·자소서 작성 직전 빠른 참조',       available: true },
]

interface AddSectionSheetProps {
  activeSectionIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
}

export function AddSectionSheet({ activeSectionIds, onToggle, onClose }: AddSectionSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sections = ALL_SECTIONS.filter((s) => s.id !== 'stats')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-white/8 rounded-t-xl sm:rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary text-sm font-semibold">섹션 관리</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-tertiary hover:bg-white/5 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="text-text-quaternary text-[11px] mb-3">탭해서 추가/제거</p>

        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {sections.map((s) => {
            const isActive = activeSectionIds.includes(s.id)
            const disabled = !s.available
            return (
              <li key={s.id}>
                <button
                  onClick={() => { if (!disabled) onToggle(s.id) }}
                  disabled={disabled}
                  aria-pressed={isActive}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors
                    ${disabled
                      ? 'border-white/5 opacity-50 cursor-not-allowed'
                      : isActive
                        ? 'border-brand/40 bg-brand/8 hover:bg-brand/12 cursor-pointer'
                        : 'border-white/8 hover:bg-white/5 cursor-pointer'
                    }`}
                >
                  <span className="text-xl flex-none">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary text-xs font-medium">{s.label}</p>
                    <p className="text-text-quaternary text-[11px] truncate">{s.description}</p>
                  </div>
                  {disabled ? (
                    <span className="flex-none text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-text-quaternary">
                      준비 중
                    </span>
                  ) : isActive ? (
                    <span className="flex-none w-5 h-5 rounded-full bg-brand text-text-primary flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex-none w-5 h-5 rounded-full border border-white/15" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
