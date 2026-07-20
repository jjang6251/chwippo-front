import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  DART_EXPANDED_STORAGE_KEY,
  loadDartExpanded,
  saveDartExpanded,
} from './dartCollapse'

describe('utils/dartCollapse — DART 섹션 펼침 기억', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('기본값 = false (접힘) — 저장된 값 없음', () => {
    expect(loadDartExpanded()).toBe(false)
  })

  it('save(true) → load true', () => {
    saveDartExpanded(true)
    expect(localStorage.getItem(DART_EXPANDED_STORAGE_KEY)).toBe('1')
    expect(loadDartExpanded()).toBe(true)
  })

  it('save(false) → load false', () => {
    saveDartExpanded(true)
    saveDartExpanded(false)
    expect(localStorage.getItem(DART_EXPANDED_STORAGE_KEY)).toBe('0')
    expect(loadDartExpanded()).toBe(false)
  })

  it('잘못된 값 저장돼 있으면 false 로 취급', () => {
    localStorage.setItem(DART_EXPANDED_STORAGE_KEY, 'yes')
    expect(loadDartExpanded()).toBe(false)
  })

  it('localStorage 접근 불가(프라이빗 모드 등) → load false, save 는 throw 안 함', () => {
    const err = new Error('SecurityError')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw err })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw err })
    expect(loadDartExpanded()).toBe(false)
    expect(() => saveDartExpanded(true)).not.toThrow()
  })
})
