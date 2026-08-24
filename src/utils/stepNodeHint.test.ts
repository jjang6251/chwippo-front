import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { hasSeenStepNodeHint, markStepNodeHintSeen } from './stepNodeHint'

/**
 * 스텝 노드 조작법 1회 안내의 기억.
 *
 * 🔴 **방어 분기가 이 파일의 존재 이유**다 — 저장이 안 되는 환경(사파리 프라이빗)에서
 * 어느 쪽으로 답하느냐가 「한 번 못 보는 것」과 「**보드에 들어올 때마다 보는 것**」을 가른다.
 * 후자가 훨씬 나쁘므로 판정 불가 시 「이미 봤음」으로 답한다 (`researchIntro` 와 같은 판단).
 */
describe('utils/stepNodeHint — 노드 안내 1회 노출 기억', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  const U = 'user-1'

  it('기록 없음 → 아직 안 봤다 (뜬다)', () => {
    expect(hasSeenStepNodeHint(U)).toBe(false)
  })

  it('기록 후 → 봤다 (안 뜬다)', () => {
    markStepNodeHintSeen(U)
    expect(hasSeenStepNodeHint(U)).toBe(true)
  })

  it('🔴 사용자별로 독립 — 한 기기에서 계정을 바꾸면 새 계정은 안내를 받는다', () => {
    markStepNodeHintSeen(U)
    expect(hasSeenStepNodeHint('user-2')).toBe(false)
  })

  it('🔴 userId 없음(로딩 중·비로그인) → 「봤음」 — 판정 못 할 때 띄우지 않는다', () => {
    expect(hasSeenStepNodeHint(undefined)).toBe(true)
    // 기록도 하지 않는다 — 누구의 기억인지 모르는 채로 키를 만들면 안 된다
    markStepNodeHintSeen(undefined)
    expect(localStorage.length).toBe(0)
  })

  it('🔴 storage 접근 불가 → 「봤음」 · save 는 던지지 않는다 (프라이빗 모드)', () => {
    const err = new Error('SecurityError')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw err })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw err })
    expect(hasSeenStepNodeHint(U)).toBe(true)
    expect(() => markStepNodeHintSeen(U)).not.toThrow()
  })

  it('두 번 기록해도 탈 없다 (멱등)', () => {
    markStepNodeHintSeen(U)
    markStepNodeHintSeen(U)
    expect(hasSeenStepNodeHint(U)).toBe(true)
    expect(localStorage.length).toBe(1)
  })
})
