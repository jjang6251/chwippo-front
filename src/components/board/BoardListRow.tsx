import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { useUpdateApplication } from '@/hooks/useApplications'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { SampleCardBadge } from '@/components/board/SampleCardBadge'
import { DdayBadge } from '@/components/card/DdayBadge'
import { StarToggle } from '@/components/card/StarToggle'
import { getStepChip, getDdayTarget, type StepChipTone } from '@/utils/boardViewGroups'
import type { Application } from '@/types/application'

interface Props {
  application: Application
}

const TONE_CLASS: Record<StepChipTone, string> = {
  warning: 'text-warning bg-warning/10 border border-warning/25',
  success: 'text-success bg-success/10 border border-success/25',
  neutral: 'text-text-secondary bg-surface-3 border border-transparent',
}

/**
 * A11 — 리스트 뷰 컴팩트 행 (h-12).
 * ★ · 아바타(24px) · 회사명 · 직군(sm+) · 현재 스텝 칩 · D-day.
 * 행 클릭 = /board/:id (MyInfoItemRow 의 role=button + Enter/Space 패턴).
 */
export function BoardListRow({ application }: Props) {
  const navigate = useDemoNavigate()
  const { mutate: updateApp } = useUpdateApplication(application.id)
  const chip = getStepChip(application)
  const ddayTarget = getDdayTarget(application)

  const go = () => navigate(`/board/${application.id}`)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
      className="flex items-center gap-2 sm:gap-2.5 h-12 px-2 sm:px-3 cursor-pointer transition-colors hover:bg-card-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
    >
      <StarToggle
        starred={application.isStarred}
        onToggle={() => updateApp({ isStarred: !application.isStarred })}
      />
      <CompanyAvatar name={application.companyName} domain={application.domain} size="xs" />
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-text-primary truncate">{application.companyName}</span>
        {application.jobTitle && (
          <span className="hidden sm:inline text-xs text-text-tertiary truncate">{application.jobTitle}</span>
        )}
      </div>
      {application.isSample && (
        <span className="flex-none">
          <SampleCardBadge />
        </span>
      )}
      <span className={`flex-none text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${TONE_CLASS[chip.tone]}`}>
        {chip.label}
      </span>
      {ddayTarget && (
        <span className="flex-none">
          <DdayBadge deadline={ddayTarget} />
        </span>
      )}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="flex-none text-text-quaternary"
        aria-hidden="true"
      >
        <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
