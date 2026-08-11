/**
 * 「면접 보기」 시험 문제 산출 — **D3 의 심장.**
 *
 * 이 함수가 틀리면 사용자는 "설정한 것과 다른 시험" 을 보는데, 화면에는 아무 에러도 안 뜬다.
 * 그래서 순서까지 단언한다 — 셔플은 `rng` 주입으로 재현한다.
 *
 * 시나리오:
 *  A. 대상·필터
 *   A1. 🔴 꼬리질문(depth≠0)은 후보에서 빠진다 — 부모 답변을 파고든 거라 혼자 물으면 맥락이 없다
 *   A2. source `both` = 전부
 *   A3. source `user` = 내 질문만
 *   A4. source `ai` = AI 질문만
 *   A5. scope `must` = ⭐ 우선만
 *   A6. scope `again` = 지난 연습 「다시」만 (good·soso·미연습 제외)
 *   A7. category 지정 = 그 유형만
 *   A8. 🔴 scope 와 category 는 **AND**
 *   A9. category `null` = 전체 (미분류도 포함 — 「미분류만」이 아니다)
 *  B. 차례(sequence)
 *   B1. 세션 목록과 같은 **흐름 순** (자기소개 → … → 마지막 한마디)
 *   B2. 미분류는 fallback(40) 자리 — 중간
 *   B3. 같은 흐름값이면 `orderIndex` 오름차순
 *  C. 올랜덤(random)
 *   C1. 고정 rng 로 순서가 재현된다
 *   C2. 원소 집합은 그대로 (분실·중복 없음)
 *  D. 실전 흐름(flow)
 *   D1. 블록은 아크 순 (자기소개 블록 전체가 마지막 한마디 블록보다 앞)
 *   D2. 블록 **안**은 셔플된다 (고정 rng 로 재현)
 *   D3. 🔴 미분류는 전체의 25%~75% 구간에 들어간다
 *   D4. 🔴 **끝 몰빵 회귀** — 마지막 문항이 미분류가 아니다
 *   D5. 미분류 여러 개가 서로 붙지 않는다 (산개)
 *   D6. 전부 미분류면 사실상 무작위 (집합·길이 유지)
 *  E. 상한(count)
 *   E1. sequence + 10 = 흐름 순 앞 10개
 *   E2. random + 10 = 셔플 후 앞 10개
 *   E3. 🔴 flow + 10 = 블록 비례 추출 — **한 유형도 전멸하지 않는다**
 *   E4. flow + 10 이어도 아크 순은 유지된다
 *   E5. 후보가 상한보다 적으면 전량
 *   E6. count `all` = 전량
 *   E7. 🔴 **10·20 리터럴이 아니라 임의의 number** — 설정에 「직접 입력」이 생겼다.
 *       경계 1 · M · M+1 에서 결과는 언제나 `min(count, M)` 이다 (1 미만·M 초과 같은
 *       입력 검사는 고르는 자리의 몫이고, 여기는 **자르기만** 한다)
 *  F. 빈 결과
 *   F1. 조건에 맞는 질문이 없으면 []
 *   F2. 질문 자체가 0개면 []
 *  G. 순수성
 *   G1. 입력 배열을 건드리지 않는다 (in-place sort 회귀)
 */
import { describe, expect, it } from 'vitest'
import {
  buildExamQuestions,
  compareByInterviewFlow,
  filterExamQuestions,
} from './practiceExam'
import type { ExamSettings } from './practiceExam'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

const q = (
  over: Partial<InterviewPrepQuestion> & { id: string },
): InterviewPrepQuestion => ({
  sessionId: 's-1',
  parentQuestionId: null,
  depth: 0,
  orderIndex: 0,
  category: null,
  mustPrepare: false,
  followupBasis: null,
  questionText: `질문 ${over.id}`,
  suggestedAnswer: null,
  materialGap: null,
  sourceLogIds: [],
  myMemo: null,
  source: 'ai',
  lastPracticedAt: null,
  lastPracticeResult: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  children: [],
  ...over,
})

