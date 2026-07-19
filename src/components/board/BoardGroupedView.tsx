import { useMemo } from 'react'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { useUpdateApplication } from '@/hooks/useApplications'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { SampleCardBadge } from '@/components/board/SampleCardBadge'
import { DdayBadge } from '@/components/card/DdayBadge'
import { StarToggle } from '@/components/card/StarToggle'
import { groupApplications, getDdayTarget } from '@/utils/boardViewGroups'
import type { Application } from '@/types/application'

interface Props {
  /** 이미 정렬·필터·검색이 끝난 목록 (sortApplications 결과). */
  applications: Application[]
}

/**
 * A11 — 그룹 뷰. 단계 그룹 헤더(이모지 + 이름 + 개수) + 초경량 행.
 * 스텝 정보를 그룹 제목으로 올려 행에는 회사명 + D-day 만 남긴다. 빈 그룹은 숨김.
 */
export function BoardGroupedView({ applications }: Props) {
  const groups = useMemo(() => groupApplications(applications), [applications])

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="flex items-center gap-1.5 px-1 mb-1.5 text-xs font-semibold text-text-secondary">
            <span aria-hidden="true">{group.icon}</span>
            {group.label}
            <span className="font-mono font-normal text-text-quaternary">{group.items.length}</span>
          </h2>
          <div className="bg-card-solid border border-line rounded-xl overflow-hidden shadow-sm divide-y divide-line">
            {group.items.map((app) => (
              <BoardGroupRow key={app.id} application={app} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * 초경량 행 (h-11 ≥ 44px 터치 타겟 — 목업 h-10 상향).
 * ★ · 아바타(20px) · 회사명 · D-day. 스텝 정보는 그룹 헤더가 담당.
 */
function BoardGroupRow({ application }: { application: Application }) {
  const navigate = useDemoNavigate()
  const { mutate: updateApp } = useUpdateApplication(application.id)
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
      className="flex items-center gap-2 sm:gap-2.5 h-11 px-2 sm:px-3 cursor-pointer transition-colors hover:bg-card-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
    >
      <StarToggle
        starred={application.isStarred}
        onToggle={() => updateApp({ isStarred: !application.isStarred })}
      />
      <CompanyAvatar name={application.companyName} domain={application.domain} size="2xs" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
        {application.companyName}
      </span>
      {application.isSample && (
        <span className="flex-none">
          <SampleCardBadge />
        </span>
      )}
      {ddayTarget && (
        <span className="flex-none">
          <DdayBadge deadline={ddayTarget} />
        </span>
      )}
    </div>
  )
}
