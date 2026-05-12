export interface CharCount {
  total: number
  withoutSpaces: number
}

// 공백 포함/제외 글자 수. 이모지 등 서로게이트 페어는 1글자로 센다.
export function countChars(text: string): CharCount {
  const chars = [...text]
  return {
    total: chars.length,
    withoutSpaces: chars.filter((c) => !/\s/.test(c)).length,
  }
}
