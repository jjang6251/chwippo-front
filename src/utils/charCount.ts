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
