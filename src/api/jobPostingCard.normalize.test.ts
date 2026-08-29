/**
 * 읽기 경계 정규화 — **결함 입력** 전용 spec.
 *
 * 이 응답에는 LLM 파싱 결과가 그대로 실려 온다. 「타입은 있다고 말하는데 런타임엔 없는」
 * 상태가 2026-08-01 자소서 크래시의 근본 원인이었고, 여기가 그 자리다.
 *
 * ## 케이스 목록
 *
 * **봉투 갈래**
 *  1. `{card}` → kind:'card'
 *  2. `{needs:'job', hash, candidates}` → kind:'needs'
 *  3. `{needs:'company', hash}` → candidates 는 빈 배열로 채워진다
 *  4. `{notPosting:true}` → kind:'notPosting'
 *  5. `{blocked:true, code}` → kind:'blocked' + code 보존
 *  6. 🔴 모르는 code → 'ERROR' 로 접는다 (모르는 이유를 소진으로 말하지 않는다)
 *  7. 🔴 `needs` 인데 hash 가 없다 → blocked/ERROR (물어볼 수 없는 질문은 안 띄운다)
 *  8. 🔴 null·문자열·빈 객체·알 수 없는 모양 → blocked/ERROR (생성 중 카드가 영원히 돌면 안 된다)
 *  9. 우선순위: blocked > notPosting > needs > card
 *
 * **카드 정규화**
 * 10. steps 가 배열이 아니면 `[]`
 * 11. steps 안의 쓰레기 원소는 버린다 (id·name 없는 것)
 * 12. 문자열이 아닌 값은 null (jobTitle·dateHint·location…)
 * 13. 🔴 id·companyName 이 없으면 **카드로 치지 않는다** (반쪽 카드를 보드에 얹지 않는다)
 * 14. status 가 유니온 밖이면 IN_PROGRESS
 * 15. createdVia 는 언제나 'paste_posting' (서버가 뭘 보내든 이 경로의 사실)
 *
 * **postingMeta**
 * 16. 배열 필드가 배열이 아니면 `[]` · 유니온 밖 값은 null
 * 17. extraDates 는 label·date·noteId 셋이 다 있어야 살아남는다
 * 18. callCount 가 숫자가 아니면 1
 *
 * **pending 목록**
 * 19. drafts 가 배열이 아니면 `[]`
 * 20. hash 없거나 needs 가 유니온 밖인 항목은 버린다
 */
import { describe, expect, it } from 'vitest'
import {
  normalizeFromPosting,
  normalizePendingDrafts,
  normalizePostingCard,
  normalizePostingMeta,
} from './jobPosting'

const CARD = {
  id: 'app-1',
  userId: 'u1',
  companyName: '무신사',
  jobTitle: '브랜드 마케터',
  status: 'IN_PROGRESS',
  steps: [
    { id: 's1', applicationId: 'app-1', orderIndex: 0, name: '서류 접수', scheduledDate: null },
  ],
}

describe('봉투 갈래', () => {
  it('1) card', () => {
    const r = normalizeFromPosting({ card: CARD })
    expect(r.kind).toBe('card')
    if (r.kind === 'card') expect(r.card.companyName).toBe('무신사')
  })

  it('2·3) needs — candidates 는 없으면 빈 배열', () => {
    const job = normalizeFromPosting({ needs: 'job', hash: 'h1', candidates: ['A', 'B'] })
    expect(job).toEqual({ kind: 'needs', needs: 'job', hash: 'h1', candidates: ['A', 'B'] })

    const company = normalizeFromPosting({ needs: 'company', hash: 'h2' })
    expect(company).toEqual({ kind: 'needs', needs: 'company', hash: 'h2', candidates: [] })
  })

  it('2-b) candidates 안의 비문자열은 버린다', () => {
    const r = normalizeFromPosting({ needs: 'job', hash: 'h', candidates: ['A', 3, null, 'B'] })
    if (r.kind === 'needs') expect(r.candidates).toEqual(['A', 'B'])
  })

  it('4) notPosting', () => {
    expect(normalizeFromPosting({ notPosting: true })).toEqual({ kind: 'notPosting' })
  })

  it('5·6) blocked — 모르는 code 는 ERROR 로', () => {
    expect(normalizeFromPosting({ blocked: true, code: 'QUOTA_EXCEEDED', reason: '내일 다시' })).toEqual({
      kind: 'blocked',
      code: 'QUOTA_EXCEEDED',
      reason: '내일 다시',
    })
    expect(normalizeFromPosting({ blocked: true, code: 'WAT' })).toEqual({
      kind: 'blocked',
      code: 'ERROR',
      reason: null,
    })
  })

  it('7) 🔴 needs 인데 hash 가 없으면 물어보지 않는다', () => {
    expect(normalizeFromPosting({ needs: 'company' })).toEqual({
      kind: 'blocked',
      code: 'ERROR',
      reason: null,
    })
  })

  it('8) 🔴 알 수 없는 모양은 전부 blocked/ERROR', () => {
    for (const bad of [null, undefined, 'ok', 42, {}, { card: null }, { needs: 'wat', hash: 'h' }]) {
      expect(normalizeFromPosting(bad).kind).toBe('blocked')
    }
  })

  it('9) blocked 가 다른 갈래보다 먼저다', () => {
    const r = normalizeFromPosting({ blocked: true, code: 'ERROR', notPosting: true, card: CARD })
    expect(r.kind).toBe('blocked')
  })
})

