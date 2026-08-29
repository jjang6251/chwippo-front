/**
 * 「생성 중」 카드 스토어 + 실행기.
 *
 * ## 케이스 목록
 *
 * **시작 제한**
 *  1. 시작하면 parsing 엔트리가 생긴다
 *  2. 동시 3장까지 · 4번째는 'limit'
 *  3. 🔴 실패한 카드는 자리를 안 차지한다 (치우기 전이라도 다음 장을 시작할 수 있어야 한다)
 *  4. 같은 글을 1분 안에 다시 → 'duplicate'
 *  5. 🔴 엔트리를 지워도 해시는 1분간 남는다 (완성돼 사라진 직후 재붙여넣기 차단)
 *  6. 1분이 지나면 다시 허용
 *  7. 글이 다르면 통과
 *
 * **결과 반영**
 *  8. needs:'company' → needs-company + hash 보관
 *  9. needs:'job' → needs-job + candidates
 * 10. notPosting → failed/not-posting
 * 11. blocked → failed/error + 서버 문구 보존
 * 12. markParsing 이 실패 상태를 되돌린다 (다시 시도)
 *
 * **복원**
 * 13. 서버 초안이 카드로 되살아난다 (needs 별 상태)
 * 14. 🔴 이미 들고 있는 hash 는 두 번 만들지 않는다
 * 15. 동시 상한을 넘겨 복원하지 않는다
 * 16. 🔴 복원된 카드엔 원문이 없다 (서버도 우리도 안 갖고 있다)
 *
 * **시트 큐**
 * 17. 한 번에 하나 — 두 번째 openSheet 는 false
 * 18. 닫으면 다음 카드가 잡을 수 있다
 *
 * **실행기**
 * 19. 파싱 성공 → completed 에 카드 + 엔트리 제거
 * 20. 마감(스텝 날짜)이 있으면 hasDeadline true
 * 21. 파싱 실패(throw) → failed/error
 * 22. 보완 답 → 🔴 **hash 만** 보낸다 (초안 본문 미전송) · 빈 값은 아예 안 싣는다
 * 23. 응답이 needs 면 다시 물음 상태로 (2차 파싱 결과가 또 부족한 경우)
 *
 * **해시**
 * 24. 같은 글은 같은 해시 · 다른 글은 다른 해시
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const parse = vi.fn()
const commit = vi.fn()
vi.mock('@/api/jobPosting', () => ({
  jobPostingCardApi: {
    parse: (...a: unknown[]) => parse(...a),
    commit: (...a: unknown[]) => commit(...a),
  },
}))

import {
  DUPLICATE_WINDOW_MS,
  hashText,
  runPostingCommit,
  runPostingParse,
  usePendingCardStore,
} from './pendingCardStore'
import type { Application } from '@/types/application'

const store = () => usePendingCardStore.getState()

function card(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    userId: 'u1',
    companyName: '무신사',
    jobTitle: '브랜드 마케터',
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

const step = (scheduledDate: string | null) => ({
  id: 's1',
  applicationId: 'app-1',
  orderIndex: 0,
  name: '서류 접수',
  scheduledDate,
  location: null,
  notes: null,
  pinnedContent: null,
})

beforeEach(() => {
  store().reset()
  parse.mockReset()
  commit.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('시작 제한', () => {
  it('1) 시작하면 parsing 엔트리가 생긴다', () => {
    const r = store().start({ rawText: '공고 A' })
    expect('tempId' in r).toBe(true)
    expect(store().entries).toHaveLength(1)
    expect(store().entries[0].status).toBe('parsing')
    expect(store().entries[0].rawText).toBe('공고 A')
  })

  it('2) 동시 3장까지 · 4번째는 limit', () => {
    store().start({ rawText: 'A' })
    store().start({ rawText: 'B' })
    store().start({ rawText: 'C' })
    expect(store().start({ rawText: 'D' })).toEqual({ rejected: 'limit' })
  })

  it('3) 🔴 실패한 카드는 자리를 차지하지 않는다', () => {
    const a = store().start({ rawText: 'A' })
    store().start({ rawText: 'B' })
    store().start({ rawText: 'C' })
    if (!('tempId' in a)) throw new Error('unreachable')
    store().fail(a.tempId, 'error')
    expect('tempId' in store().start({ rawText: 'D' })).toBe(true)
  })

  it('4·5) 같은 글은 1분 안에 못 붙인다 — 엔트리를 지워도 마찬가지', () => {
    const r = store().start({ rawText: '같은 공고' })
    if (!('tempId' in r)) throw new Error('unreachable')
    store().remove(r.tempId)
    expect(store().entries).toHaveLength(0)
    expect(store().start({ rawText: '같은 공고' })).toEqual({ rejected: 'duplicate' })
  })

  it('6) 1분이 지나면 다시 붙일 수 있다', () => {
    const t0 = 1_000_000
    store().start({ rawText: '같은 공고', now: t0 })
    expect(store().start({ rawText: '같은 공고', now: t0 + DUPLICATE_WINDOW_MS })).toEqual(
      expect.objectContaining({ tempId: expect.any(String) }),
    )
  })

  it('7) 글이 다르면 통과', () => {
    store().start({ rawText: 'A' })
    expect('tempId' in store().start({ rawText: 'B' })).toBe(true)
  })
})

describe('결과 반영', () => {
  function started() {
    const r = store().start({ rawText: '공고' })
    if (!('tempId' in r)) throw new Error('unreachable')
    return r.tempId
  }

  it('8) needs company', () => {
    const id = started()
    store().applyResult(id, { kind: 'needs', needs: 'company', hash: 'h1', candidates: [] })
    expect(store().entries[0].status).toBe('needs-company')
    expect(store().entries[0].hash).toBe('h1')
  })

  it('9) needs job', () => {
    const id = started()
    store().applyResult(id, {
      kind: 'needs',
      needs: 'job',
      hash: 'h2',
      candidates: ['사무영업(IT)'],
    })
    expect(store().entries[0].status).toBe('needs-job')
    expect(store().entries[0].candidates).toEqual(['사무영업(IT)'])
  })

  it('10) notPosting → 공고 아님', () => {
    const id = started()
    store().applyResult(id, { kind: 'notPosting' })
    expect(store().entries[0]).toMatchObject({ status: 'failed', failure: 'not-posting' })
  })

  it('11) blocked → 오류 + 서버 문구 보존', () => {
    const id = started()
    store().applyResult(id, { kind: 'blocked', code: 'QUOTA_EXCEEDED', reason: '내일 다시' })
    expect(store().entries[0]).toMatchObject({
      status: 'failed',
      failure: 'error',
      reason: '내일 다시',
    })
  })

  it('12) markParsing 이 실패를 되돌린다', () => {
    const id = started()
    store().fail(id, 'error', '앗')
    store().markParsing(id)
    expect(store().entries[0]).toMatchObject({ status: 'parsing', failure: null, reason: null })
  })
})

describe('새로고침 복원', () => {
  const draft = (hash: string, needs: 'company' | 'job') => ({
    hash,
    needs,
    candidates: needs === 'job' ? ['A', 'B'] : [],
    companyName: needs === 'job' ? '무신사' : null,
    jobTitle: null,
    createdAt: null,
  })

  it('13·16) 초안이 카드로 되살아난다 — 원문은 없다', () => {
    store().restore([draft('h1', 'company'), draft('h2', 'job')])
    expect(store().entries.map((e) => e.status)).toEqual(['needs-company', 'needs-job'])
    expect(store().entries[0].rawText).toBe('')
  })

  it('14) 🔴 이미 들고 있는 hash 는 두 번 만들지 않는다', () => {
    const r = store().start({ rawText: '공고' })
    if (!('tempId' in r)) throw new Error('unreachable')
    store().applyResult(r.tempId, { kind: 'needs', needs: 'job', hash: 'h1', candidates: [] })
    store().restore([draft('h1', 'job')])
    expect(store().entries).toHaveLength(1)
  })

  it('15) 동시 상한을 넘기지 않는다', () => {
    store().restore([draft('h1', 'job'), draft('h2', 'job'), draft('h3', 'job'), draft('h4', 'job')])
    expect(store().entries).toHaveLength(3)
  })
})

describe('결과 시트 큐', () => {
  it('17·18) 한 번에 하나 · 닫으면 다음 카드가 잡는다', () => {
    expect(store().openSheet('app-1', false)).toBe(true)
    expect(store().openSheet('app-2', false)).toBe(false)
    store().closeSheet()
    expect(store().openSheet('app-2', false)).toBe(true)
  })

  it('17-b) 시트가 어느 스코프 것인지 함께 기억한다 · 닫으면 초기화', () => {
    store().openSheet('app-1', true)
    expect(store().sheetDemo).toBe(true)
    store().closeSheet()
    expect(store().sheetAppId).toBeNull()
    expect(store().sheetDemo).toBe(false)
  })
})

/**
 * 🔴 데모와 실서비스는 **QueryClient 가 다르다** (`DemoShell` 의 별도 클라이언트).
 * 호스트도 스코프마다 하나라, 대기열에서 남의 항목을 집으면 정작 처리할 호스트에겐
 * 아무것도 안 남는다 — 2026-08-29 데모 실측 결함의 원인.
 */