const BASE: ExamSettings = {
  source: 'both',
  scope: 'all',
  category: null,
  order: 'sequence',
  count: 'all',
  timer: { mode: 'off', sec: 0 },
}
const settings = (over: Partial<ExamSettings> = {}): ExamSettings => ({
  ...BASE,
  ...over,
})

/**
 * 셔플 재현용 rng 두 개.
 * - `KEEP` — `j === i` 라 **자기 자신과 교환** = 항등 순열. 블록 배치만 보고 싶을 때.
 * - `ROTATE` — 항상 `j === 0`. `[a,b,c]` → `[b,c,a]` (직접 계산해 단언한다).
 */
const KEEP = () => 0.999
const ROTATE = () => 0

const ids = (list: InterviewPrepQuestion[]) => list.map((x) => x.id)

describe('A. 대상·필터', () => {
  const pool = [
    q({ id: 'ai-1', source: 'ai', category: 'self_intro' }),
    q({ id: 'user-1', source: 'user', category: 'failure', mustPrepare: true }),
    q({ id: 'ai-2', source: 'ai', category: 'failure', lastPracticeResult: 'again' }),
    q({ id: 'ai-3', source: 'ai', category: null, lastPracticeResult: 'good' }),
  ]

  it('A1. 🔴 꼬리질문(depth≠0)은 후보에서 빠진다', () => {
    const withFollowup = [
      ...pool,
      q({ id: 'f-1', depth: 1, parentQuestionId: 'ai-1', category: 'self_intro' }),
      q({ id: 'f-2', depth: 2, parentQuestionId: 'f-1' }),
    ]
    expect(ids(filterExamQuestions(withFollowup, settings()))).toEqual([
      'ai-1',
      'user-1',
      'ai-2',
      'ai-3',
    ])
  })

  it('A2. source both 는 전부 담는다', () => {
    expect(filterExamQuestions(pool, settings({ source: 'both' }))).toHaveLength(4)
  })

  it('A3. source user 는 내 질문만', () => {
    expect(ids(filterExamQuestions(pool, settings({ source: 'user' })))).toEqual([
      'user-1',
    ])
  })

  it('A4. source ai 는 AI 질문만', () => {
    expect(ids(filterExamQuestions(pool, settings({ source: 'ai' })))).toEqual([
      'ai-1',
      'ai-2',
      'ai-3',
    ])
  })

  it('A5. scope must 는 ⭐ 우선만', () => {
    expect(ids(filterExamQuestions(pool, settings({ scope: 'must' })))).toEqual([
      'user-1',
    ])
  })

  it('A6. scope again 은 「다시」만 — good·soso·미연습은 빠진다', () => {
    const mixed = [
      ...pool,
      q({ id: 'soso-1', lastPracticeResult: 'soso' }),
      q({ id: 'again-2', lastPracticeResult: 'again' }),
    ]
    expect(ids(filterExamQuestions(mixed, settings({ scope: 'again' })))).toEqual([
      'ai-2',
      'again-2',
    ])
  })

  it('A7. category 를 고르면 그 유형만', () => {
    expect(
      ids(filterExamQuestions(pool, settings({ category: 'failure' }))),
    ).toEqual(['user-1', 'ai-2'])
  })

  it('A8. 🔴 scope 와 category 는 AND 로 겹쳐 걸린다', () => {
    expect(
      ids(
        filterExamQuestions(
          pool,
          settings({ scope: 'must', category: 'failure' }),
        ),
      ),
    ).toEqual(['user-1'])
    expect(
      filterExamQuestions(
        pool,
        settings({ scope: 'must', category: 'self_intro' }),
      ),
    ).toHaveLength(0)
  })

  it('A9. category null 은 전체다 — 미분류만 뽑는 게 아니다', () => {
    expect(filterExamQuestions(pool, settings({ category: null }))).toHaveLength(4)
  })
})

