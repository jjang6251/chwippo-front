import { formatStepSchedule } from '@/utils/datetime'

/**
 * 공고 일정(`postingMeta.extraDates[].date`) 한 줄 표시.
 *
 * ## 🔴 없는 시각을 만들어 내지 않는다
 *
 * 서버는 **날짜만** 있는 일정을 `'2026-09-22'` 로 보낸다(발표는 보통 시각이 없다).
 * 그걸 `new Date()` 에 그대로 넣으면 JS 가 **UTC 자정**으로 읽어 KST 로는 09:00 이 되고,
 * 화면엔 「9월 22일 (화) **09:00**」이 찍힌다 — 공고에 없는 시각이다. 이 기능의 대원칙이
 * 「확실한 날짜만 캘린더에, 애매한 건 글자로」인데, 그 반대를 하는 셈이 된다.
 *
 * 같은 이유로 **타임존이 안 붙은** `'2026-10-30T14:00'` 도 그대로 넘기면 안 된다.
 * 그건 기기 로컬 시각으로 해석돼 해외 체류·`TZ=UTC` CI 에서 9시간 밀린다.
 * 치뽀는 KST 고정 앱이므로 offset 을 붙여 준 뒤 KST 헬퍼에 넘긴다.
 *
 * @returns 「9월 22일 (화)」 · 「10월 30일 (금) 14:00」 · 읽을 수 없으면 `null`
 */

/** `'2026-09-22'` — 날짜만 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** `'2026-10-30T14:00'` · `'…T14:00:00'` — 타임존 표기가 없는 값 */
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

export function formatPostingDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null

  if (DATE_ONLY.test(value)) {
    // 🔴 요일까지만. 시각 자리는 **비워 두는 게 정확한 정보**다
    const { dateLabel } = formatStepSchedule(`${value}T00:00:00+09:00`)
    return dateLabel
  }

  const iso = NAIVE_DATETIME.test(value)
    ? `${value.length === 16 ? `${value}:00` : value}+09:00`
    : value

  const { dateLabel, timeLabel } = formatStepSchedule(iso)
  if (!dateLabel) return null
  return timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel
}
