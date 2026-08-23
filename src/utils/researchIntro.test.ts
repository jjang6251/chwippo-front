/**
 * 「보드 진입 1회 노출」 기회의 기억.
 *
 * 시나리오 (구현보다 먼저 나열):
 * 1. 처음 보는 사용자 → 아직 안 봤음 (뜰 수 있는 상태)
 * 2. 노출 기록 후 → 봤음 (기회 소진)
 * 3. 🔴 다른 사용자는 여전히 안 봤음 — 계정 전환 시 남의 기록을 물려받으면 새 계정은
 *    이 기능을 소개받지 못한 채 시작한다
 * 4. userId 없음(로그인 전·판정 불가) → 「봤음」으로 답한다 (안 뜨는 쪽) · 기록도 남기지 않는다
 * 5. 🔴 storage 읽기 불가(프라이빗 모드) → 「봤음」. 뜨는 쪽을 고르면 **보드에 들어올 때마다**
 *    3주 전 카드가 튀어나온다 — 한 번 못 보는 것보다 매번 보는 게 훨씬 나쁘다
 * 6. 쓰기 실패도 던지지 않는다 (best-effort)
 * 7. 키 관례 `chwippo:research-reveal-seen:{userId}` — 🔴 카드별 열람 기억
 *    (`chwippo:research-seen:{userId}:{appId}`)과 **다른 축**이라 섞이면 안 된다
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSeenResearchReveal, markResearchRevealSeen } from './researchIntro'
import { hasSeenResearch, markResearchSeen } from './researchSeen'

const U1 = 'user-1'
const U2 = 'user-2'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('researchIntro — 기본', () => {
  it('1) 처음 보는 사용자는 아직 안 봤음', () => {
    expect(hasSeenResearchReveal(U1)).toBe(false)
  })

  it('2) 기록하면 봤음 (기회 소진)', () => {
    markResearchRevealSeen(U1)
    expect(hasSeenResearchReveal(U1)).toBe(true)
  })

  it('3) 🔴 다른 사용자는 여전히 안 봤음 (계정 전환 시 승계 금지)', () => {
    markResearchRevealSeen(U1)
    expect(hasSeenResearchReveal(U2)).toBe(false)
  })
})

describe('researchIntro — 판정 불가는 「봤음」', () => {
  it('4) userId 없음 → true · 기록도 남기지 않는다', () => {
    expect(hasSeenResearchReveal(undefined)).toBe(true)
    markResearchRevealSeen(undefined)
    expect(localStorage.length).toBe(0)
  })

  it('5) 🔴 storage 읽기 실패(프라이빗 모드) → true (매번 뜨는 것보다 낫다)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(hasSeenResearchReveal(U1)).toBe(true)
  })

  it('6) storage 쓰기 실패도 던지지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => markResearchRevealSeen(U1)).not.toThrow()
  })
})

describe('researchIntro — 카드별 열람 기억과 다른 축', () => {
  it('7) 키 관례 — chwippo:research-reveal-seen:{userId}', () => {
    markResearchRevealSeen(U1)
    expect(localStorage.getItem('chwippo:research-reveal-seen:user-1')).not.toBeNull()
  })

  it('7-b) 🔴 카드 열람 기록이 노출 기회를 소진시키지 않는다 (그 반대도)', () => {
    markResearchSeen(U1, 'app-1')
    expect(hasSeenResearchReveal(U1)).toBe(false)

    localStorage.clear()
    markResearchRevealSeen(U1)
    expect(hasSeenResearch(U1, 'app-1')).toBe(false)
  })
})
