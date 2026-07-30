/**
 * admin 사용자 상세 — 방문 이력(A8 `user_daily_visits`) 표시 문구.
 *
 * 페이지 안에 인라인으로 두지 않고 뺀 이유는 재사용이 아니라 **검증 가능성**이다.
 * `visitStats` 가 `undefined` 일 때 터지는 버그를 실제로 냈는데, 그건 tsc·lint·테스트를
 * 전부 통과하고 **백엔드가 항상 응답을 주는 로컬에선 재현되지 않는다** — 배포 창에서만 터진다
 * (프론트 Vercel 이 백엔드 Railway 보다 먼저 뜬다). 순수 함수로 빼야 그 창을 테스트할 수 있다.
 */

export interface VisitStats {
  /** 집계 시작일 이후 방문한 날의 수 (하루 여러 번 와도 1) */
  totalDays: number
  /** 오늘 포함 최근 30일 중 방문일 수 */
  last30Days: number
  /** 가장 오래된 방문일 (YYYY-MM-DD, KST). **가입일이 아니다** */
  firstVisitDate: string | null
}

/**
 * 🔴 `undefined` 와 `0` 을 절대 같게 취급하지 않는다.
 *   - `undefined` = 백엔드가 아직 이 필드를 안 줌 → **모름**
 *   - `0`         = 실제로 한 번도 안 옴
 * `?? { totalDays: 0 }` 로 폴백하면 "모른다"를 "0회 방문했다"는 **거짓 주장**으로 바꾼다.
 */
export function visitSummary(v: VisitStats | undefined): {
  value: string
  sub?: string
} {
  if (!v) return { value: '-' }
  if (v.totalDays === 0) return { value: '0일', sub: '기록 없음' }
  return { value: `${v.totalDays}일`, sub: `최근 30일 중 ${v.last30Days}일` }
}

/**
 * 상세 Row 한 줄. 집계 시작일을 반드시 붙인다 —
 * `user_daily_visits` 는 2026-07-07 부터 쌓여서 그 전 가입자의 총계는 **부분값**이다.
 * "24일" 만 쓰면 가입 후 24일로 읽힌다 (4/28 가입자의 24일 = 7/7 이후 24일).
 */
export function visitDetailLine(v: VisitStats | undefined): string {
  if (!v) return '-'
  if (v.totalDays === 0) return '기록 없음'
  // MIN(visit_date) 는 행이 1개 이상이면 null 이 아니지만, 응답을 믿지 않고 방어한다
  if (!v.firstVisitDate) return `${v.totalDays}일`
  const from = new Date(v.firstVisitDate).toLocaleDateString('ko-KR')
  return `${v.totalDays}일 · ${from}부터 집계`
}
