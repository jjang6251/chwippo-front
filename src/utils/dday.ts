import dayjs from 'dayjs'
import { APP_TIMEZONE, toLocalDateString } from '@/utils/datetime'

/**
 * D-day 계산 — **기기 타임존과 무관하게 KST 기준**.
 *
 * 🔴 예전 구현은 `dayjs(deadline).startOf('day').diff(dayjs().startOf('day'))` 로
 * **로컬 타임존**을 탔다 (`timezone`·`utc` 플러그인을 import 해놓고 쓰지 않은 상태였다).
 *
 * 마감일은 `timestamptz` 라 API 가 `2026-08-13T15:00:00Z`(= KST 8/14 자정) 같은 값을 준다.
 * 기기 TZ 가 KST 가 아니면 **하루 어긋난다** — UTC 기기에서 D-10 이 D-9 로 나왔다.
 *
 * 치뽀는 **KST 고정 앱**이고 다른 시간 계산은 전부 `datetime.ts` 를 쓴다. 여기만 예외였다.
 * 국내 기기에서는 안 터져서 **로컬 재현이 어렵고**, 그래서 신고를 받아도 찾기 힘든 유형이다.
 */

/**
 * 마감일까지 남은 일수 (KST 날짜 기준). 음수 = 지남.
 *
 * 🔴 **날짜가 아닌 값에는 `NaN` 을 돌려준다 — 던지지 않는다.**
 * `Intl.DateTimeFormat.format()` 은 Invalid Date 에 `RangeError` 를 던지므로,
 * 막지 않으면 잘못된 값 하나가 **화면 전체를 크래시**시킨다. 예전 `dayjs` 구현은
 * 조용히 `NaN` 을 뱉었고 그때는 "D-NaN" 이 떠도 페이지는 살아 있었다.
 * 서버가 보내는 값을 신뢰하지 않는다는 원칙(2026-08-01 자소서 크래시)이 여기에도 적용된다.
 */
export function calcDday(deadline: string, tz: string = APP_TIMEZONE): number {
  const target = toKstDate(deadline, tz)
  if (!target) return NaN
  const today = toLocalDateString(new Date(), tz)
  return diffDays(today, target)
}

/**
 * 입력을 KST 날짜(`YYYY-MM-DD`)로 정규화. 날짜로 못 읽으면 `null`.
 * date-only 문자열은 그대로 쓴다 — 이미 날짜라 TZ 해석이 끼면 오히려 어긋난다.
 */
function toKstDate(value: string, tz: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return toLocalDateString(parsed, tz)
}

/** `YYYY-MM-DD` 두 개의 일수 차 — 날짜 문자열 산술이라 TZ 무관 */
function diffDays(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

export function getDdayLabel(dday: number): string {
  if (dday === 0) return 'D-day'
  if (dday > 0) return `D-${dday}`
  return `D+${Math.abs(dday)}`
}

export type DdayVariant = 'danger' | 'warning' | 'info' | 'muted'

export function getDdayVariant(dday: number): DdayVariant {
  if (dday < 0) return 'muted'
  if (dday <= 2) return 'danger'
  if (dday <= 7) return 'warning'
  return 'info'
}

export function formatDate(date: string): string {
  return dayjs(date).format('M월 D일 (ddd)')
}
