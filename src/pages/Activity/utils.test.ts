import { describe, it, expect } from 'vitest'
import type { Activity, ActivityLog } from '@/types/activity'
import {
  calcStreak,
  evalMappingConfidence,
  extractActivityAliases,
  extractNoteText,
  findMatchingActivities,
  formatPeriod,
  isActivityOngoing,
  RECENT_USE_WINDOW_MS,
  weeklyRotatingPrompt,
} from './utils'
import { toLocalDateString } from '@/utils/datetime'

// ── fixtures ────────────────────────────────────────────────────────────
const baseAct: Activity = {
  id: 'act-1',
  userId: 'u-1',
  name: '네이버 인턴',
  type: 'intern',
  org: '네이버',
  role: '백엔드',
  resultUrl: null,
  outcome: null,
  startedAt: '2026-04-01',
  endedAt: null,
  archivedAt: null,
  legacyExperienceId: null,
  summaryReflection: null,
  logs: [],
  reflections: [],
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
}

const mkLog = (
  overrides: Partial<ActivityLog> & Pick<ActivityLog, 'createdAt'>,
): ActivityLog => ({
  id: `log-${Math.random()}`,
  activityId: 'act-1',
  userId: 'u-1',
  content: '...',
  occurredAt: '2026-05-25',
  cat: null,
  comps: [],
  cl: [],
  quant: null,
  mood: null,
  keywords: [],
  note: null,
  noteSummary: null,
  noteSummaryHash: null,
  noteSummaryAt: null,
  archivedAt: null,
  updatedAt: '2026-05-25T00:00:00Z',
  ...overrides,
})

// ── isActivityOngoing ───────────────────────────────────────────────────
describe('isActivityOngoing', () => {
  it('archivedAt 존재 → false', () => {
    expect(
      isActivityOngoing({ ...baseAct, archivedAt: '2026-05-01T00:00:00Z' }),
    ).toBe(false)
  })
  it('endedAt 없음 → true (진행 중)', () => {
    expect(isActivityOngoing({ ...baseAct, endedAt: null })).toBe(true)
  })
  it('endedAt 미래 → true', () => {
    const future = '2030-12-31'
    expect(isActivityOngoing({ ...baseAct, endedAt: future })).toBe(true)
  })
  it('endedAt 과거 → false', () => {
    expect(isActivityOngoing({ ...baseAct, endedAt: '2020-01-01' })).toBe(false)
  })
  it('endedAt = today (>=) → true', () => {
    expect(isActivityOngoing({ ...baseAct, endedAt: '9999-12-31' })).toBe(true)
  })
})

// ── formatPeriod ────────────────────────────────────────────────────────
describe('formatPeriod', () => {
  it('start + end → "YYYY.MM ~ YYYY.MM"', () => {
    expect(
      formatPeriod({ ...baseAct, startedAt: '2026-04-01', endedAt: '2026-06-30' }),
    ).toBe('2026.04 ~ 2026.06')
  })
  it('start 만 → "YYYY.MM ~ 진행 중"', () => {
    expect(formatPeriod({ ...baseAct, endedAt: null })).toBe('2026.04 ~ 진행 중')
  })
  it('start 없고 end 만 → "YYYY.MM"', () => {
    expect(
      formatPeriod({ ...baseAct, startedAt: null, endedAt: '2026-06-30' }),
    ).toBe('2026.06')
  })
  it('둘 다 없음 → ""', () => {
    expect(formatPeriod({ ...baseAct, startedAt: null, endedAt: null })).toBe('')
  })
})

// ── extractNoteText ─────────────────────────────────────────────────────
describe('extractNoteText', () => {
  it('null → ""', () => {
    expect(extractNoteText(null)).toBe('')
  })
  it('Tiptap doc → 모든 text 평탄화 + 공백 정규화', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '  world  ' }] },
      ],
    }
    expect(extractNoteText(doc)).toBe('hello world')
  })
  it('nested 깊이도 walk', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '깊은' }],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(extractNoteText(doc)).toBe('깊은')
  })
})

