/**
 * 템플릿 3종 spec — **템플릿이 곧 서식 가이드**라는 약속을 코드가 지키는 자리
 * (plan UX 검토 ⑧). 투어가 없으므로 이 본문이 유일한 교보재다.
 *
 * 시나리오:
 *   1  세 종류가 정확히 CS 정리 · 면접 기출 모음 · 오답 노트
 *   2  🔴 전부 tiptap 이 **버리지 않고** 그대로 여는 문서다 (노드 이름이 확장과 1:1)
 *   3  「CS 정리」 = 토글 · 형광펜 · 코드 블록 · 체크리스트
 *   4  「면접 기출 모음」 = 회사별 H2 + 질문 토글 여러 개 + 체크리스트
 *   5  「오답 노트」 = 표(헤더 있음) · 체크리스트 · 토글
 *   6  🔴 토글은 **접힌 채로** 열린다 (질문만 보여야 self-test 가 성립)
 *   7  본문이 상한(100,000자) 근처가 아니다 — 열자마자 못 쓰는 문서면 안 된다
 *   8  `templateContent` 는 서버가 그대로 저장할 JSON 문자열
 */
import { describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'
import { STUDY_NOTE_TEMPLATES, templateContent } from './studyNoteTemplates'

function open(doc: unknown) {
  return new Editor({
    extensions: buildEditorExtensions({ placeholder: 'ph' }),
    content: doc as JSONContent,
  })
}

/** 문서 안에 그 타입의 노드가 몇 개인지 */
function count(editor: Editor, type: string): number {
  let n = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) n += 1
  })
  return n
}

function hasHighlight(editor: Editor): boolean {
  let found = false
  editor.state.doc.descendants((node) => {
    if (node.marks.some((m) => m.type.name === 'highlight')) found = true
  })
  return found
}

const byTitle = (title: string) => STUDY_NOTE_TEMPLATES.find((t) => t.title === title)!

