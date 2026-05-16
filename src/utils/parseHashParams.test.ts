import { describe, it, expect } from 'vitest'
import { parseHashParams } from './parseHashParams'

describe('parseHashParams', () => {
  it('# prefix 있는 일반 fragment 파싱', () => {
    expect(parseHashParams('#access_token=abc&user_id=u1')).toEqual({
      access_token: 'abc',
      user_id: 'u1',
    })
  })

  it('# prefix 없는 fragment 파싱', () => {
    expect(parseHashParams('access_token=abc')).toEqual({ access_token: 'abc' })
  })

  it('빈 hash → 빈 object', () => {
    expect(parseHashParams('')).toEqual({})
    expect(parseHashParams('#')).toEqual({})
  })

  it('URL 인코딩 디코드 — 한글 nickname', () => {
    expect(parseHashParams('#user_nickname=%EA%B9%80%EC%B2%A0%EC%88%98')).toEqual({
      user_nickname: '김철수',
    })
  })

  it('URL 인코딩 디코드 — email @ 문자', () => {
    expect(parseHashParams('#user_email=test%40example.com')).toEqual({
      user_email: 'test@example.com',
    })
  })

  it('boolean 값 (needs_terms=true) 문자열로 유지', () => {
    expect(parseHashParams('#needs_terms=true')).toEqual({ needs_terms: 'true' })
  })

  it('ISO 날짜 (urlencoded :)', () => {
    expect(
      parseHashParams('#user_terms_agreed_at=2026-05-16T00%3A00%3A00.000Z'),
    ).toEqual({ user_terms_agreed_at: '2026-05-16T00:00:00.000Z' })
  })

  it('중복 키는 마지막 값 사용', () => {
    expect(parseHashParams('#a=1&a=2')).toEqual({ a: '2' })
  })

  it('값 없는 키는 빈 문자열', () => {
    expect(parseHashParams('#a=&b=v')).toEqual({ a: '', b: 'v' })
  })
})