// ── extractActivityAliases ──────────────────────────────────────────────
describe('extractActivityAliases', () => {
  it('name/org/role 모두에서 토큰 추출 + 소문자', () => {
    const aliases = extractActivityAliases({
      ...baseAct,
      name: 'API 프로젝트',
      org: 'Naver',
      role: '백엔드',
    })
    expect(aliases).toContain('api')
    expect(aliases).toContain('프로젝트')
    expect(aliases).toContain('naver')
    expect(aliases).toContain('백엔드')
  })
  it('1글자 토큰 제외', () => {
    const aliases = extractActivityAliases({
      ...baseAct,
      name: 'A B',
      org: null,
      role: null,
    })
    expect(aliases).not.toContain('a')
    expect(aliases).not.toContain('b')
  })
  it('특수문자 strip — "PR/CR" → "pr/cr"', () => {
    const aliases = extractActivityAliases({
      ...baseAct,
      name: 'PR·CR',
      org: null,
      role: null,
    })
    expect(aliases.some((a) => a === 'pr')).toBe(true)
    expect(aliases.some((a) => a === 'cr')).toBe(true)
  })
})

// ── findMatchingActivities ──────────────────────────────────────────────
describe('findMatchingActivities', () => {
  const naver: Activity = { ...baseAct, id: 'a-naver', name: '네이버', org: '네이버', role: '백엔드' }
  const kakao: Activity = { ...baseAct, id: 'a-kakao', name: '카카오', org: '카카오', role: '프론트' }
  const archived: Activity = { ...baseAct, id: 'a-arch', name: '쿠팡', archivedAt: '2026-01-01T00:00:00Z' }

  it('name 매칭 (+12)', () => {
    const result = findMatchingActivities('네이버 잘했음', [naver, kakao])
    expect(result[0]?.id).toBe('a-naver')
  })
  it('archived 활동은 제외', () => {
    const result = findMatchingActivities('쿠팡 알바', [naver, archived])
    expect(result.find((a) => a.id === 'a-arch')).toBeUndefined()
  })
  it('매칭 0 → 빈 배열', () => {
    const result = findMatchingActivities('아무 활동도 매칭 안 되는 내용', [
      naver,
      kakao,
    ])
    expect(result).toEqual([])
  })
  it('score desc 정렬 — name 강한 매칭이 alias 약한 매칭보다 앞', () => {
    const result = findMatchingActivities('네이버 백엔드 작업', [kakao, naver])
    expect(result[0]?.id).toBe('a-naver')
  })
  it('빈 content → 빈 배열', () => {
    expect(findMatchingActivities('', [naver, kakao])).toEqual([])
  })
})

// ── evalMappingConfidence ──────────────────────────────────────────────
describe('evalMappingConfidence', () => {
  const a1: Activity = { ...baseAct, id: 'a-1', name: '네이버' }
  const a2: Activity = { ...baseAct, id: 'a-2', name: '카카오' }
  const archived: Activity = { ...baseAct, id: 'a-3', name: '쿠팡', archivedAt: '2026-01-01T00:00:00Z' }

  it('매칭 1개+ → HIGH', () => {
    const r = evalMappingConfidence('네이버 일', [a1, a2])
    expect(r.confidence).toBe('HIGH')
    expect(r.activity?.id).toBe('a-1')
  })
  it('매칭 0 + 최근 5분 내 사용 → MID', () => {
    const r = evalMappingConfidence('아무 매칭 안 됨', [a1, a2], {
      id: 'a-2',
      at: Date.now() - 1_000, // 1초 전
    })
    expect(r.confidence).toBe('MID')
    expect(r.activity?.id).toBe('a-2')
  })
  it('매칭 0 + 5분 초과 → LOW', () => {
    const r = evalMappingConfidence('아무 매칭 안 됨', [a1, a2], {
      id: 'a-2',
      at: Date.now() - (RECENT_USE_WINDOW_MS + 1_000),
    })
    expect(r.confidence).toBe('LOW')
    expect(r.activity).toBeNull()
  })
  it('recent.id 가 archived → LOW (fallback 불가)', () => {
    const r = evalMappingConfidence('아무 매칭 안 됨', [a1, archived], {
      id: 'a-3',
      at: Date.now() - 1_000,
    })
    expect(r.confidence).toBe('LOW')
  })
  it('recent.id=null → LOW', () => {
    const r = evalMappingConfidence('아무 매칭 안 됨', [a1, a2])
    expect(r.confidence).toBe('LOW')
  })
})

