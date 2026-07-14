import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useDemoLink } from '@/hooks/useDemoLink'
import { useApplications } from '@/hooks/useApplications'

/**
 * A9 — 성장 페이지 "이번 여정에서 얻은 것들".
 * 탈락 카드에 남긴 회고 한 줄들이 누적 — 탈락 N개를 "실패 목록"이 아니라
 * "얻은 것 목록"으로 재프레임 ("합격률 대신 노력의 누적" 포지셔닝).
 * 회고가 하나도 없으면 섹션 자체를 렌더하지 않음 (빈 상태 강요 없음).
 */
export function TakeawaysSection() {
  const { data: applications = [] } = useApplications()
  const link = useDemoLink()

  const takeaways = applications
    .filter((a) => a.status === 'FAILED' && (a.failedTakeaway ?? '').trim())
    .sort((a, b) =>
      (b.failedTakeawayAt ?? '').localeCompare(a.failedTakeawayAt ?? ''),
    )

  if (takeaways.length === 0) return null

  return (
    <section className="bg-card border border-line rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-text-primary text-base font-semibold">
          🌱 이번 여정에서 얻은 것들
        </h2>
        <span className="text-[11px] font-mono text-text-quaternary">
          {takeaways.length}
        </span>
      </div>
      <ul className="space-y-2.5">
        {takeaways.map((a) => (
          <li key={a.id}>
            <Link
              to={link(`/board/${a.id}`)}
              className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded-md"
            >
              <p className="text-sm text-text-secondary leading-relaxed group-hover:text-text-primary transition-colors line-clamp-3">
                “{a.failedTakeaway}”
              </p>
              <p className="text-[11px] text-text-quaternary mt-0.5">
                {a.companyName}
                {a.failedTakeawayAt &&
                  ` · ${dayjs(a.failedTakeawayAt).format('M월')}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
