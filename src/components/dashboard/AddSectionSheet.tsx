import { useEffect } from 'react'

interface SectionMeta {
  id: string
  label: string
  icon: string
  description: string
  available: boolean
}

// 회고=성장 페이지 Phase A — 현재 유지 섹션:
//   milestones · monthly_comparison · insights · activity_streak · status_doughnut · personal_funnel · interview_review
// 제거된 섹션 (backend DEPRECATED_SECTION_IDS 로 자동 필터링):
//   dday · todos · today_schedule · top_applications · calendar_mini (→ 캘린더 이관)
//   cover_letter_quick · goals (→ 성장 재정의로 제거)
const ALL_SECTIONS: SectionMeta[] = [
  { id: 'milestones',         label: '내 마일스톤',     icon: '🏆', description: '달성 배지 + 다음 목표',                available: true },
  { id: 'monthly_comparison', label: '이번 달 활동',    icon: '📈', description: '이번 달 vs 지난 달 활동량 비교',       available: true },
  { id: 'insights',           label: '내 활동 패턴',    icon: '🔍', description: '가장 활발한 요일 · 지원 직군 등 개인 인사이트', available: true },
  { id: 'activity_streak',    label: '활동 스트릭',     icon: '🔥', description: '연속 활동 일수 + 365일 heatmap',      available: true },
  { id: 'status_doughnut',    label: '지원 현황',       icon: '🎯', description: '지원 status 분포 도넛',                available: true },
  { id: 'personal_funnel',    label: '나의 지원 흐름',  icon: '📊', description: '지원 → 면접 도달 → 합격 개인 %',     available: true },
  { id: 'interview_review',   label: '면접 회고',       icon: '💭', description: '어제 본 면접 다시 보기',              available: true },
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="섹션 관리" className="relative z-10 w-full max-w-sm bg-surface border border-line rounded-t-xl sm:rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary text-sm font-semibold">섹션 관리</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-tertiary hover:bg-card active:bg-card-strong transition-colors"
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
                      ? 'border-line opacity-50 cursor-not-allowed'
                      : isActive
                        ? 'border-brand/40 bg-brand/8 hover:bg-brand/12 active:bg-brand/20 cursor-pointer'
                        : 'border-line hover:bg-card active:bg-card-strong cursor-pointer'
                    }`}
                >
                  <span className="text-xl flex-none">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary text-xs font-medium">{s.label}</p>
                    <p className="text-text-quaternary text-[11px] truncate">{s.description}</p>
                  </div>
                  {disabled ? (
                    <span className="flex-none text-[10px] px-1.5 py-0.5 rounded-full bg-card text-text-quaternary">
                      준비 중
                    </span>
                  ) : isActive ? (
                    <span className="flex-none w-5 h-5 rounded-full bg-brand text-text-primary flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex-none w-5 h-5 rounded-full border border-line" />
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
