/**
 * 「회사 알아보기」 미열람 기억.
 *
 * 시나리오 (구현보다 먼저 나열):
 * 1. 처음 보는 카드 → 미열람 (점을 띄울 상태)
 * 2. 열람 기록 후 → 열람함
 * 3. 🔴 **다른 카드는 여전히 미열람** — 기억 단위가 카드라는 게 이 신호의 전부다
 * 4. 🔴 **다른 사용자는 여전히 미열람** — 계정 전환 시 남의 기록을 물려받으면 안 된다
 * 5. userId 없음(판정 불가) → 「열람함」으로 답한다 (점을 안 띄우는 쪽이 안전)
 * 6. 🔴 storage 접근 불가(프라이빗 모드) → 「열람함」. 저장이 안 되는 환경에서 점을 띄우면
 *    **영원히 안 사라지는 점**이 된다 — 피하려던 "거슬리는 벽지" 를 정확히 만든다
 * 7. 기록도 던지지 않는다 (best-effort)
 * 8. 키 네이밍은 기존 관례를 따른다 (`chwippo:{feature}:{userId}...`)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSeenResearch, markResearchSeen } from './researchSeen'

const U1 = 'user-1'
const U2 = 'user-2'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('researchSeen — 기본', () => {
  it('1) 처음 보는 카드는 미열람', () => {
    expect(hasSeenResearch(U1, 'app-1')).toBe(false)
  })

  it('2) 기록하면 열람함', () => {
    markResearchSeen(U1, 'app-1')
    expect(hasSeenResearch(U1, 'app-1')).toBe(true)
  })

  it('8) 키 네이밍 관례 — chwippo:research-seen:{userId}:{appId}', () => {
    markResearchSeen(U1, 'app-1')
    expect(localStorage.getItem('chwippo:research-seen:user-1:app-1')).not.toBeNull()
  })
})

describe('researchSeen — 독립성', () => {
  it('3) 🔴 다른 카드는 여전히 미열람 (카드별 독립)', () => {
    markResearchSeen(U1, 'app-1')
    expect(hasSeenResearch(U1, 'app-1')).toBe(true)
    expect(hasSeenResearch(U1, 'app-2')).toBe(false)
  })

  it('4) 🔴 다른 사용자는 여전히 미열람 (계정 전환 시 승계 금지)', () => {
    markResearchSeen(U1, 'app-1')
    expect(hasSeenResearch(U2, 'app-1')).toBe(false)
  })
})

describe('researchSeen — 판정 불가는 「열람함」', () => {
  it('5) userId 없음 → true · 기록도 남기지 않는다', () => {
    expect(hasSeenResearch(undefined, 'app-1')).toBe(true)
    markResearchSeen(undefined, 'app-1')
    expect(localStorage.length).toBe(0)
  })

  it('5-b) applicationId 가 비어도 같은 처리', () => {
    expect(hasSeenResearch(U1, '')).toBe(true)
    markResearchSeen(U1, '')
    expect(localStorage.length).toBe(0)
  })

  it('6) 🔴 storage 읽기 실패(프라이빗 모드) → true (영원히 안 사라지는 점 방지)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(hasSeenResearch(U1, 'app-1')).toBe(true)
  })

  it('7) storage 쓰기 실패도 던지지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => markResearchSeen(U1, 'app-1')).not.toThrow()
  })
})
