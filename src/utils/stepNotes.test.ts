import { describe, it, expect } from 'vitest'
import { mergePinnedIntoNotes, notesToPlainText } from './stepNotes'
import { parsePastedQuestions } from './interviewQuestionParse'

const DOC = (content: unknown[]) => JSON.stringify({ type: 'doc', content })
const P = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

describe('mergePinnedIntoNotes — 핵심 메모 → 준비 노트 lazy 병합', () => {
  it('pinned 없음(null) → notes 그대로', () => {
    expect(mergePinnedIntoNotes(null, null)).toBeNull()
    const notes = DOC([P('메모')])
    expect(mergePinnedIntoNotes(notes, null)).toBe(notes)
  })

  it('pinned 공백만 → 병합 없음 (notes 그대로)', () => {
    const notes = DOC([P('메모')])
    expect(mergePinnedIntoNotes(notes, '   \n  ')).toBe(notes)
  })

  it('pinned 있음 + notes null → 📌 문단만 있는 doc', () => {
    const out = mergePinnedIntoNotes(null, '예상 질문 정리')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 예상 질문 정리')],
    })
  })

  it('pinned 있음 + 기존 doc → 📌 문단이 맨 앞에 prepend', () => {
    const notes = DOC([P('기존 준비 내용')])
    const out = mergePinnedIntoNotes(notes, '복장 자유')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 복장 자유'), P('기존 준비 내용')],
    })
  })

  it('pinned 여러 줄 → 문단 분리, 첫 문단만 📌', () => {
    const out = mergePinnedIntoNotes(null, '1차 질문 대비\n포트폴리오 지참')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 1차 질문 대비'), P('포트폴리오 지참')],
    })
  })

  it('pinned 빈 줄 포함 → 빈 문단 보존', () => {
    const out = mergePinnedIntoNotes(null, 'a\n\nb')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 a'), { type: 'paragraph' }, P('b')],
    })
  })

  it('레거시 plain text notes(비 JSON) → 한 문단으로 뒤에 붙음', () => {
    const out = mergePinnedIntoNotes('그냥 텍스트', '핵심')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 핵심'), P('그냥 텍스트')],
    })
  })

  it('pinned 앞뒤 공백 trim 후 병합', () => {
    const out = mergePinnedIntoNotes(null, '  키워드 3개  ')
    expect(JSON.parse(out!)).toEqual({
      type: 'doc',
      content: [P('📌 키워드 3개')],
    })
  })
})

/**
 * 준비 노트 → 면접 질문 은행 다리의 **재료 추출.**
 *
 * 기본 포맷의 첫 칸이 「예상 질문 & 답변」이라 노트에 적힌 게 곧 질문 목록이다.
 * 여기서 줄이 어긋나면 붙여넣기 파서가 한 줄로 뭉치거나 빈 줄이 섞인다 —
 * 그래서 **줄 나누기**가 이 함수의 전부다.
 *
 * 시나리오:
 *   없음(null·빈 문서) → 빈 문자열 (호출부의 disabled 판정 재료)
 *   문단 여러 개 → 줄 단위
 *   불릿 목록 → 항목마다 한 줄 (컨테이너가 빈 줄을 더하지 않는다)
 *   heading → 함께 뽑는다 (미리보기가 걸러 낸다)
 *   hardBreak(shift+enter) → 줄바꿈
 *   레거시 plain text notes → 그대로
 *   파서와 이어 붙였을 때 실제로 질문이 나온다
 */
describe('notesToPlainText — 준비 노트 → plain text', () => {
  it('노트가 없으면 빈 문자열', () => {
    expect(notesToPlainText(null)).toBe('')
    expect(notesToPlainText('')).toBe('')
  })

  it('빈 문서도 빈 문자열 (버튼을 잠글 근거가 된다)', () => {
    expect(notesToPlainText(DOC([]))).toBe('')
    expect(notesToPlainText(DOC([{ type: 'paragraph' }]))).toBe('')
  })

  it('문단 여러 개 → 줄 단위', () => {
    expect(notesToPlainText(DOC([P('1분 자기소개'), P('지원 동기는?')]))).toBe(
      '1분 자기소개\n지원 동기는?',
    )
  })

  it('🔴 불릿 목록은 항목마다 한 줄 — 빈 줄이 끼지 않는다', () => {
    const doc = DOC([
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [P('협업에서 갈등을 푼 경험')] },
          { type: 'listItem', content: [P('가장 어려웠던 기술적 결정')] },
        ],
      },
    ])
    expect(notesToPlainText(doc)).toBe(
      '협업에서 갈등을 푼 경험\n가장 어려웠던 기술적 결정',
    )
  })

  it('heading 도 함께 뽑는다 (몰래 빼면 제목처럼 적은 질문이 사라진다)', () => {
    const doc = DOC([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '예상 질문 & 답변' }] },
      P('1분 자기소개'),
    ])
    expect(notesToPlainText(doc)).toBe('예상 질문 & 답변\n1분 자기소개')
  })

  it('hardBreak(shift+enter)도 줄을 나눈다', () => {
    const doc = DOC([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '첫 줄' },
          { type: 'hardBreak' },
          { type: 'text', text: '둘째 줄' },
        ],
      },
    ])
    expect(notesToPlainText(doc)).toBe('첫 줄\n둘째 줄')
  })

  it('레거시 plain text notes (JSON 아님) → 그대로', () => {
    expect(notesToPlainText('예전에 그냥 적어둔 메모')).toBe('예전에 그냥 적어둔 메모')
  })

  it('따옴표로 감싼 레거시 문자열도 살린다', () => {
    expect(notesToPlainText(JSON.stringify('감싼 메모'))).toBe('감싼 메모')
  })

  it('앞뒤 빈 문단은 다듬는다', () => {
    const doc = DOC([{ type: 'paragraph' }, P('질문'), { type: 'paragraph' }])
    expect(notesToPlainText(doc)).toBe('질문')
  })

  /** 🔴 두 함수를 따로 통과시켜 놓고 이어 붙였을 때 깨지는 게 이 다리의 실패 모드다 */
  it('🔴 붙여넣기 파서에 그대로 넣으면 질문이 된다 (번호 접두까지 떨어진다)', () => {
    const doc = DOC([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '예상 질문 & 답변' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [P('1. 1분 자기소개 해주세요')] },
          { type: 'listItem', content: [P('2) 가장 어려웠던 협업 경험은?')] },
        ],
      },
    ])
    const parsed = parsePastedQuestions(notesToPlainText(doc))
    expect(parsed.map((p) => p.text)).toEqual([
      '예상 질문 & 답변',
      '1분 자기소개 해주세요',
      '가장 어려웠던 협업 경험은?',
    ])
    expect(parsed.every((p) => p.exclude === null)).toBe(true)
  })
})