describe('완료 대기열 — 스코프', () => {
  const item = (id: string, demo: boolean) => ({
    card: card({ id }),
    demo,
    hasDeadline: false,
  })

  it('25) 자기 스코프 항목만 꺼낸다 — 남의 것은 그대로 남는다', () => {
    store().pushCompleted(item('demo-1', true))
    store().pushCompleted(item('app-1', false))

    expect(store().takeCompleted(false)?.card.id).toBe('app-1')
    expect(store().completed.map((c) => c.card.id)).toEqual(['demo-1'])

    expect(store().takeCompleted(true)?.card.id).toBe('demo-1')
    expect(store().completed).toHaveLength(0)
  })

  it('26) 내 것이 없으면 null (남의 것을 대신 집지 않는다)', () => {
    store().pushCompleted(item('demo-1', true))
    expect(store().takeCompleted(false)).toBeNull()
    expect(store().completed).toHaveLength(1)
  })

  it('27) 같은 스코프가 여럿이면 들어온 순서대로', () => {
    store().pushCompleted(item('a', false))
    store().pushCompleted(item('b', false))
    expect(store().takeCompleted(false)?.card.id).toBe('a')
    expect(store().takeCompleted(false)?.card.id).toBe('b')
  })
})

describe('실행기', () => {
  function started(text = '공고 원문') {
    const r = store().start({ rawText: text })
    if (!('tempId' in r)) throw new Error('unreachable')
    return r.tempId
  }

  it('19·20) 성공 → completed 에 담기고 엔트리는 사라진다', async () => {
    parse.mockResolvedValue({ kind: 'card', card: card({ steps: [step('2026-09-15T00:00:00Z')] }) })
    const id = started()
    await runPostingParse(id, { rawText: '공고 원문' })
    expect(store().entries).toHaveLength(0)
    expect(store().completed).toHaveLength(1)
    expect(store().completed[0].hasDeadline).toBe(true)
  })

  it('20-b) 날짜가 하나도 없으면 hasDeadline false', async () => {
    parse.mockResolvedValue({ kind: 'card', card: card({ steps: [step(null)] }) })
    const id = started()
    await runPostingParse(id, { rawText: '공고 원문' })
    expect(store().completed[0].hasDeadline).toBe(false)
  })

  it('21) 요청이 터지면 「다시 시도」 상태로', async () => {
    parse.mockRejectedValue(new Error('network'))
    const id = started()
    await runPostingParse(id, { rawText: '공고 원문' })
    expect(store().entries[0]).toMatchObject({ status: 'failed', failure: 'error' })
    // 붙인 글은 그대로 있어야 다시 시도가 가능하다
    expect(store().entries[0].rawText).toBe('공고 원문')
  })

  it('22) 🔴 회사명 보완은 commit — hash 만 보내고 빈 값은 싣지 않는다', async () => {
    commit.mockResolvedValue({ kind: 'card', card: card() })
    const id = started()
    await runPostingCommit(id, { hash: 'h1', companyName: '무신사' })
    expect(commit).toHaveBeenCalledWith({ hash: 'h1', companyName: '무신사' })
    expect(parse).not.toHaveBeenCalled()
  })

  it('22-b) 🔴 직무 선택 + 원문 보유 → parse 재호출 (그 직무 기준 요건)', async () => {
    parse.mockResolvedValue({ kind: 'card', card: card() })
    const id = started('사무영업 공고 원문')
    await runPostingCommit(id, { hash: 'h1', jobContext: '사무영업(IT)' })
    expect(parse).toHaveBeenCalledWith({
      rawText: '사무영업 공고 원문',
      jobContext: '사무영업(IT)',
    })
    expect(commit).not.toHaveBeenCalled()
  })

  it('22-c) 🔴 원문이 없으면(복원 카드) commit 으로 — 서버도 원문이 없다', async () => {
    commit.mockResolvedValue({ kind: 'card', card: card() })
    store().restore([
      { hash: 'h9', needs: 'job', candidates: ['A'], companyName: null, jobTitle: null, createdAt: null },
    ])
    const id = store().entries[0].tempId
    await runPostingCommit(id, { hash: 'h9', jobContext: '사무영업(IT)' })
    expect(commit).toHaveBeenCalledWith({ hash: 'h9', jobContext: '사무영업(IT)' })
    expect(parse).not.toHaveBeenCalled()
  })

  it('23) 2차 결과가 또 부족하면 다시 물음 상태 (직무를 골랐는데 회사명이 없다)', async () => {
    // 원문이 있으므로 직무 선택은 parse 재호출 경로다 (22-b)
    parse.mockResolvedValue({ kind: 'needs', needs: 'company', hash: 'h1', candidates: [] })
    const id = started()
    await runPostingCommit(id, { hash: 'h1', jobContext: 'X' })
    expect(store().entries[0].status).toBe('needs-company')
  })
})

describe('해시', () => {
  it('24) 같은 글은 같은 해시 · 다른 글은 다르다', () => {
    expect(hashText('가나다')).toBe(hashText('가나다'))
    expect(hashText('가나다')).not.toBe(hashText('가나라'))
    expect(typeof hashText('')).toBe('string')
  })
})
