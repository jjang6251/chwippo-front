import { describe, expect, it } from 'vitest'
import { countChars } from './charCount'

describe('countChars', () => {
  it('빈 문자열은 0', () => {
    expect(countChars('')).toEqual({ total: 0, withoutSpaces: 0 })
  })

  it('공백 포함/제외를 구분한다', () => {
    expect(countChars('안녕 하세요')).toEqual({ total: 6, withoutSpaces: 5 })
  })

  it('줄바꿈·탭도 공백으로 처리한다', () => {
    expect(countChars('a\nb\tc d')).toEqual({ total: 7, withoutSpaces: 4 })
  })

  it('연속 공백도 모두 센다', () => {
    expect(countChars('   ')).toEqual({ total: 3, withoutSpaces: 0 })
  })

  it('이모지(서로게이트 페어)를 1글자로 센다', () => {
    expect(countChars('가😀나')).toEqual({ total: 3, withoutSpaces: 3 })
  })
})
