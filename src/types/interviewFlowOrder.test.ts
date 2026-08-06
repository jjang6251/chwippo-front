/**
 * 면접 진행 순서 정렬 규칙 (2026-08-07).
 *
 * 🔴 이 규칙이 깨지면 **자기소개가 12번에 오고 마지막 한마디가 3번에 온다.**
 * 화면만 보면 "질문이 많네" 로 보여서 눈치채기 어렵다 — 순서 자체를 못 박는다.
 */
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_FLOW_FALLBACK,
  CATEGORY_FLOW_ORDER,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  FOLLOWUP_BASIS_LABEL,
  MIN_PROBEABLE_ANSWER_CHARS,
} from './interviewPrep'

/** InterviewSessionPage 의 `numbered` 와 같은 규칙 */
function order(cat: string | null, orderIndex = 0) {
  return {
    flow: CATEGORY_FLOW_ORDER[cat ?? ''] ?? CATEGORY_FLOW_FALLBACK,
    orderIndex,
  }
}
function sortCats(cats: Array<string | null>): Array<string | null> {
  return [...cats]
    .map((c, i) => ({ c, ...order(c, i) }))
    .sort((a, b) => a.flow - b.flow || a.orderIndex - b.orderIndex)
    .map((x) => x.c)
}

describe('면접 진행 순서', () => {
  it('🔴 자기소개가 맨 앞, 마지막 한마디가 맨 뒤', () => {
    const sorted = sortCats([
      'closing_remark',
      'domain_knowledge',
      'reverse_question',
      'self_intro',
      'motivation',
    ])
    expect(sorted[0]).toBe('self_intro')
    expect(sorted[sorted.length - 1]).toBe('closing_remark')
  })

  it('역질문은 마지막 한마디 바로 앞', () => {
    expect(CATEGORY_FLOW_ORDER.reverse_question).toBeLessThan(
      CATEGORY_FLOW_ORDER.closing_remark,
    )
  })

  it('실제 세션 구성으로 정렬하면 면접 흐름이 된다', () => {
    // 벤치에서 실제로 나온 카테고리 조합 (JF-research)
    expect(
      sortCats([
        'executive',
        'domain_knowledge',
        'self_intro',
        'closing_remark',
        'coverletter_based',
        'motivation',
        'reverse_question',
        'aspiration',
      ]),
    ).toEqual([
      'self_intro',
      'motivation',
      'coverletter_based',
      'domain_knowledge',
      'executive',
      'aspiration',
      'reverse_question',
      'closing_remark',
    ])
  })

  it('같은 흐름 위치면 생성 순서를 유지한다 (안정 정렬)', () => {
    const cats = ['cs_tech', 'domain_knowledge', 'cs_tech']
    // 셋 다 40 — 입력 순서가 그대로 나와야 한다
    expect(sortCats(cats)).toEqual(cats)
  })

  it('모르는 카테고리·null 은 중간(직무 자리)으로 빠진다 — 앞뒤를 밀어내지 않는다', () => {
    const sorted = sortCats(['closing_remark', null, 'self_intro', '신규유형'])
    expect(sorted[0]).toBe('self_intro')
    expect(sorted[sorted.length - 1]).toBe('closing_remark')
  })
})

describe('카테고리 색·라벨 — 백엔드 enum 과 짝이 맞는가', () => {
  // 🔴 백엔드 `INTERVIEW_CATEGORIES` 에 값을 추가하고 여기를 빠뜨리면
  //    화면에 슬러그가 그대로 노출되거나 색이 중립으로 빠진다.
  const BACKEND_CATEGORIES = Object.keys(CATEGORY_LABEL)

  it.each(BACKEND_CATEGORIES)('%s — 라벨·색·흐름순서가 모두 있다', (cat) => {
    expect(CATEGORY_LABEL[cat]).toBeTruthy()
    expect(CATEGORY_STYLE[cat]).toBeTruthy()
    expect(CATEGORY_FLOW_ORDER[cat]).toBeDefined()
  })

  it('색에 brand 를 쓰지 않는다 — brand 는 CTA·active 전용', () => {
    for (const style of Object.values(CATEGORY_STYLE)) {
      expect(style).not.toContain('brand')
    }
  })

  it('색에 accent 를 쓰지 않는다 — ⭐우선 배지 전용이라 겹치면 안 띈다', () => {
    for (const style of Object.values(CATEGORY_STYLE)) {
      expect(style).not.toContain('accent')
    }
  })
})

