/**
 * 비율 표기 — **분모가 작으면 % 를 쓰지 않는다.**
 *
 * 🔴 왜 규칙이 필요한가 (2026-08-06 확인) — `ActivationSection` 의 주차 코호트는
 * `cohortSize` 가 1~3명인 행이 흔한데 `Math.round((n/total)*100)%` 를 그대로 찍고 있었다.
 * **1명 중 1명이 `100%`** 로, 3명 중 1명이 `33%` 로 렌더된다. 그 화면은 제품 판단의 근거이고,
 * 소표본 백분율은 정확해 보이는 만큼 위험하다.
 *
 * 관측계획(`observation-plan-2026-08`)도 같은 이유로 *"% 쓰지 말 것. '9명 중 2명' 으로 말한다"*
 * 를 못 박았다. **화면마다 다른 규칙을 두지 않고** 여기 한 곳에 둔다 —
 * 사용자가 늘면 두 화면이 **함께** % 로 전환된다.
 *
 * | 분모 | 기본 | compact (표 셀) |
 * |---|---|---|
 * | 0 | `—` | `—` |
 * | < 30 | `3명 중 1명` | `1/3` |
 * | ≥ 30 | `33% (12/36)` | `33%` |
 *
 * `compact` 는 **규칙이 아니라 지면**의 문제다. 좁은 표 셀에 `3명 중 1명` 을 5열 넣으면
 * 가로 스크롤이 생긴다. 임계값과 "소표본엔 % 금지" 규칙은 두 모드가 공유한다.
 */

/**
 * % 표기를 허용하는 최소 분모.
 * 관측계획의 *"N<30 은 전수 관찰"* 기준을 그대로 쓴다 — 임의로 정한 값이 아니다.
 */
export const MIN_DENOMINATOR_FOR_PERCENT = 30

export interface ShareFormatOptions {
  /** 좁은 표 셀용 축약 (`1/3` · `33%`) */
  compact?: boolean
  /** 세는 대상의 단위. 기본 `명` */
  unit?: string
}

export function formatShare(
  numerator: number,
  denominator: number,
  { compact = false, unit = '명' }: ShareFormatOptions = {},
): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return '—'

  const n = Math.max(0, Math.trunc(numerator))
  const total = Math.trunc(denominator)

  if (total < MIN_DENOMINATOR_FOR_PERCENT) {
    return compact ? `${n}/${total}` : `${total}${unit} 중 ${n}${unit}`
  }

  const percent = Math.round((n / total) * 100)
  return compact ? `${percent}%` : `${percent}% (${n}/${total})`
}
