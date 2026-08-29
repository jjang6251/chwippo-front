/**
 * 「한 번만 하는 말들」 — NEW 알약 · 첫 열림 캡션 · 타이밍 넛지 · 마지막 모드.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *
 * **NEW 알약**
 *  1. 목록이 아직 없음(로딩) → 붙인다 (기간 안이면)
 *  2. 공고 카드 0장 + 60일 안 → 붙인다
 *  3. 공고 카드 1장 이상 → **날짜와 무관하게** 뗀다
 *  4. 소거일 당일 → 아직 붙는다 (경계 포함)
 *  5. 소거일 다음날 → 뗀다
 *  6. 🔴 **KST 2축** — UTC 로는 어제, KST 로는 소거일 다음날인 시각에 뗀다
 *  7. `postingMeta: null` 인 카드만 있으면 공고 카드가 아니다
 *
 * **1회 기억**
 *  8. 처음이면 안 봤다 · 기록 후엔 봤다
 *  9. userId 없으면 「이미 봤음」 (기록도 안 남긴다 — 익명 키가 생기면 다음 계정이 물려받는다)
 * 10. 🔴 storage 접근 불가 → 「이미 봤음」 (매번 뜨는 것보다 한 번 못 보는 게 낫다)
 * 11. 넛지도 같은 규칙 · 캡션과 **다른 키**를 쓴다 (하나 봤다고 다른 게 소진되면 안 된다)
 *
 * **마지막 모드**
 * 12. 기억이 없으면 직접 입력
 * 13. 저장한 값이 돌아온다
 * 14. 🔴 쓰레기 값·읽기 실패 → 직접 입력 (붙여넣기 칸이 먼저 열리는 쪽이 더 나쁘다)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasPostingCard,
  hasSeenPostingHint,
  hasSeenPostingNudge,
  loadAddCardMode,
  markPostingHintSeen,
  markPostingNudgeSeen,
  POSTING_NEW_DAYS,
  POSTING_NEW_UNTIL,
  POSTING_RELEASE_DATE,
  saveAddCardMode,
  shouldShowPostingNewPill,
} from './postingNew'
import { addDays } from './datetime'
import type { Application, PostingMeta } from '@/types/application'

const META: PostingMeta = {
  filled: [],
  deadlineKind: null,
  jobPicked: null,
  companySource: null,
  editedFields: [],
  reviewedAt: null,
  extraDates: [],
  callCount: 1,
}

function app(over: Partial<Application>): Application {
  return {
    id: 'a1',
    userId: 'u1',
    companyName: '무신사',
    jobTitle: null,
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

/** KST 벽시각을 실제 시각으로 고정 (UTC = KST − 9h) */
function freezeKst(ymd: string, hhmm = '12:00') {
  vi.setSystemTime(new Date(`${ymd}T${hhmm}:00+09:00`))
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('NEW 알약', () => {
  it('소거일 = 출시일 + 60일', () => {
    expect(POSTING_NEW_UNTIL).toBe(addDays(POSTING_RELEASE_DATE, POSTING_NEW_DAYS))
  })

  it('1) 목록이 아직 없으면(로딩) 기간 안에선 붙는다', () => {
    freezeKst(POSTING_RELEASE_DATE)
    expect(shouldShowPostingNewPill(undefined)).toBe(true)
  })

  it('2) 공고 카드 0장 + 기간 안 → 붙는다', () => {
    freezeKst(POSTING_RELEASE_DATE)
    expect(shouldShowPostingNewPill([app({})])).toBe(true)
  })

  it('3) 공고 카드가 있으면 기간과 무관하게 뗀다', () => {
    freezeKst(POSTING_RELEASE_DATE)
    expect(shouldShowPostingNewPill([app({ postingMeta: META })])).toBe(false)
  })

  it('4) 소거일 당일은 아직 붙는다 (경계 포함)', () => {
    freezeKst(POSTING_NEW_UNTIL, '23:59')
    expect(shouldShowPostingNewPill([])).toBe(true)
  })

  it('5) 소거일 다음날 → 뗀다', () => {
    freezeKst(addDays(POSTING_NEW_UNTIL, 1), '00:01')
    expect(shouldShowPostingNewPill([])).toBe(false)
  })

  it('6) 🔴 KST 기준으로 넘어간다 — UTC 로는 아직 소거일인 시각', () => {
    // KST 소거일+1 의 00:30 = UTC 로는 소거일 15:30 (아직 전날)
    vi.setSystemTime(new Date(`${POSTING_NEW_UNTIL}T15:30:00Z`))
    expect(shouldShowPostingNewPill([])).toBe(false)
  })

  it('7) postingMeta 가 null 인 카드는 공고 카드가 아니다', () => {
    expect(hasPostingCard([app({ postingMeta: null })])).toBe(false)
    expect(hasPostingCard([app({ postingMeta: META })])).toBe(true)
    expect(hasPostingCard(undefined)).toBe(false)
  })
})

describe('1회 기억', () => {
  it('8) 처음엔 안 봤고, 기록하면 봤다', () => {
    expect(hasSeenPostingHint('u1')).toBe(false)
    markPostingHintSeen('u1')
    expect(hasSeenPostingHint('u1')).toBe(true)
  })

  it('9) userId 가 없으면 「이미 봤음」 · 기록도 남기지 않는다', () => {
    expect(hasSeenPostingHint(undefined)).toBe(true)
    markPostingHintSeen(undefined)
    expect(localStorage.length).toBe(0)
  })

  it('10) 🔴 storage 를 못 읽으면 「이미 봤음」', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(hasSeenPostingHint('u1')).toBe(true)
    expect(hasSeenPostingNudge('u1')).toBe(true)
  })

  it('10-b) 기록이 실패해도 던지지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => markPostingHintSeen('u1')).not.toThrow()
  })

  it('11) 캡션과 넛지는 서로 다른 키다', () => {
    markPostingHintSeen('u1')
    expect(hasSeenPostingNudge('u1')).toBe(false)
    markPostingNudgeSeen('u1')
    expect(hasSeenPostingNudge('u1')).toBe(true)
  })

  it('11-b) 사용자가 다르면 기회도 다르다', () => {
    markPostingHintSeen('u1')
    expect(hasSeenPostingHint('u2')).toBe(false)
  })
})

describe('마지막 모드', () => {
  it('12) 기억이 없으면 직접 입력', () => {
    expect(loadAddCardMode('u1')).toBe('manual')
    expect(loadAddCardMode(undefined)).toBe('manual')
  })

  it('13) 저장한 값이 돌아온다', () => {
    saveAddCardMode('u1', 'posting')
    expect(loadAddCardMode('u1')).toBe('posting')
    saveAddCardMode('u1', 'manual')
    expect(loadAddCardMode('u1')).toBe('manual')
  })

  it('14) 🔴 알 수 없는 값·읽기 실패는 직접 입력으로 떨어진다', () => {
    localStorage.setItem('posting_last_mode_u1', 'garbage')
    expect(loadAddCardMode('u1')).toBe('manual')

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadAddCardMode('u1')).toBe('manual')
  })

  it('14-b) 저장 실패도 던지지 않는다 · userId 없으면 안 쓴다', () => {
    saveAddCardMode(undefined, 'posting')
    expect(localStorage.length).toBe(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => saveAddCardMode('u1', 'posting')).not.toThrow()
  })
})
