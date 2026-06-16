import { describe, expect, it } from 'vitest'
import { countChars } from './charCount'

describe('countChars', () => {
  it('빈 문자열은 0', () => {
    const r = countChars('')
    expect(r.total).toBe(0)
    expect(r.withoutSpaces).toBe(0)
    expect(r.bytes).toBe(0)
    expect(r.bytesWithoutSpaces).toBe(0)
  })

  it('공백 포함/제외를 구분한다', () => {
    const r = countChars('안녕 하세요')
    expect(r.total).toBe(6)
    expect(r.withoutSpaces).toBe(5)
  })

  it('줄바꿈·탭도 공백으로 처리한다', () => {
    const r = countChars('a\nb\tc d')
    expect(r.total).toBe(7)
    expect(r.withoutSpaces).toBe(4)
  })

  it('연속 공백도 모두 센다', () => {
    const r = countChars('   ')
    expect(r.total).toBe(3)
    expect(r.withoutSpaces).toBe(0)
  })

  it('이모지(서로게이트 페어)를 1글자로 센다', () => {
    const r = countChars('가😀나')
    expect(r.total).toBe(3)
    expect(r.withoutSpaces).toBe(3)
  })

  // P1 추가 — UTF-8 byte (잡코리아·자소설닷컴 표준)
  it('UTF-8 byte — 한글 3byte', () => {
    const r = countChars('가')
    expect(r.bytes).toBe(3)
  })

  it('UTF-8 byte — 영문 1byte', () => {
    const r = countChars('hello')
    expect(r.bytes).toBe(5)
  })

  it('UTF-8 byte — 한·영 혼합 + 공백', () => {
    const r = countChars('Hi 안녕')
    expect(r.bytes).toBe('Hi '.length + 6) // 영문 1*2 + 공백 1 + 한글 3*2
    // 공백 제외 = 'Hi' 2byte + '안녕' 6byte = 8
    expect(r.bytesWithoutSpaces).toBe(8)
  })

  it('UTF-8 byte — 빈 문자열', () => {
    expect(countChars('').bytes).toBe(0)
  })
})