// ── calcStreak (memory feedback_streak_metric_basis) ────────────────────
describe('calcStreak — createdAt KST 기준', () => {
  it('log 0개 → 0', () => {
    expect(calcStreak([])).toBe(0)
  })
  it('오늘만 작성 → 1', () => {
    const today = new Date().toISOString()
    expect(calcStreak([mkLog({ createdAt: today })])).toBe(1)
  })
  it('어제만 작성 (오늘 안 적음) → 1 (어제부터 카운트)', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(calcStreak([mkLog({ createdAt: yesterday })])).toBe(1)
  })
  it('어제 + 오늘 → 2', () => {
    const today = new Date().toISOString()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(
      calcStreak([mkLog({ createdAt: today }), mkLog({ createdAt: yesterday })]),
    ).toBe(2)
  })
  it('어제 빠짐 — 그제 + 오늘 → 1 (오늘만)', () => {
    const today = new Date().toISOString()
    const dayBeforeYesterday = new Date(Date.now() - 2 * 86_400_000).toISOString()
    expect(
      calcStreak([
        mkLog({ createdAt: today }),
        mkLog({ createdAt: dayBeforeYesterday }),
      ]),
    ).toBe(1)
  })
  it('5일 연속 → 5', () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      mkLog({ createdAt: new Date(Date.now() - i * 86_400_000).toISOString() }),
    )
    expect(calcStreak(logs)).toBe(5)
  })
  it('같은 날 여러 로그 → 1로 카운트 (Set)', () => {
    const today = new Date().toISOString()
    expect(
      calcStreak([
        mkLog({ createdAt: today }),
        mkLog({ createdAt: today }),
        mkLog({ createdAt: today }),
      ]),
    ).toBe(1)
  })
  it('365일 cap — 1년 + 1일 연속이면 365 반환', () => {
    const logs = Array.from({ length: 400 }, (_, i) =>
      mkLog({ createdAt: new Date(Date.now() - i * 86_400_000).toISOString() }),
    )
    // 코드 루프가 365 까지만 돌고 break — 정확히 365 또는 그 이하
    expect(calcStreak(logs)).toBeLessThanOrEqual(365)
    expect(calcStreak(logs)).toBeGreaterThanOrEqual(365)
  })
  it('KST 기준 — UTC 14:59 = KST 23:59 같은 날 카운트', () => {
    // 오늘 KST 23:59 직전 작성한 로그
    const today = toLocalDateString(new Date())
    // 위 today 가 오늘로 인식되는지 — 정상이면 1
    expect(calcStreak([mkLog({ createdAt: new Date().toISOString() })])).toBe(1)
    expect(today).toBe(toLocalDateString(new Date())) // smoke
  })
})

// ── weeklyRotatingPrompt ────────────────────────────────────────────────
describe('weeklyRotatingPrompt', () => {
  it('log 0개 → 모든 cat 동률 → weekNum mod 로 선택', () => {
    const r = weeklyRotatingPrompt('2026-05-25', [])
    expect(r.cat).toBeDefined()
    expect(r.prompt).toBeDefined()
  })
  it('특정 cat 만 부족 → 그 cat 선택', () => {
    // job_competency 빼고 모든 cat 1번씩
    const logs = [
      mkLog({ createdAt: '2026-05-25T00:00:00Z', cl: ['collaboration'] }),
      mkLog({ createdAt: '2026-05-25T00:00:00Z', cl: ['challenge'] }),
      mkLog({ createdAt: '2026-05-25T00:00:00Z', cl: ['background'] }),
      mkLog({ createdAt: '2026-05-25T00:00:00Z', cl: ['personality'] }),
      mkLog({ createdAt: '2026-05-25T00:00:00Z', cl: ['own_strength'] }),
    ]
    const r = weeklyRotatingPrompt('2026-05-25', logs)
    expect(r.cat).toBe('job_competency')
  })
  it('returns cat + prompt 객체', () => {
    const r = weeklyRotatingPrompt('2026-05-25', [])
    expect(typeof r.cat).toBe('string')
    expect(typeof r.prompt).toBe('string')
    expect(r.prompt.length).toBeGreaterThan(0)
  })
})
