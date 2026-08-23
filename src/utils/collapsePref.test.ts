import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  loadCollapseExpanded,
  saveCollapseExpanded,
  JOB_POSTING_EXPANDED_STORAGE_KEY,
  loadExpandedIds,
  saveExpandedIds,
  COMPANY_RESEARCH_EXPANDED_STORAGE_KEY,
  coverletterExpandedKey,
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

/**
 * 🔴 **「기록 없음」과 「전부 접음」을 가르는 게 이 함수의 존재 이유**다.
 * boolean 유틸로는 못 하는 구분이고, 이걸 틀리면 자소서 첫 문항이
 * **접어도 매번 다시 펼쳐진다** (2026-08-23 CEO 실사용 지적으로 발견).
 * 방어 분기(손상된 값·storage 실패)는 **크래시를 막는 코드**인데 실행된 적이 없었다 —
 * 분기 커버리지 실측(50%)에서 드러나 여기서 채운다.
 */
describe('loadExpandedIds / saveExpandedIds', () => {
  const KEY = coverletterExpandedKey('app-1')

  it('저장값 없음 → null (「아직 안 건드림」)', () => {
    expect(loadExpandedIds(KEY)).toBeNull()
  })

  it('🔴 빈 배열은 null 이 아니다 — 「전부 접음」은 사용자의 결정이다', () => {
    saveExpandedIds(KEY, [])
    expect(loadExpandedIds(KEY)).toEqual([])
  })

  it('왕복 — 저장한 id 목록이 그대로 돌아온다', () => {
    saveExpandedIds(KEY, ['c1', 'c3'])
    expect(loadExpandedIds(KEY)).toEqual(['c1', 'c3'])
  })

  it('지원 카드별로 독립 — 회사마다 자소서가 다르다', () => {
    saveExpandedIds(coverletterExpandedKey('app-1'), ['c1'])
    saveExpandedIds(coverletterExpandedKey('app-2'), ['c9'])
    expect(loadExpandedIds(coverletterExpandedKey('app-1'))).toEqual(['c1'])
    expect(loadExpandedIds(coverletterExpandedKey('app-2'))).toEqual(['c9'])
  })

  it('🔴 손상된 JSON → null (던지면 페이지가 죽는다)', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadExpandedIds(KEY)).toBeNull()
  })

  it('🔴 배열이 아닌 값 → null (구버전·수동 편집 방어)', () => {
    localStorage.setItem(KEY, '"1"')
    expect(loadExpandedIds(KEY)).toBeNull()
  })

  it('🔴 배열 안 비문자열은 걸러낸다', () => {
    localStorage.setItem(KEY, '["c1", 3, null, "c2"]')
    expect(loadExpandedIds(KEY)).toEqual(['c1', 'c2'])
  })

  it('🔴 storage 접근 불가 → load null · save 는 던지지 않는다 (프라이빗 모드)', () => {
    const err = new Error('SecurityError')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw err })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw err })
    expect(loadExpandedIds(KEY)).toBeNull()
    expect(() => saveExpandedIds(KEY, ['c1'])).not.toThrow()
  })

  it('회사 조사 배너 키 상수', () => {
    expect(COMPANY_RESEARCH_EXPANDED_STORAGE_KEY).toBe('coverletter:research-expanded:v1')
  })
})
