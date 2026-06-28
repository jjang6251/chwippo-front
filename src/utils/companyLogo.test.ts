/**
 * W2 — companyLogo util spec.
 */
import { describe, expect, it } from 'vitest'
import { getFaviconUrl } from './companyLogo'

describe('getFaviconUrl', () => {
  it('domain 정상 → Google s2 URL', () => {
    expect(getFaviconUrl('toss.im')).toBe(
      'https://www.google.com/s2/favicons?domain=toss.im&sz=64',
    )
  })

  it('size 옵션 — 32, 128', () => {
    expect(getFaviconUrl('toss.im', 32)).toBe(
      'https://www.google.com/s2/favicons?domain=toss.im&sz=32',
    )
    expect(getFaviconUrl('toss.im', 128)).toBe(
      'https://www.google.com/s2/favicons?domain=toss.im&sz=128',
    )
  })

  it('https:// + www. + path 정규화', () => {
    expect(getFaviconUrl('https://www.naver.com/foo/bar')).toBe(
      'https://www.google.com/s2/favicons?domain=naver.com&sz=64',
    )
  })

  it('port 제거', () => {
    expect(getFaviconUrl('localhost:3000')).toBe(
      'https://www.google.com/s2/favicons?domain=localhost&sz=64',
    )
  })

  it('null / undefined / 빈 string → null', () => {
    expect(getFaviconUrl(null)).toBe(null)
    expect(getFaviconUrl(undefined)).toBe(null)
    expect(getFaviconUrl('')).toBe(null)
    expect(getFaviconUrl('   ')).toBe(null)
  })

  it('encodeURIComponent — 한글 도메인 안전', () => {
    expect(getFaviconUrl('한국.kr')).toBe(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent('한국.kr')}&sz=64`,
    )
  })
})
