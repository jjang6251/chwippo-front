import { Monitor, Smartphone } from 'lucide-react'
import type { PlatformDistribution } from '@/api/adminUsers'

/**
 * 사용 환경 분포 — 웹만 / 앱만 / 둘 다 / 미접속.
 *
 * 🔴 **4분류는 서로 배타적이라 합계가 전체와 정확히 맞는다** (서버 `toSegment` 가 보장,
 * e2e 로 고정). 겹치면 화면이 "합계 > 전체" 라고 거짓말을 하게 된다.
 *
 * 앱 사용자 중 **푸시가 닿는 인원**을 따로 보여준다 — 앱을 쓰지만 알림을 거부한 사람은
 * 푸시를 보내도 안 닿는데, 이걸 모르면 "보냈는데 왜 반응이 없지" 를 오래 헤맨다.
 *
 * R2 사용량 카드와 같은 레이아웃(막대 + 하단 grid)을 따른다.
 */
interface Props {
  data: PlatformDistribution | undefined
  isLoading?: boolean
}

/** 막대 세그먼트 — 0명이면 렌더하지 않는다 (0폭 조각이 경계선처럼 보인다) */
function Segment({ n, total, className }: { n: number; total: number; className: string }) {
  if (n === 0 || total === 0) return null
  return <div className={className} style={{ width: `${(n / total) * 100}%` }} />
}

function Row({
  icon,
  label,
  n,
  total,
  color,
}: {
  icon?: React.ReactNode
  label: string
  n: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-text-quaternary">
        {icon}
        {label}
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className={`font-medium tabular-nums ${color}`}>{n}명</span>
        <span className="text-text-quaternary tabular-nums text-[11px]">{pct}%</span>
      </span>
    </div>
  )
}

export function PlatformDistributionCard({ data, isLoading }: Props) {
  if (isLoading || !data) {
    // 로딩은 스켈레톤 (스피너 금지)
    return (
      <div className="bg-surface-2 border border-line rounded-xl p-5 mb-8">
        <div className="h-3 w-24 rounded bg-card animate-pulse mb-3" />
        <div className="h-1.5 w-full rounded-full bg-card mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-3 rounded bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const { total, both, appOnly, webOnly, none, appUsers, pushCapable } = data

  if (total === 0) {
    return (
      <div className="bg-surface-2 border border-line rounded-xl p-5 mb-8">
        <p className="text-xs text-text-tertiary font-semibold mb-1">사용 환경 분포</p>
        <p className="text-xs text-text-quaternary">아직 회원이 없어요.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-tertiary font-semibold">사용 환경 분포</p>
        <span className="text-[11px] text-text-quaternary tabular-nums">전체 {total}명</span>
      </div>

      <div
        role="img"
        aria-label={`웹만 ${webOnly}명, 앱만 ${appOnly}명, 둘 다 ${both}명, 미접속 ${none}명`}
        className="h-1.5 w-full rounded-full bg-card overflow-hidden mb-3 flex"
      >
        <Segment n={webOnly} total={total} className="bg-info" />
        <Segment n={appOnly} total={total} className="bg-violet" />
        <Segment n={both} total={total} className="bg-brand" />
        <Segment n={none} total={total} className="bg-line-strong" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Row
          icon={<Monitor className="w-3 h-3" aria-hidden />}
          label="웹만"
          n={webOnly}
          total={total}
          color="text-info"
        />
        <Row
          icon={<Smartphone className="w-3 h-3" aria-hidden />}
          label="앱만"
          n={appOnly}
          total={total}
          color="text-violet"
        />
        <Row label="둘 다" n={both} total={total} color="text-brand" />
        <Row label="미접속" n={none} total={total} color="text-text-tertiary" />
      </div>

      {appUsers > 0 && (
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-xs">
          <span className="text-text-quaternary">앱 사용자 중 푸시 도달 가능</span>
          <span
            className={`font-medium tabular-nums ${
              pushCapable < appUsers ? 'text-warning' : 'text-text-secondary'
            }`}
          >
            {pushCapable} / {appUsers}명
          </span>
        </div>
      )}
    </div>
  )
}