describe('B. 차례(sequence) — 세션 목록과 같은 순서', () => {
  /** 일부러 뒤집어 넣는다 — `orderIndex` 순으로 회귀하면 B1 이 먼저 깨진다 */
  const pool = [
    q({ id: 'closing', category: 'closing_remark', orderIndex: 0 }),
    q({ id: 'failure', category: 'failure', orderIndex: 1 }),
    q({ id: 'loose', category: null, orderIndex: 2 }),
    q({ id: 'coverletter', category: 'coverletter_based', orderIndex: 3 }),
    q({ id: 'intro', category: 'self_intro', orderIndex: 4 }),
  ]

  it('B1. 자기소개(10)로 열고 마지막 한마디(99)로 닫는다', () => {
    expect(ids(buildExamQuestions(pool, settings({ order: 'sequence' })))).toEqual([
      'intro',
      'coverletter',
      'loose',
      'failure',
      'closing',
    ])
  })

  it('B2. 미분류는 fallback(40) 자리 — 자소서 기반(30)과 실패 극복(50) 사이', () => {
    const out = ids(buildExamQuestions(pool, settings({ order: 'sequence' })))
    expect(out.indexOf('loose')).toBeGreaterThan(out.indexOf('coverletter'))
    expect(out.indexOf('loose')).toBeLessThan(out.indexOf('failure'))
  })

  it('B3. 같은 흐름값이면 orderIndex 오름차순', () => {
    const same = [
      q({ id: 'b', category: 'self_intro', orderIndex: 5 }),
      q({ id: 'a', category: 'self_intro', orderIndex: 2 }),
      q({ id: 'c', category: 'self_intro', orderIndex: 9 }),
    ]
    expect(ids(buildExamQuestions(same, settings({ order: 'sequence' })))).toEqual([
      'a',
      'b',
      'c',
    ])
    // 목록(`InterviewSessionPage`)이 쓰는 비교 함수와 같은 것임을 못박는다
    expect(ids([...same].sort(compareByInterviewFlow))).toEqual(['a', 'b', 'c'])
  })
})

