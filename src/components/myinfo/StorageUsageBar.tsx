import { useStorageUsage } from '@/hooks/useStorageUsage'

/**
 * 사용량 진행 바.
 * - 평소: surface 톤
 * - 80%+ : warning(노랑)
 * - 95%+ : danger(빨강) + 안내 문구
 */
export function StorageUsageBar() {
  const { data, isLoading, error } = useStorageUsage()

  if (isLoading) {
    return (
      /* 🔴 실제 카드와 **같은 구조**로 자리를 잡는다 (텍스트 줄 + 막대).
         전엔 줄 하나뿐이라 38px 이었는데 실제는 56px — 18px 이 자라며 아래를 밀었다. */
      <div className="h-[56px] rounded-lg border border-line bg-surface px-4 py-3">
        <div className="h-3 w-32 mb-2 animate-pulse rounded bg-card" />
        <div className="h-2 w-full animate-pulse rounded-full bg-card" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3 text-text-tertiary text-xs">
        사용량 조회 실패
      </div>
    )
  }

  const { usedMB, limitMB, percentage } = data
  const tone = getTone(percentage)

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-text-tertiary">파일 저장 용량</span>
        <span className={`font-medium ${tone.textClass}`}>
          {formatMB(usedMB)} / {limitMB}MB
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`파일 저장 용량 ${percentage}%`}
        className="h-1.5 w-full rounded-full bg-card overflow-hidden"
      >
        <div
          className={`h-full transition-all ${tone.barClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {percentage >= 95 && (
        <p className="mt-2 text-[11px] text-danger">
          저장 공간이 거의 찼습니다. 일부 항목을 삭제해 주세요.
        </p>
      )}
    </div>
  )
}

function getTone(percentage: number): { textClass: string; barClass: string } {
  if (percentage >= 95) {
    return { textClass: 'text-danger', barClass: 'bg-danger' }
  }
  if (percentage >= 80) {
    return { textClass: 'text-warning', barClass: 'bg-warning' }
  }
  return { textClass: 'text-text-primary', barClass: 'bg-brand' }
}

function formatMB(mb: number): string {
  // 100MB 미만이면 소수점 1자리, 100MB 이상이면 정수
  return mb < 100 ? mb.toFixed(1) : Math.round(mb).toString()
}
