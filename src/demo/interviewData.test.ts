/**
 * 데모 면접 데이터·라우팅 계약 (2026-08-09).
 *
 * 🔴 **데모가 깨지는 방식은 조용하다.** 메뉴는 보이는데 라우트가 없으면 홈으로 튕기고,
 * 라우트는 있는데 adapter 에 엔드포인트가 없으면 빈 화면 + 콘솔 에러만 남는다.
 * 둘 다 **에러 없이 "그냥 안 되는" 상태**라 눈으로 안 보이고 테스트도 잘 안 걸린다.
 * 실제로 2026-08-07 공개 이후 며칠간 그 상태로 배포돼 있었다.
 *
 * 🔴 **5개사 전수로 검사한다.** 하나만 보면 나머지 넷이 조용히 비어도 통과한다 —
 * 직군마다 사람이 손으로 쓴 데이터라 빠뜨리기 쉽다.
 */
import { describe, expect, it } from 'vitest'
import { demoAdapter } from './demoAdapter'
import {
  DEMO_COVERLETTERS,
  DEMO_INTERVIEW_QUESTIONS,
  DEMO_INTERVIEW_SESSIONS,
} from './sampleData'
import type { InternalAxiosRequestConfig } from 'axios'

async function get(url: string, params?: Record<string, unknown>) {
  const res = await demoAdapter({
    method: 'get',
    url,
    params,
  } as InternalAxiosRequestConfig)
  return (res.data as { data: unknown }).data
}

/** 세션이 있는 회사 — 직군 fork 를 전부 덮는다 */
const WITH_SESSION = [
  ['demo-a1', 'demo-is1', '카카오 백엔드', 'cs_tech'],
  ['demo-a4', 'demo-is4', '네이버 서비스기획', 'business_reasoning'],
  ['demo-a10', 'demo-is10', '아모레 브랜드마케팅', 'data_metrics'],
  ['demo-a2', 'demo-is2', '토스 프로덕트디자이너', 'portfolio_decision'],
  ['demo-a8', 'demo-is8', 'KB국민은행 금융영업', 'domain_knowledge'],
] as const

describe('데모 면접 — adapter 배선', () => {
  /**
   * 🔴 **실제 호출 형태로 부른다 — `params` 가 아니라 URL 쿼리스트링이다.**
   * `interviewPrep.ts` 는 `` `/interview-prep-sessions?applicationId=${id}` `` 로 URL 에 직접 붙인다.
   * 처음엔 이 테스트가 `params` 로 넘겨 **통과했는데 실기에서는 "세션이 없어요" 가 떴다.**
   * 내가 만든 픽스처로는 내 전제를 검증할 수 없다 — 호출하는 쪽 형태를 그대로 써야 한다.
   */
  it.each(WITH_SESSION)(
    '🔴 %s → 쿼리스트링 applicationId 로 세션이 나온다',
    async (appId) => {
      const sessions = (await get(
        `/interview-prep-sessions?applicationId=${appId}`,
      )) as unknown[]
      expect(sessions.length).toBe(1)
    },
  )

  it('axios params 형태로 와도 동작한다 (호출부가 바뀌어도 안 깨지게)', async () => {
    const sessions = (await get('/interview-prep-sessions', {
      applicationId: 'demo-a1',
    })) as unknown[]
    expect(sessions.length).toBe(1)
  })

  /**
   * 🔴 세션이 없는 회사는 **빈 배열**이어야 한다 — 빈 상태 + 만들기 CTA 가 정상 동작이고,
   * 누르면 가입 모달이 뜬다. 10개사 중 5개사가 여기 해당한다.
   */
  it.each(['demo-a3', 'demo-a5', 'demo-a7', 'demo-a9', 'demo-a11'])(
    '%s 는 세션이 없다 (빈 상태가 정상)',
    async (appId) => {
      expect(
        await get(`/interview-prep-sessions?applicationId=${appId}`),
      ).toEqual([])
    },
  )

  it.each(WITH_SESSION)(
    '🔴 %s → 세션 상세·질문 트리·자료 목록이 모두 응답한다',
    async (_appId, sid) => {
      expect(await get(`/interview-prep-sessions/${sid}`)).toBeTruthy()
      const qs = (await get(
        `/interview-prep-sessions/${sid}/questions`,
      )) as unknown[]
      expect(qs.length).toBeGreaterThan(0)
      expect(await get(`/interview-prep-sessions/${sid}/refs`)).toBeTruthy()
    },
  )

  /**
   * 🔴 **회사 조사는 `null` 이다 — 의도된 값이다.** 데모 카드의 회사는 전부 실존 기업이고,
   * 회사 조사는 앱이 "치뽀가 수집한 사실" 로 제시하는 정보라 지어내면 허위 사실이 된다.
   * 자소서 탭이 같은 이유로 이미 null 이다(`DEMO_COMPANY_RESEARCH` 주석).
   * 나중에 "비어 보이니 채우자" 는 판단이 나오면 여기서 막힌다.
   */
  it('🔴 회사 조사는 null 이다 (실존 기업 허위사실 방지 — 자소서 탭과 동일 판단)', async () => {
    expect(await get('/interview-prep-sessions/demo-is1/research')).toBeNull()
  })
})

