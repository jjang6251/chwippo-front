/**
 * card-detail-remodel — 회사 메모 리치 에디터 유틸 (doc 기반) spec.
 * plainMemoToDoc 변환 규칙 · docHasHeading(✓/중복 가드) · sectionNodes(칩 삽입) ·
 * isEmptyDoc/docToMemoValue(빈 문서 '' — 껍데기 JSON 저장 방지) · memoCounterColor.
 */
import { describe, it, expect } from 'vitest'
import {
  MEMO_MAX,
  MEMO_SECTIONS,
  docHasHeading,
  sectionNodes,
  isEmptyDoc,
  docToMemoValue,
  memoCounterColor,
  plainMemoToDoc,
  type TiptapDoc,
} from './memoSections'

const H3 = (text: string) => ({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] })
const P = (text?: string) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' })
const DOC = (content: unknown[]): TiptapDoc => ({ type: 'doc', content: content as never })

describe('MEMO_SECTIONS', () => {
  it('칩 3종 — 지인·인맥 제거', () => {
    expect(MEMO_SECTIONS).toEqual(['왜 이 회사?', '연봉·처우', '면접 분위기'])
    expect(MEMO_SECTIONS).not.toContain('지인·인맥')
  })
  it('MEMO_MAX = 2000', () => expect(MEMO_MAX).toBe(2000))
})

describe('plainMemoToDoc — legacy plain → doc', () => {
  it('빈 값 / null → 빈 문서(빈 paragraph)', () => {
    expect(plainMemoToDoc('')).toEqual(DOC([P()]))
    expect(plainMemoToDoc(null)).toEqual(DOC([P()]))
    expect(plainMemoToDoc('   \n  ')).toEqual(DOC([P()]))
  })

  it('이미 tiptap doc JSON → 그대로', () => {
    const doc = DOC([H3('왜 이 회사?'), P('성장성')])
    expect(plainMemoToDoc(JSON.stringify(doc))).toEqual(doc)
  })

  it('plain 여러 줄 → paragraph', () => {
    expect(plainMemoToDoc('첫 줄\n둘째 줄')).toEqual(DOC([P('첫 줄'), P('둘째 줄')]))
  })

  it('[제목] 단독 줄 → H3 heading (칩 삽입 legacy 포함)', () => {
    expect(plainMemoToDoc('[왜 이 회사?]')).toEqual(DOC([H3('왜 이 회사?')]))
  })

  it('[제목] 혼합 — heading + 문단 + 빈 줄 보존', () => {
    const out = plainMemoToDoc('[왜 이 회사?]\n성장성이 좋다\n\n[연봉·처우]\n초봉 5000')
    expect(out).toEqual(DOC([
      H3('왜 이 회사?'),
      P('성장성이 좋다'),
      P(),
      H3('연봉·처우'),
      P('초봉 5000'),
    ]))
  })

  it('본문 중간에 [ ] 든 일반 문장은 heading 오변환 금지 (줄 전체가 [...] 일 때만)', () => {
    expect(plainMemoToDoc('연봉은 [비공개] 입니다')).toEqual(DOC([P('연봉은 [비공개] 입니다')]))
    expect(plainMemoToDoc('[a] [b]')).toEqual(DOC([P('[a] [b]')]))
    expect(plainMemoToDoc('앞 [태그]')).toEqual(DOC([P('앞 [태그]')]))
  })

  it('괄호 안이 공백뿐인 단독 줄([ ] 체크박스 마커)은 문단 — 빈 text 노드 heading 은 ProseMirror 크래시', () => {
    expect(plainMemoToDoc('[ ]')).toEqual(DOC([P('[ ]')]))
    expect(plainMemoToDoc('[  ]')).toEqual(DOC([P('[  ]')]))
  })

  it('JSON.parse 되지만 doc 아님 (숫자·객체) → plain 취급', () => {
    expect(plainMemoToDoc('42')).toEqual(DOC([P('42')]))
    expect(plainMemoToDoc('{"x":1}')).toEqual(DOC([P('{"x":1}')]))
  })
})

describe('docHasHeading — ✓/중복 가드', () => {
  it('같은 텍스트의 H3 있으면 true', () => {
    expect(docHasHeading(DOC([H3('왜 이 회사?'), P('x')]), '왜 이 회사?')).toBe(true)
  })
  it('H3 없거나 텍스트 다르면 false', () => {
    expect(docHasHeading(DOC([P('왜 이 회사?')]), '왜 이 회사?')).toBe(false)
    expect(docHasHeading(DOC([H3('연봉·처우')]), '왜 이 회사?')).toBe(false)
  })
  it('H2(level 2)는 heading 이어도 false (H3 만 판정)', () => {
    expect(docHasHeading(DOC([{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '왜 이 회사?' }] }]), '왜 이 회사?')).toBe(false)
  })
})

describe('sectionNodes — 칩 삽입 노드', () => {
  it('H3 heading(title) + 빈 paragraph', () => {
    expect(sectionNodes('연봉·처우')).toEqual([H3('연봉·처우'), P()])
  })
})

describe('isEmptyDoc / docToMemoValue — 껍데기 JSON 저장 방지', () => {
  it('빈 paragraph 껍데기 → isEmptyDoc true → 저장 값 ""', () => {
    const shell = DOC([P()])
    expect(isEmptyDoc(shell)).toBe(true)
    expect(docToMemoValue(shell)).toBe('')
  })
  it('빈 문단 여러 개 → true', () => {
    expect(isEmptyDoc(DOC([P(), P()]))).toBe(true)
  })
  it('텍스트 있으면 false → JSON 문자열 저장', () => {
    const doc = DOC([P('메모')])
    expect(isEmptyDoc(doc)).toBe(false)
    expect(docToMemoValue(doc)).toBe(JSON.stringify(doc))
  })
  it('H3 만 있어도 (텍스트 있음) false', () => {
    expect(isEmptyDoc(DOC([H3('왜 이 회사?')]))).toBe(false)
  })
})

describe('memoCounterColor — 90% warning · 100% danger', () => {
  it('< 90% → quaternary', () => expect(memoCounterColor(100, 2000)).toBe('text-text-quaternary'))
  it('90% 이상 → warning', () => expect(memoCounterColor(1800, 2000)).toBe('text-warning'))
  it('100% 이상 → danger', () => expect(memoCounterColor(2000, 2000)).toBe('text-danger'))
})
