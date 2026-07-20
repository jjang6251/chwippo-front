import { describe, it, expect } from 'vitest'
import { mergePinnedIntoNotes } from './stepNotes'

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