describe('C. 올랜덤(random)', () => {
  const pool = ['a', 'b', 'c', 'd'].map((id, i) =>
    q({ id, category: 'self_intro', orderIndex: i }),
  )

  it('C1. 고정 rng 면 순서가 재현된다', () => {
    expect(
      ids(buildExamQuestions(pool, settings({ order: 'random' }), ROTATE)),
    ).toEqual(['b', 'c', 'd', 'a'])
  })

  it('C2. 섞어도 원소는 그대로 (분실·중복 없음)', () => {
    const out = buildExamQuestions(pool, settings({ order: 'random' }), ROTATE)
    expect([...ids(out)].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

/**
 * 🔴 실전 흐름은 「아크 순 블록 + 블록 내 셔플 + 미분류 중반 분산」이다.
 * 픽스처: 자기소개(10) 3 · 실패 극복(50) 3 · 마지막 한마디(99) 3 + 미분류 3 = 12개.
 */
describe('D. 실전 흐름(flow)', () => {
  const block = (cat: string | null, prefix: string) =>
    [0, 1, 2].map((i) =>
      q({ id: `${prefix}${i + 1}`, category: cat, orderIndex: i }),
    )
  const pool = [
    ...block('self_intro', 'i'),
    ...block('failure', 'f'),
    ...block('closing_remark', 'c'),
    ...block(null, 'x'),
  ]
  const flow = (rng: () => number) =>
    buildExamQuestions(pool, settings({ order: 'flow' }), rng)

  it('D1. 블록은 아크 순 — 자기소개가 전부 마지막 한마디보다 앞', () => {
    const out = ids(flow(KEEP))
    const lastIntro = Math.max(...['i1', 'i2', 'i3'].map((id) => out.indexOf(id)))
    const firstClosing = Math.min(
      ...['c1', 'c2', 'c3'].map((id) => out.indexOf(id)),
    )
    expect(lastIntro).toBeLessThan(firstClosing)
  })

  it('D2. 블록 안은 셔플된다 (고정 rng 로 재현)', () => {
    // ROTATE 는 [1,2,3] → [2,3,1]. 항등(KEEP)이면 이 단언이 깨진다 = 셔플이 사라진 것
    const out = ids(flow(ROTATE))
    expect(out.slice(0, 3)).toEqual(['i2', 'i3', 'i1'])
    expect(ids(flow(KEEP)).slice(0, 3)).toEqual(['i1', 'i2', 'i3'])
  })

  it('D3. 🔴 미분류는 전체의 25%~75% 구간에 놓인다', () => {
    const out = ids(flow(KEEP))
    const size = out.length
    for (const id of ['x1', 'x2', 'x3']) {
      const at = out.indexOf(id)
      expect(at).toBeGreaterThanOrEqual(size * 0.25)
      expect(at).toBeLessThanOrEqual(size * 0.75)
    }
  })

  it('D4. 🔴 끝 몰빵 회귀 — 마지막 문항은 미분류가 아니다', () => {
    const out = flow(KEEP)
    expect(out[out.length - 1].category).toBe('closing_remark')
    expect(out[out.length - 2].category).not.toBeNull()
  })

  it('D5. 미분류끼리 붙지 않는다 (산개)', () => {
    const out = flow(KEEP)
    const at = out
      .map((x, i) => (x.category ? -1 : i))
      .filter((i) => i >= 0)
    at.forEach((pos, i) => {
      if (i > 0) expect(pos - at[i - 1]).toBeGreaterThan(1)
    })
  })

  it('D6. 전부 미분류면 사실상 무작위 — 개수·집합은 유지된다', () => {
    const loose = block(null, 'x')
    const out = buildExamQuestions(loose, settings({ order: 'flow' }), ROTATE)
    expect(out).toHaveLength(3)
    expect([...ids(out)].sort()).toEqual(['x1', 'x2', 'x3'])
  })
})

describe('E. 상한(count)', () => {
  /** 자기소개 8 · 실패 극복 8 · 마지막 한마디 2 · 미분류 2 = 20개 */
  const many = (cat: string | null, prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) =>
      q({ id: `${prefix}${i + 1}`, category: cat, orderIndex: i }),
    )
  const pool = [
    ...many('self_intro', 'i', 8),
    ...many('failure', 'f', 8),
    ...many('closing_remark', 'c', 2),
    ...many(null, 'x', 2),
  ]

  it('E1. sequence + 10 은 흐름 순 앞 10개', () => {
    const out = ids(buildExamQuestions(pool, settings({ count: 10 })))
    expect(out).toHaveLength(10)
    expect(out.slice(0, 8)).toEqual([
      'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8',
    ])
    // 미분류(40) 가 실패 극복(50)보다 앞이므로 9·10번째는 미분류다
    expect(out.slice(8)).toEqual(['x1', 'x2'])
  })

  it('E2. random + 10 은 셔플 후 앞 10개', () => {
    const out = buildExamQuestions(
      pool,
      settings({ order: 'random', count: 10 }),
      ROTATE,
    )
    expect(out).toHaveLength(10)
    expect(new Set(ids(out)).size).toBe(10)
  })

  it('E3. 🔴 flow + 10 — 블록 비례 추출이라 한 유형도 전멸하지 않는다', () => {
    const out = buildExamQuestions(
      pool,
      settings({ order: 'flow', count: 10 }),
      KEEP,
    )
    expect(out).toHaveLength(10)
    const cats = out.map((x) => x.category)
    // 작은 블록(마지막 한마디 2개 · 미분류 2개)이 앞에서 자르는 방식이면 통째로 사라진다
    expect(cats).toContain('self_intro')
    expect(cats).toContain('failure')
    expect(cats).toContain('closing_remark')
    expect(cats).toContain(null)
  })

  it('E4. flow + 10 이어도 아크 순은 유지된다', () => {
    const out = buildExamQuestions(
      pool,
      settings({ order: 'flow', count: 10 }),
      KEEP,
    )
    const cats = out.map((x) => x.category)
    const lastIntro = cats.lastIndexOf('self_intro')
    const firstFailure = cats.indexOf('failure')
    const firstClosing = cats.indexOf('closing_remark')
    expect(lastIntro).toBeLessThan(firstFailure)
    expect(cats.lastIndexOf('failure')).toBeLessThan(firstClosing)
  })

  it('E5. 후보가 상한보다 적으면 전량 (7 < 10)', () => {
    const few = many('self_intro', 'i', 7)
    expect(buildExamQuestions(few, settings({ count: 10 }))).toHaveLength(7)
    expect(buildExamQuestions(few, settings({ count: 20 }))).toHaveLength(7)
  })

  it('E6. count all 은 전량', () => {
    expect(buildExamQuestions(pool, settings({ count: 'all' }))).toHaveLength(20)
  })

  /**
   * 🔴 「직접 입력」이 생기면서 상한이 **임의의 수**가 됐다. 화면이 M 으로 잘라 주긴 하지만
   * 그건 화면의 약속이고, 여기서 다시 자르지 않으면 화면 하나만 고쳐도 뚫린다.
   */
  describe('E7. 임의 number 상한 — 경계 1 · M · M+1', () => {
    /** M = 20 (위 pool 그대로) */
    const M = 20

    it('1 이면 정확히 1문항', () => {
      expect(buildExamQuestions(pool, settings({ count: 1 }))).toHaveLength(1)
      expect(
        buildExamQuestions(pool, settings({ order: 'random', count: 1 }), ROTATE),
      ).toHaveLength(1)
      expect(
        buildExamQuestions(pool, settings({ order: 'flow', count: 1 }), KEEP),
      ).toHaveLength(1)
    })

    it('M 이면 전량 (딱 맞을 때 하나도 빠지지 않는다)', () => {
      expect(buildExamQuestions(pool, settings({ count: M }))).toHaveLength(M)
      expect(
        buildExamQuestions(pool, settings({ order: 'flow', count: M }), KEEP),
      ).toHaveLength(M)
    })

    it('M+1 이면 min(count, M) = M 이다 (넘겨도 늘어나지 않는다)', () => {
      expect(buildExamQuestions(pool, settings({ count: M + 1 }))).toHaveLength(M)
      expect(
        buildExamQuestions(pool, settings({ order: 'random', count: 999 }), ROTATE),
      ).toHaveLength(M)
      expect(
        buildExamQuestions(pool, settings({ order: 'flow', count: M + 1 }), KEEP),
      ).toHaveLength(M)
    })

    it('17 같은 어중간한 수도 그대로 (10·20 리터럴 회귀)', () => {
      expect(buildExamQuestions(pool, settings({ count: 17 }))).toHaveLength(17)
      const flow = buildExamQuestions(
        pool,
        settings({ order: 'flow', count: 17 }),
        KEEP,
      )
      expect(flow).toHaveLength(17)
      // 블록 비례 추출이라 임의 상한에서도 한 유형이 통째로 사라지지 않는다
      expect(new Set(flow.map((x) => x.category)).size).toBe(4)
    })
  })
})

describe('F. 빈 결과', () => {
  it('F1. 조건에 맞는 질문이 없으면 빈 배열', () => {
    const pool = [q({ id: 'a', category: 'self_intro' })]
    expect(buildExamQuestions(pool, settings({ scope: 'must' }))).toEqual([])
    expect(
      buildExamQuestions(pool, settings({ order: 'flow', scope: 'again' })),
    ).toEqual([])
  })

  it('F2. 질문이 0개면 빈 배열', () => {
    expect(buildExamQuestions([], settings())).toEqual([])
    expect(buildExamQuestions([], settings({ order: 'flow' }))).toEqual([])
    expect(buildExamQuestions([], settings({ order: 'random' }))).toEqual([])
  })
})

describe('G. 순수성', () => {
  it('G1. 입력 배열을 건드리지 않는다 (in-place sort 회귀)', () => {
    const pool = [
      q({ id: 'closing', category: 'closing_remark' }),
      q({ id: 'intro', category: 'self_intro' }),
      q({ id: 'loose', category: null }),
    ]
    const before = ids(pool)
    buildExamQuestions(pool, settings({ order: 'sequence' }))
    buildExamQuestions(pool, settings({ order: 'flow' }), ROTATE)
    buildExamQuestions(pool, settings({ order: 'random' }), ROTATE)
    expect(ids(pool)).toEqual(before)
  })
})
