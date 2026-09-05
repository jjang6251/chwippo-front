export interface CharCount {
  total: number
  withoutSpaces: number
  /** UTF-8 byte 길이 (한글 3byte / 영문 1byte / 줄바꿈 1byte). 자소설닷컴·잡코리아 한국 표준 */
  bytes: number
  bytesWithoutSpaces: number
}

const encoder =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

function utf8ByteLength(text: string): number {
  if (encoder) return encoder.encode(text).length
  // SSR / Node 환경 fallback
  return unescape(encodeURIComponent(text)).length
}

/**
 * 카운터 표시 문자열 — **최소·최대를 같이** 보여준다.
 *
 * 지원서 폼(리크루터·LG)이 「0글자 입력 (최소 400 – 최대 800)」로 두 경계를 함께 보여준다.
 * 최소가 있는 문항에서 최대만 보이면 「얼마나 더 써야 하나」를 알 수 없다.
 */
export function charCounterText(current: number, max?: number, min?: number): string {
  if (max != null && min != null) return `${current}자 (최소 ${min} – 최대 ${max})`
  if (max != null) return `${current} / ${max}`
  if (min != null) return `${current}자 (최소 ${min})`
  return `${current}자`
}

/**
 * 카운터 색 판정 — 초과 danger · 최대의 90% 이상 warning · 그 외 보통.
 * 🔴 `CoverletterQuestionCard` 와 **같은 규칙**이다. 화면마다 다른 색으로 경고하면 학습이 안 된다.
 */
export function charCounterTone(current: number, max?: number): 'danger' | 'warning' | 'normal' {
  if (max == null) return 'normal'
  if (current > max) return 'danger'
  if (current >= max * 0.9) return 'warning'
  return 'normal'
}

// 공백 포함/제외 글자 수 + UTF-8 byte 수. 이모지 등 서로게이트 페어는 1글자로 센다.
export function countChars(text: string): CharCount {
  const chars = [...text]
  const withoutSpacesText = chars.filter((c) => !/\s/.test(c)).join('')
  return {
    total: chars.length,
    withoutSpaces: [...withoutSpacesText].length,
    bytes: utf8ByteLength(text),
    bytesWithoutSpaces: utf8ByteLength(withoutSpacesText),
  }
}