describe('카드 정규화', () => {
  it('10·11) steps — 배열이 아니면 [] · 쓰레기 원소는 버린다', () => {
    expect(normalizePostingCard({ ...CARD, steps: 'nope' })?.steps).toEqual([])
    const card = normalizePostingCard({
      ...CARD,
      steps: [null, 'x', { id: 's1', name: '서류' }, { name: '이름만' }, { id: 'no-name' }],
    })
    expect(card?.steps.map((s) => s.id)).toEqual(['s1'])
    // orderIndex 가 없으면 배열 순서를 쓴다
    expect(card?.steps[0].orderIndex).toBe(2)
  })

  it('12) 문자열이 아닌 값은 null', () => {
    const card = normalizePostingCard({
      ...CARD,
      jobTitle: 42,
      jobCategory: {},
      steps: [{ id: 's1', name: '서류', dateHint: 7, location: [] }],
    })
    expect(card?.jobTitle).toBeNull()
    expect(card?.jobCategory).toBeNull()
    expect(card?.steps[0].dateHint).toBeNull()
    expect(card?.steps[0].location).toBeNull()
  })

  it('13) 🔴 id·companyName 이 없으면 카드가 아니다', () => {
    expect(normalizePostingCard({ ...CARD, id: undefined })).toBeNull()
    expect(normalizePostingCard({ ...CARD, companyName: '' })).toBeNull()
    expect(normalizePostingCard(null)).toBeNull()
  })

  it('14·15) status 폴백 · createdVia 고정', () => {
    const card = normalizePostingCard({ ...CARD, status: 'WAT', createdVia: 'add_modal' })
    expect(card?.status).toBe('IN_PROGRESS')
    expect(card?.createdVia).toBe('paste_posting')
    expect(normalizePostingCard({ ...CARD, status: 'PASSED' })?.status).toBe('PASSED')
  })
})

describe('postingMeta', () => {
  it('16) 배열이 아니면 [] · 유니온 밖은 null', () => {
    const meta = normalizePostingMeta({
      filled: 'nope',
      editedFields: [1, 'jobTitle'],
      jobPicked: 'wat',
      companySource: 'typed',
      reviewedAt: 5,
    })
    expect(meta?.filled).toEqual([])
    expect(meta?.editedFields).toEqual(['jobTitle'])
    expect(meta?.jobPicked).toBeNull()
    expect(meta?.companySource).toBe('typed')
    expect(meta?.reviewedAt).toBeNull()
  })

  it('17) extraDates 는 세 값이 다 있어야 남는다', () => {
    const meta = normalizePostingMeta({
      extraDates: [
        { label: '발표', date: '2026-09-22T00:00:00Z', noteId: 'n1' },
        { label: '검진', date: null, noteId: 'n2' },
        { date: '2026-09-22T00:00:00Z', noteId: 'n3' },
        'nope',
      ],
    })
    expect(meta?.extraDates).toEqual([
      { label: '발표', date: '2026-09-22T00:00:00Z', noteId: 'n1' },
    ])
  })

  it('18) callCount 폴백 · orderConflict 는 true 일 때만 true · null 이면 통째로 null', () => {
    expect(normalizePostingMeta({})?.callCount).toBe(1)
    expect(normalizePostingMeta({ orderConflict: 'yes' })?.orderConflict).toBe(false)
    expect(normalizePostingMeta({ orderConflict: true })?.orderConflict).toBe(true)
    expect(normalizePostingMeta(null)).toBeNull()
    expect(normalizePostingMeta('x')).toBeNull()
  })
})

describe('pending 목록', () => {
  it('19·20) 배열 아니면 [] · 못 쓰는 항목은 버린다', () => {
    expect(normalizePendingDrafts(null)).toEqual([])
    expect(normalizePendingDrafts({ drafts: 'nope' })).toEqual([])
    expect(
      normalizePendingDrafts({
        drafts: [
          { hash: 'h1', needs: 'job', candidates: ['A'], companyName: '무신사', jobTitle: null, createdAt: 'iso' },
          { needs: 'job' },
          { hash: 'h2', needs: 'wat' },
          null,
        ],
      }),
    ).toEqual([
      {
        hash: 'h1',
        needs: 'job',
        candidates: ['A'],
        companyName: '무신사',
        jobTitle: null,
        createdAt: 'iso',
      },
    ])
  })
})
