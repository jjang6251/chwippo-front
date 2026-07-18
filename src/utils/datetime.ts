/**
 * 치뽀 전역 시간·날짜 헬퍼.
 *
 * **정체성: 치뽀는 한국 취준생 타겟 → KST-fixed app.**
 * 모든 시간 표시·계산의 기본은 KST (Asia/Seoul). 해외 거주 사용자도 KST 기준으로 봄.
 * 화면에 KST 명시 라벨을 같이 노출해 혼란 방지 (memory feedback-kst-local-date).
 *
 * **확장 친화 시그니처**: 모든 헬퍼가 `tz?: string` 옵셔널 인자를 받음.
 * - 지금: 기본값 `APP_TIMEZONE` ('Asia/Seoul') → KST-fixed 동작
 * - 미래: 사용자별 TZ 지원 시 호출 측에서 `user.timezone` 전달만 하면 자동 분기
 *
 * **금지 패턴**: `new Date().toISOString().slice(0, 10)` — UTC 라 KST 새벽에 전날
 *
 * 내부 구현: `Intl.DateTimeFormat` 명시 timezone + UTC 정오 기준 YMD math.
 * 브라우저 timezone 과 완전히 무관 — 해외 거주자도 일관 동작.
 */

export const APP_TIMEZONE = 'Asia/Seoul' as const
export type Tz = string

/**
 * 종일(마감) 이벤트 표시 시각 상수 (F8).
 * E안 표시 정책 — 시간 없는 마감은 "그날 23:59"로 노출. 여러 컴포넌트가 공유하는
 * 표시 문자열을 한 곳에 고정 (정책 변경 시 단일 지점 수정). 표시 정책 자체는 무변경.
 */
export const DEADLINE_DISPLAY_TIME = '23:59' as const

// ────────────────────────────────────────────────────────────────────────
// 내부 — Intl formatter 캐시, YMD math
// ────────────────────────────────────────────────────────────────────────

const ymdFormatters = new Map<string, Intl.DateTimeFormat>()
function ymdFormatter(tz: Tz): Intl.DateTimeFormat {
  let f = ymdFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    ymdFormatters.set(tz, f)
  }
  return f
}

const dtFormatters = new Map<string, Intl.DateTimeFormat>()
function datetimeFormatter(tz: Tz): Intl.DateTimeFormat {
  let f = dtFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    dtFormatters.set(tz, f)
  }
  return f
}

/** 'YYYY-MM-DD' 문자열에 일수 더한 결과 반환 — TZ 무관 (UTC 정오 기준 stable math) */
function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + days)
  const y2 = dt.getUTCFullYear()
  const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(dt.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

/** 'YYYY-MM-DD' 의 요일 (0=일, 1=월, …, 6=토) — TZ 무관 */
function ymdDayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}

// ────────────────────────────────────────────────────────────────────────
// 공개 — 기본
// ────────────────────────────────────────────────────────────────────────

/** `Date` → 'YYYY-MM-DD' (기본 KST 기준, Intl 사용 — 브라우저 TZ 무관) */
export function toLocalDateString(d: Date, tz: Tz = APP_TIMEZONE): string {
  return ymdFormatter(tz).format(d)
}

/** 오늘 'YYYY-MM-DD' (기본 KST) */
export function todayLocal(tz: Tz = APP_TIMEZONE): string {
  return toLocalDateString(new Date(), tz)
}

/** 'YYYY-MM-DD' 에 일수 더한 결과 (음수 = 이전 날짜) — TZ 무관 (date-only math) */
export function addDays(dateStr: string, days: number): string {
  return ymdAddDays(dateStr, days)
}

// ────────────────────────────────────────────────────────────────────────
// 주 경계 — ISO 월요일 ~ 일요일
// ────────────────────────────────────────────────────────────────────────

/** 주어진 날짜 (또는 오늘) 가 속한 ISO 주의 월요일 'YYYY-MM-DD' (기본 KST) */
export function getWeekMonday(dateStr?: string, tz: Tz = APP_TIMEZONE): string {
  const base = dateStr ?? todayLocal(tz)
  const day = ymdDayOfWeek(base)
  const diff = day === 0 ? -6 : 1 - day
  return ymdAddDays(base, diff)
}

/** 주어진 날짜 (또는 오늘) 가 속한 ISO 주의 일요일 'YYYY-MM-DD' (= monday + 6일) */
export function getWeekSunday(dateStr?: string, tz: Tz = APP_TIMEZONE): string {
  return ymdAddDays(getWeekMonday(dateStr, tz), 6)
}

/** date 문자열이 오늘 기준 이번주 안인지 (양끝 포함) */
export function isThisWeek(dateStr: string, tz: Tz = APP_TIMEZONE): boolean {
  return (
    dateStr >= getWeekMonday(undefined, tz) &&
    dateStr <= getWeekSunday(undefined, tz)
  )
}

// ────────────────────────────────────────────────────────────────────────
// 표시 라벨
// ────────────────────────────────────────────────────────────────────────

/**
 * weekStart (ISO 월요일) → "5월 넷째주 · 5/25 ~ 5/31" 형식 라벨.
 * 월의 N째주 = 해당 주의 월요일이 속한 달의 N번째 월요일.
 * (월요일이 전월에 있으면 그 전월의 N째주로 표시)
 *
 * 입력이 이미 날짜 문자열이라 TZ 무관.
 */
export function formatWeekLabel(weekStartIso: string): string {
  const [, m, d] = weekStartIso.split('-').map(Number)
  const month = m
  const weekOfMonth = Math.floor((d - 1) / 7) + 1
  const koreanOrd = ['첫', '둘', '셋', '넷', '다섯', '여섯']
  const ordLabel = koreanOrd[weekOfMonth - 1]
    ? `${koreanOrd[weekOfMonth - 1]}째주`
    : `${weekOfMonth}째주`
  const sundayYmd = ymdAddDays(weekStartIso, 6)
  const [, sm, sd] = sundayYmd.split('-').map(Number)
  return `${month}월 ${ordLabel} · ${m}/${d} ~ ${sm}/${sd}`
}

/**
 * `Date` 또는 ISO 문자열 → 'YYYY-MM-DD HH:mm:ss' (기본 KST) 표시.
 * 백엔드 TIMESTAMPTZ ISO (UTC) → 사용자 화면용 KST 변환.
 * 브라우저 timezone 과 무관 (Intl 명시 timezone).
 *
 * 참고: 이전 이름 `formatKstDateTime` 의 alias 로도 export.
 */
export function formatDateTime(
  d: Date | string,
  tz: Tz = APP_TIMEZONE,
): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const parts = datetimeFormatter(tz).formatToParts(date)
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`
}

/** @deprecated 동작 동일 — `formatDateTime` 권장 */
export const formatKstDateTime = formatDateTime

/**
 * `Date` 또는 ISO 문자열 → "M/D" (기본 KST). 신선도 라벨 등 짧은 표시용.
 * 브라우저 timezone 과 무관 (Intl 명시 timezone).
 */
export function formatMonthDay(d: Date | string, tz: Tz = APP_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${pick('month')}/${pick('day')}`
}

// ────────────────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────────────────

/** HTML escape (시간 라벨 등에서 재사용) */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
