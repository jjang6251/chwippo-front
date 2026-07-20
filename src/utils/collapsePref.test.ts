import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  loadCollapseExpanded,
  saveCollapseExpanded,
  JOB_POSTING_EXPANDED_STORAGE_KEY,
} from './collapsePref'

const KEY = 'test:collapse:v1'

describe('utils/collapsePref — 범용 접힘 선호', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('기본값 = false (저장된 값 없음)', () => {
    expect(loadCollapseExpanded(KEY)).toBe(false)
  })

  it('save(true) → load true / save(false) → load false', () => {
    saveCollapseExpanded(KEY, true)
    expect(localStorage.getItem(KEY)).toBe('1')
    expect(loadCollapseExpanded(KEY)).toBe(true)
    saveCollapseExpanded(KEY, false)
    expect(localStorage.getItem(KEY)).toBe('0')
    expect(loadCollapseExpanded(KEY)).toBe(false)
  })

  it('키별 독립 — 서로 간섭 없음', () => {
    saveCollapseExpanded('a', true)
    saveCollapseExpanded('b', false)
    expect(loadCollapseExpanded('a')).toBe(true)
    expect(loadCollapseExpanded('b')).toBe(false)
  })

  it('잘못된 값 → false', () => {
    localStorage.setItem(KEY, 'yes')
    expect(loadCollapseExpanded(KEY)).toBe(false)
  })

  it('localStorage 접근 불가 → load false, save throw 안 함', () => {
    const err = new Error('SecurityError')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw err })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw err })
    expect(loadCollapseExpanded(KEY)).toBe(false)
    expect(() => saveCollapseExpanded(KEY, true)).not.toThrow()
  })

  it('공고 요건 키 상수', () => {
    expect(JOB_POSTING_EXPANDED_STORAGE_KEY).toBe('board:jobposting-expanded:v1')
  })
})
