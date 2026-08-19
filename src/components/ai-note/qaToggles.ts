import type { Editor } from '@tiptap/react'
import { markdownToDocNodes } from '@/components/editor/markdownIO'

/**
 * qa_toggle 액션 결과(`**Q. 질문**` / `A. 답` 텍스트)를 **진짜 토글(Details) 노드**로 조립.
 *
 * 🔴 왜 후처리인가 (2026-08-19 실측): 마크다운엔 토글 문법이 없다 — `<details>` HTML 은
 * XSS 잠금(html:false)이 평문화하고, 토글 노드를 직렬화해도 굵은 텍스트로 열화된다.
 * LLM 에게 커스텀 문법을 가르치는 것보다, 서버 프롬프트가 이미 강제하는 Q/A 패턴을
 * 여기서 결정적으로 변환하는 쪽이 확실하다 (벤치 3모델 전부 패턴 준수 실측).
 * 이게 없으면 킬러 유스케이스(토글 문답 → 읽기모드 일괄 접기 셀프테스트)가 성립하지 않는다.
 */

const Q_LINE = /^\*\*Q[.．]?\s*(.+?)\*\*\s*$/

interface QaPair {
  question: string
  answerMd: string
}

function splitPairs(markdown: string): QaPair[] {
  const lines = markdown.split('\n')
  const pairs: QaPair[] = []
  let current: { question: string; answer: string[] } | null = null

  for (const line of lines) {
    const q = Q_LINE.exec(line.trim())
    if (q) {
      if (current) pairs.push({ question: current.question, answerMd: current.answer.join('\n').trim() })
      current = { question: q[1].trim(), answer: [] }
      continue
    }
    if (current) current.answer.push(line)
  }
  if (current) pairs.push({ question: current.question, answerMd: current.answer.join('\n').trim() })

  // 답이 비어 있는 문항은 토글로 만들 가치가 없다 — 통째 스킵
  return pairs.filter((p) => p.question && p.answerMd)
}

/** 답 본문의 `A.` 접두는 토글 안에서는 군더더기 — 첫 줄에서만 벗긴다 */
function stripAnswerPrefix(md: string): string {
  return md.replace(/^A[.．]?\s*/, '')
}

/**
 * 변환 성공 시 Details 노드 배열, 패턴이 안 잡히면 null (호출부는 일반 md 경로 폴백).
 * 반환 노드는 `insertContentAt` 에 그대로 넣는 JSON 이다.
 */
export function qaMarkdownToToggleNodes(editor: Editor, markdown: string): unknown[] | null {
  const pairs = splitPairs(markdown)
  if (pairs.length === 0) return null

  return pairs.map((pair) => ({
    type: 'details',
    attrs: { open: false }, // 접힌 채 삽입 — 셀프테스트가 존재 이유다
    content: [
      { type: 'detailsSummary', content: [{ type: 'text', text: pair.question }] },
      {
        type: 'detailsContent',
        content: markdownToDocNodes(editor, stripAnswerPrefix(pair.answerMd)),
      },
    ],
  }))
}