describe('데모 면접 — 데이터가 화면 요구를 만족하는가', () => {
  it.each(WITH_SESSION)('%s — 세션이 완료 상태다', (appId) => {
    expect(DEMO_INTERVIEW_SESSIONS[appId][0].generationStatus).toBe('completed')
  })

  /**
   * 🔴 실제 생성물(운영 `technical` 세션 24문항)의 구성을 따랐다.
   * 자기소개·역질문·마지막 한마디가 빠지면 "면접 준비" 로 안 보인다.
   */
  it.each(WITH_SESSION)('🔴 %s — 필수 카테고리가 모두 있다', (_a, sid) => {
    const cats = DEMO_INTERVIEW_QUESTIONS[sid].map((x) => x.category)
    for (const c of ['self_intro', 'reverse_question', 'closing_remark']) {
      expect(cats).toContain(c)
    }
  })

  /**
   * 🔴 **직군 fork 가 실제로 갈린다는 게 5개사를 만든 이유다.**
   * 전부 같은 카테고리면 회사명만 다른 데이터가 되고, 데모를 보는 사람이
   * 자기 직무와 비슷한 걸 못 찾는다.
   */
  it.each(WITH_SESSION)(
    '🔴 %s — 직군 전용 카테고리가 들어 있다',
    (_a, sid, _n, fork) => {
      const cats = DEMO_INTERVIEW_QUESTIONS[sid].map((x) => x.category)
      expect(cats.filter((c) => c === fork).length).toBeGreaterThanOrEqual(2)
    },
  )

  it.each(WITH_SESSION)('🔴 %s — 자소서 기반 질문이 3개 이상이다', (_a, sid) => {
    const n = DEMO_INTERVIEW_QUESTIONS[sid].filter(
      (x) => x.category === 'coverletter_based',
    ).length
    expect(n).toBeGreaterThanOrEqual(3)
  })

  /**
   * 🔴 **답변을 "띄엄띄엄 일부만" 채우는 게 CEO 결정이다** (2026-08-09).
   * 전부 채우면 채울 이유가 없어 보이고, 하나도 없으면 기능이 뭔지 모른다.
   * 실제 운영 세션도 앞쪽부터 채워져 있었다 — 사람이 위에서부터 준비하기 때문.
   */
  it.each(WITH_SESSION)('🔴 %s — 답변이 앞쪽 일부에만 있다', (_a, sid) => {
    const q = DEMO_INTERVIEW_QUESTIONS[sid]
    const answered = q.filter((x) => x.suggestedAnswer !== null)
    expect(answered.length).toBeGreaterThan(0)
    expect(answered.length).toBeLessThan(q.length / 2)
    expect(Math.max(...answered.map((x) => x.orderIndex))).toBeLessThan(
      q.length / 2,
    )
  })

  /**
   * 🔴 답변 길이는 **2026-08-08 에 고친 기준**을 따른다 — 자기소개 300~350자.
   * 표본으로 삼은 운영 세션은 그 이전 것이라 470자에 "감사합니다" 로 끝난다.
   * 데모는 **지금 가입하면 받게 될 결과**를 보여줘야 한다.
   */
  it.each(WITH_SESSION)(
    '🔴 %s — 자기소개가 현재 길이·끝맺음 기준을 따른다',
    (_a, sid) => {
      const intro = DEMO_INTERVIEW_QUESTIONS[sid].find(
        (x) => x.category === 'self_intro',
      )
      const ans = intro?.suggestedAnswer
      expect(ans).toBeTruthy()
      expect(ans!.length).toBeGreaterThanOrEqual(280)
      expect(ans!.length).toBeLessThanOrEqual(400)
      expect(ans!.trimEnd().endsWith('감사합니다.')).toBe(false)
    },
  )

  it.each(WITH_SESSION)('🔴 %s — 꼬리질문이 있고 근거가 표시된다', (_a, sid) => {
    const withChildren = DEMO_INTERVIEW_QUESTIONS[sid].filter(
      (x) => x.children.length > 0,
    )
    expect(withChildren.length).toBeGreaterThan(0)
    for (const parent of withChildren) {
      for (const child of parent.children) {
        expect(child.depth).toBe(1)
        expect(child.parentQuestionId).toBe(parent.id)
        expect(child.followupBasis).not.toBeNull()
      }
    }
  })

  /**
   * 🔴 **`mustPrepare` 는 일부여야 의미가 있다.** 전부 별표면 우선순위가 사라진다.
   * 실제 면접은 4분 남짓이라 모델이 5~7개만 고른다(타입 주석 근거).
   */
  it.each(WITH_SESSION)('🔴 %s — 우선 준비 표시가 일부에만 있다', (_a, sid) => {
    const q = DEMO_INTERVIEW_QUESTIONS[sid]
    const must = q.filter((x) => x.mustPrepare)
    expect(must.length).toBeGreaterThanOrEqual(4)
    expect(must.length).toBeLessThan(q.length / 2)
  })

  it.each(WITH_SESSION)(
    '🔴 %s — 자료 참조가 그 회사 자소서를 가리킨다 (소재가 맞물려야 한다)',
    (appId) => {
      expect(DEMO_INTERVIEW_SESSIONS[appId][0].coverletterIds).toEqual(
        DEMO_COVERLETTERS[appId].map((c) => c.id),
      )
    },
  )

  it('🔴 질문 id 가 전 세션에서 유일하다 (React key 충돌 방지)', () => {
    const ids = Object.values(DEMO_INTERVIEW_QUESTIONS)
      .flat()
      .flatMap((q) => [q.id, ...q.children.map((c) => c.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