describe('studyNoteTemplates', () => {
  it('1 일곱 종류 — 순서 고정 (기존 3 + 2026-08-18 확장 4, plan §3)', () => {
    expect(STUDY_NOTE_TEMPLATES.map((t) => t.title)).toEqual([
      'CS 정리',
      '면접 기출 모음',
      '오답 노트',
      '인성 면접 답변 스크립트',
      '직무 지식 정리',
      '주간 공부 계획',
      '어학 · 자격증 대비',
    ])
  })

  it('2 🔴 tiptap 이 내용을 버리지 않고 그대로 연다', () => {
    for (const t of STUDY_NOTE_TEMPLATES) {
      const editor = open(t.doc)
      expect(editor.isEmpty, `${t.title} 이 빈 문서로 열렸다`).toBe(false)
      // 왕복해도 노드 수가 유지된다 = 알 수 없는 노드가 조용히 떨어져 나가지 않았다
      const first = JSON.stringify(editor.getJSON())
      expect(JSON.stringify(open(JSON.parse(first) as JSONContent).getJSON())).toBe(first)
    }
  })

  it('3 「CS 정리」 = 토글 · 형광펜 · 코드 블록 · 체크리스트', () => {
    const editor = open(byTitle('CS 정리').doc)
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(2)
    expect(count(editor, 'codeBlock')).toBeGreaterThanOrEqual(1)
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(3)
    expect(hasHighlight(editor)).toBe(true)
  })

  it('4 「면접 기출 모음」 = 회사별 H2 + 질문 토글 + 체크리스트', () => {
    const editor = open(byTitle('면접 기출 모음').doc)
    expect(count(editor, 'heading')).toBeGreaterThanOrEqual(2)
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(3)
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(1)
    // 질문 토글의 요약은 실제 기출 문장이다 (안내문이 아니라)
    expect(editor.getText()).toContain('Q. ')
  })

  it('5 「오답 노트」 = 표 · 체크리스트 · 토글', () => {
    const editor = open(byTitle('오답 노트').doc)
    expect(count(editor, 'table')).toBe(1)
    expect(count(editor, 'tableHeader')).toBeGreaterThanOrEqual(4)
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(2)
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(1)
  })

  /* ── 확장 4종 (2026-08-18) — IT 편향 해소가 목적이라 직군 무관 서식·방법론을 본다 ── */

  it('5a 「인성 면접 답변 스크립트」 = 단골 질문 토글 + 피드백 표 + 형광펜 + 체크', () => {
    const editor = open(byTitle('인성 면접 답변 스크립트').doc)
    // 단골 질문 4~5개가 토글로 — 접으면 그대로 모의 면접이 된다
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(4)
    expect(count(editor, 'table')).toBe(1) // 스터디 피드백
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(2)
    expect(hasHighlight(editor)).toBe(true)
    const body = editor.getText()
    // 1분 자기소개 3단 구조가 **가이드 문장으로** 들어 있다 (빈 칸만 주면 방법론이 안 전달된다)
    expect(body).toContain('현재')
    expect(body).toContain('경험')
    expect(body).toContain('연결')
  })

  it('5b 「직무 지식 정리」 = 용어 표 + 개념 토글 + 트렌드 · 🔴 비개발 예시', () => {
    const editor = open(byTitle('직무 지식 정리').doc)
    expect(count(editor, 'table')).toBe(1) // 용어 사전
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(2)
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(2)
    expect(hasHighlight(editor)).toBe(true)
    const body = editor.getText()
    // 🔴 이 템플릿의 존재 이유가 IT 편향 해소다 — 예시가 개발로 돌아가면 의미가 없다
    expect(body).toContain('마케팅')
    expect(body).toMatch(/어느 직무든|3층/)
  })

  it('5c 「주간 공부 계획」 = 요일 표(예상/실제) + 목표 체크 + 주말 점검 토글', () => {
    const editor = open(byTitle('주간 공부 계획').doc)
    expect(count(editor, 'table')).toBe(1)
    // 월~일 7행 + 헤더 = 8
    expect(count(editor, 'tableRow')).toBe(8)
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(3)
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(1)
    const body = editor.getText()
    // 🔴 예상/실제 병기가 이 플래너의 방법론이다 — 한쪽만 있으면 그냥 할 일 목록이다
    expect(body).toContain('예상')
    expect(body).toContain('실제')
  })

  it('5d 「어학 · 자격증 대비」 = 목표·전략 표 2개 + 암기 토글(플래시카드) + 체크', () => {
    const editor = open(byTitle('어학 · 자격증 대비').doc)
    expect(count(editor, 'table')).toBe(2) // 목표 · 파트별 전략
    expect(count(editor, 'details')).toBeGreaterThanOrEqual(3) // 암기 카드
    expect(count(editor, 'taskItem')).toBeGreaterThanOrEqual(2)
    // 오답 노트로 잇는 동선이 문장으로 들어 있다 (템플릿끼리 따로 놀지 않게)
    expect(editor.getText()).toContain('오답 노트')
  })

  it('5e 🔴 어떤 템플릿도 특정 회사를 준비하지 않는다 (그건 카드 준비 노트 영역)', () => {
    for (const t of STUDY_NOTE_TEMPLATES) {
      // 회사명이 **제목·설명**에 박히면 그 템플릿은 카드 영역을 빨아들이기 시작한다
      expect(`${t.title} ${t.desc}`).not.toMatch(/삼성|카카오|네이버|LG|SK|현대/)
    }
  })

  it('6 🔴 토글은 접힌 채로 열린다 (질문만 보여야 self-test)', () => {
    for (const t of STUDY_NOTE_TEMPLATES) {
      const editor = open(t.doc)
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'details') {
          expect(node.attrs.open, `${t.title} 의 토글이 펼쳐진 채다`).toBe(false)
        }
      })
    }
  })

  it('7 본문이 글자 상한 근처가 아니다', () => {
    for (const t of STUDY_NOTE_TEMPLATES) {
      expect(open(t.doc).getText().length).toBeLessThan(3_000)
    }
  })

  it('8 templateContent = 서버가 그대로 저장할 JSON 문자열', () => {
    const raw = templateContent(byTitle('CS 정리'))
    expect(typeof raw).toBe('string')
    expect((JSON.parse(raw) as { type: string }).type).toBe('doc')
  })
})