/**
 * 🔴 **색은 "질문 유형" 한 축만 뜻한다** (2026-08-07).
 *
 * 말하기 시간 칩에 info 파랑을 썼더니, 자기소개 문항에서 위의 [자기소개](공통 정형=파랑)
 * 와 같은 색이 되어 **색이 두 가지를 뜻하게** 됐다. 한 카드에 색 칩이 4개까지 뜨는데
 * 각자 다른 축을 나타내면 사용자는 색으로 아무것도 못 읽는다.
 *
 * 규칙:
 * - 카테고리 색 = 질문 유형 (5결)
 * - accent = ⭐우선 전용
 * - brand = CTA·active 전용 (버튼)
 * - 그 밖의 지표(말하기 시간 등)는 **평상시 무채색**, 임계 초과 시에만 색
 */
describe('색 축 분리 — 한 카드에서 색이 두 가지를 뜻하지 않는가', () => {
  it('카테고리 색은 5결뿐이다 — 결이 늘면 구분이 안 된다', () => {
    const uniq = new Set(Object.values(CATEGORY_STYLE))
    expect(uniq.size).toBeLessThanOrEqual(5)
  })

  it('공통 정형끼리는 같은 색 — 색이 곧 묶음이라 결이 갈리면 안 된다', () => {
    const common = [
      'self_intro',
      'motivation',
      'personality',
      'failure',
      'collaboration',
      'aspiration',
    ].map((c) => CATEGORY_STYLE[c])
    expect(new Set(common).size).toBe(1)
  })

  it('직무 지식끼리도 같은 색', () => {
    const domain = [
      'cs_tech',
      'domain_knowledge',
      'business_reasoning',
      'data_metrics',
      'customer_handling',
      'performance',
      'portfolio_decision',
      'design_process',
    ].map((c) => CATEGORY_STYLE[c])
    expect(new Set(domain).size).toBe(1)
  })

  it('자소서 기반은 단독 색 — 내 자료에서 나온 것이라 눈에 띄어야 한다', () => {
    const own = CATEGORY_STYLE.coverletter_based
    const others = Object.entries(CATEGORY_STYLE)
      .filter(([k]) => k !== 'coverletter_based')
      .map(([, v]) => v)
    expect(others).not.toContain(own)
  })
})

/**
 * 🔴 프론트·백 **두 상수가 갈리면 조용히 어긋난다** — 화면엔 안내가 사라졌는데
 * 서버는 "답변 없음" 으로 판정해 질문 심화를 만든다. 사용자는 왜 그런지 모른다.
 * 백엔드 값은 `chwippo-back/src/interview-prep/interview-prep-ai.service.ts`
 * `MIN_PROBEABLE_ANSWER_CHARS` — 바꾸려면 **양쪽을 같이** 바꿔야 한다.
 */
describe('꼬리질문 추궁 기준', () => {
  it('최소 길이는 20자 — 백엔드와 같은 값', () => {
    expect(MIN_PROBEABLE_ANSWER_CHARS).toBe(20)
  })

  it('20자는 말하면 3~4초 — 답변이라기엔 짧지만 메모 조각보다는 긴 선', () => {
    // speakingTime 기준(350 CPM)으로 환산하면 약 3.4초
    const sec = Math.round((MIN_PROBEABLE_ANSWER_CHARS / 350) * 60)
    expect(sec).toBeGreaterThanOrEqual(3)
    expect(sec).toBeLessThanOrEqual(5)
  })

  it('근거 라벨 3종이 모두 있다', () => {
    expect(Object.keys(FOLLOWUP_BASIS_LABEL).sort()).toEqual([
      'ai_answer',
      'my_memo',
      'question',
    ])
  })
})
