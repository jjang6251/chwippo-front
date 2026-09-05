/**
 * 기간 보조 칩 프리셋 — `DurationChips` 가 시작일에 더할 개월 수.
 *
 * 실측 근거: 리크루터 지원서가 재학 기간에 「+1학기·+1년·+2년」, 복무 기간에
 * 「18·21·24개월」 칩을 둔다 (`autofill-census-2026-09.md` 「입력 UX 관찰」 #3).
 *
 * 컴포넌트 파일이 아니라 여기 두는 이유는 Fast Refresh 규칙 —
 * 컴포넌트 파일은 컴포넌트만 export 한다.
 */
export interface DurationPreset {
  label: string
  months: number
}

/** 학력 — 학기·학년 단위 */
export const SEMESTER_PRESETS: readonly DurationPreset[] = [
  { label: '+1학기', months: 6 },
  { label: '+1년', months: 12 },
  { label: '+2년', months: 24 },
]

/** 병역 — 육·해·공 복무 개월 */
export const MILITARY_PRESETS: readonly DurationPreset[] = [
  { label: '18개월', months: 18 },
  { label: '21개월', months: 21 },
  { label: '24개월', months: 24 },
]
