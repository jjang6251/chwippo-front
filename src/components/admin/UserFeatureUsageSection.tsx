import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FEATURE_USAGE_QUERY_KEY,
  getAdminFeatureUsage,
  cellCount,
} from '@/api/adminFeatureUsage'

/**
 * 회원 상세의 「기능 사용」 — **`/ops/feature-usage` 와 같은 응답에서 이 사람 행만 꺼낸다.**
 *
 * 🔴 **전용 API 를 만들지 않았다.** 사용자당 엔드포인트를 새로 열면 같은 질문에 답하는
 * 집계가 두 벌이 되고, 두 값이 갈라지는 순간 어느 쪽도 못 믿게 된다. 60명 규모에서
 * 전수 응답 하나를 재사용하는 편이 싸고, 캐시 키가 같아 화면 사이 이동에 재요청도 없다.
 *
 * 🔴 응답에 이 사용자가 **없을 수 있다** — 관리자는 집계에서 통째로 빠진다.
 * 그때 0 을 그리면 「아무 기능도 안 썼다」는 거짓 주장이 되므로 이유를 적는다.
 */
export function UserFeatureUsageSection({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: FEATURE_USAGE_QUERY_KEY,
    queryFn: () => getAdminFeatureUsage(),
    staleTime: 0,
  })

  const row = data?.users.find((u) => u.userId === userId)
  /** 쓴 기능만, 많이 쓴 순 — 안 쓴 18칸을 늘어놓으면 「무엇을 쓰나」가 안 보인다 */
  const used = data
    ? data.features
        .map((f) => ({ feature: f, count: row ? cellCount(row, f.key) : 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
    : []

  return (
    <div className="bg-card border border-line rounded-xl p-5 space-y-3 text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-line flex-wrap">
        <h3 className="text-text-primary text-sm font-semibold">기능 사용</h3>
        <Link
          to="/ops/feature-usage"
          className="ml-auto text-[11px] text-brand hover:underline"
        >
          전체 매트릭스 →
        </Link>
      </div>

      {isError ? (
        <p className="text-text-quaternary text-xs">
          기능 사용을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </p>
      ) : isLoading || !data ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-surface-2 rounded" />
          <div className="h-4 bg-surface-2 rounded w-2/3" />
        </div>
      ) : !row ? (
        <p className="text-text-quaternary text-xs">
          이 회원은 집계 대상이 아니에요 — 관리자 계정의 데이터는 모든 기능 통계에서
          제외됩니다.
        </p>
      ) : used.length === 0 ? (
        <p className="text-text-quaternary text-xs">
          아직 기록이 남은 기능이 없어요. 읽기만 하는 사용(회사 조사 열람·공고 요건 읽기)은
          여기 안 잡힙니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {used.map(({ feature, count }) => (
            <li key={feature.key} className="flex items-center gap-2">
              <span
                className="text-xs text-text-secondary truncate"
                title={`날짜 축: ${feature.dateBasis}`}
              >
                {feature.label}
              </span>
              <span className="ml-auto text-xs text-text-primary tabular-nums shrink-0">
                {count.toLocaleString()}
                <span className="text-text-quaternary">회</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
