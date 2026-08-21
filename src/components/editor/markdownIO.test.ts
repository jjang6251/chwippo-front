/**
 * study-notes Phase 2a — 마크다운 붙여넣기·내보내기 spec.
 *
 * 시나리오 (plan §5 「마크다운」):
 *   게이트  평문 오탐 방지 — 신호 1종 이하면 파싱하지 않는다
 *   게이트  체크리스트만 있는 글이 bullet 중복 카운트로 통과하지 않는다
 *   변환    AI 답변 덩어리 — 표·체크리스트(checked)·코드 언어·인용·구분선·링크 보존
 *   붙여넣기 handleMarkdownPaste — 평문이면 미처리 / 마크다운이면 삽입
 *   잘림    글자 제한 초과 시 truncated 신호
 *   내보내기 왕복(md → doc → md) · 열화(토글=제목+본문 · 형광펜 소실 · 멘션=링크)
 */
import { describe, it, expect } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { buildEditorExtensions } from './editorExtensions'
import { STUDY_NOTE_MENTION_TYPE } from './StudyNoteMention'
import { countMarkdownSignals, looksLikeMarkdown, editorToMarkdown, handleMarkdownPaste, looksLikeCodeEditorHtml } from './markdownIO'

const make = (opts?: { characterLimit?: number; mention?: boolean; content?: JSONContent }) =>
  new Editor({
    extensions: buildEditorExtensions({
      placeholder: 'ph',
      characterLimit: opts?.characterLimit,
      mention: opts?.mention ? { items: () => [] } : undefined,
    }),
    content: opts?.content ?? null,
  })

const AI_MARKDOWN = `# 운영체제 정리

## 프로세스 vs 스레드

**프로세스**는 독립된 주소 공간을 가진다.

| 구분 | 프로세스 | 스레드 |
|------|---------|--------|
| 메모리 | 독립 | 공유 |

> 컨텍스트 스위칭은 프로세스가 더 비싸다.

\`\`\`c
if (current->ticks >= QUANTUM) { preempt(); }
\`\`\`

---

- [x] 데드락 4조건 외우기
- [ ] 스케줄링 다시 읽기

[참고 자료](https://example.com)
`

describe('붙여넣기 게이트 — 평문 오탐 방지', () => {
  it.each([
    ['평범한 한 줄 메모', 0],
    ['오늘 면접 봤다.\n분위기가 좋았다.', 0],
    ['준비할 것\n- 자소서\n- 포트폴리오', 1],
    ['1. 서류\n2. 코테\n3. 면접', 1],
    ['2 * 3 = 6 이고 5 * 2 = 10 이다', 0],
    ['연봉은 [비공개] 라고 한다', 0],
  ])('평문 %j → 신호 %i종, 파싱 안 함', (text, signals) => {
    expect(countMarkdownSignals(text)).toBe(signals)
    expect(looksLikeMarkdown(text)).toBe(false)
  })

  /** `- [x]` 는 task 와 bullet 이 동시에 걸린다 — 한 줄이 2종으로 세지면 게이트가 무의미해진다 */
  it('체크리스트만 있는 글은 통과하지 못한다 (task 가 bullet 을 겸치지 않음)', () => {
    const onlyTasks = '- [x] 자소서 초안\n- [ ] 포트폴리오'
    expect(countMarkdownSignals(onlyTasks)).toBe(1)
    expect(looksLikeMarkdown(onlyTasks)).toBe(false)
  })

  it.each([
    ['## 제목\n- 항목', 2],
    ['**굵게** 그리고 `코드`', 2],
    ['# 정리\n\n| a | b |\n|---|---|\n| 1 | 2 |', 2],
  ])('마크다운 %j → 신호 %i종 이상, 파싱', (text, signals) => {
    expect(countMarkdownSignals(text)).toBeGreaterThanOrEqual(signals)
    expect(looksLikeMarkdown(text)).toBe(true)
  })

  it('AI 답변 덩어리는 당연히 통과', () => {
    expect(looksLikeMarkdown(AI_MARKDOWN)).toBe(true)
  })

  /*
    🔴 study-note-media PR-A — `![alt](url)` 안에는 `[alt](url)` 이 그대로 들어 있어서
    이미지 한 줄이 image·link 두 신호를 켠다. task/bullet 과 같은 겹침이라 한 줄이
    게이트를 통과시키면 안 된다. 다만 **진짜 링크가 따로 있으면** 그건 별개로 센다.
  */
  it('이미지 한 줄만 붙여넣으면 통과하지 못한다 (image 가 link 를 겸치지 않음)', () => {
    const onlyImage = '![도식](https://cdn.example/x.png)'
    expect(countMarkdownSignals(onlyImage)).toBe(1)
    expect(looksLikeMarkdown(onlyImage)).toBe(false)
  })

  it('alt 없는 내보내기 형태도 1종', () => {
    expect(countMarkdownSignals('![](https://cdn.example/x.png)')).toBe(1)
  })

  it('이미지 + 진짜 링크는 2종 — 둘은 별개 신호다', () => {
    const both = '![도식](https://cdn.example/x.png)\n[참고 자료](https://example.com/doc)'
    expect(countMarkdownSignals(both)).toBe(2)
    expect(looksLikeMarkdown(both)).toBe(true)
  })

  it('이미지 + 제목은 2종 — 문서로 붙여넣으면 파싱', () => {
    expect(looksLikeMarkdown('## 회로 정리\n\n![](https://cdn.example/x.png)')).toBe(true)
  })
})

describe('마크다운 파싱 — 서식 보존', () => {
  const parsed = () => {
    const ed = make()
    const result = handleMarkdownPaste(ed, AI_MARKDOWN)
    expect(result.handled).toBe(true)
    return ed.getJSON()
  }

  const typesOf = (json: JSONContent) => {
    const found = new Set<string>()
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>
        if (typeof o.type === 'string') found.add(o.type)
        Object.values(o).forEach(walk)
      }
    }
    walk(json)
    return found
  }

  it('표·체크리스트·코드블록·인용·구분선·링크가 전부 살아난다', () => {
    const types = typesOf(parsed())
    for (const t of [
      'heading',
      'table',
      'tableHeader',
      'tableCell',
      'taskList',
      'taskItem',
      'codeBlock',
      'blockquote',
      'horizontalRule',
      'link',
      'bold',
    ]) {
      expect(types, `${t} 누락`).toContain(t)
    }
  })

  it('코드 블록의 언어가 유지된다', () => {
    const json = JSON.stringify(parsed())
    expect(json).toContain('"language":"c"')
  })

  it('체크 상태(checked)가 유지된다', () => {
    const json = JSON.stringify(parsed())
    expect(json).toContain('"checked":true')
    expect(json).toContain('"checked":false')
  })

  it('평문은 파싱하지 않고 브라우저 기본 동작에 넘긴다', () => {
    const ed = make()
    const result = handleMarkdownPaste(ed, '오늘 면접 봤다. 분위기 좋았음')
    expect(result.handled).toBe(false)
    expect(ed.isEmpty).toBe(true)
  })

  /**
   * CharacterCount 는 넘치는 만큼 잘라내고, 잘라도 넘치면 트랜잭션을 통째로 거부한다.
   * 후자는 "붙여넣었는데 아무 일도 안 일어난" 상태라 안내가 없으면 사용자가 소실을 모른다.
   */
  it('글자 제한을 넘기면 잘림(통째 거부 포함)을 알린다', () => {
    const ed = make({ characterLimit: 40 })
    const long = `## 제목\n\n${'가'.repeat(500)}\n\n- 항목`
    const result = handleMarkdownPaste(ed, long, 40)
    expect(result.handled).toBe(true)
    expect(result.truncated).toBe(true)
    expect(ed.storage.characterCount?.characters?.() ?? 0).toBeLessThanOrEqual(40)
  })

  it('제한 안이면 잘림 신호가 없다', () => {
    const ed = make({ characterLimit: 5000 })
    const result = handleMarkdownPaste(ed, '## 제목\n\n- 항목', 5000)
    expect(result).toEqual({ handled: true, truncated: false })
  })
})

describe('마크다운 내보내기', () => {
  it('왕복 — md 를 붙여넣고 다시 내보내면 핵심 서식이 살아 돌아온다', () => {
    const ed = make()
    handleMarkdownPaste(ed, AI_MARKDOWN)
    const out = editorToMarkdown(ed)

    expect(out).toContain('# 운영체제 정리')
    expect(out).toContain('## 프로세스 vs 스레드')
    expect(out).toContain('**프로세스**')
    expect(out).toContain('| 구분 | 프로세스 | 스레드 |')
    expect(out).toContain('```c')
    expect(out).toContain('- [x] 데드락 4조건 외우기')
    expect(out).toContain('- [ ] 스케줄링 다시 읽기')
    expect(out).toContain('> 컨텍스트 스위칭은 프로세스가 더 비싸다.')
    expect(out).toContain('[참고 자료](https://example.com)')
  })

  /** 🔴 열화 명세 — 되돌릴 수 없으니 spec 으로 고정한다 (markdownIO.ts 주석과 1:1) */
  it('열화 — 토글은 굵은 제목 + 본문으로 펴진다 (접힘 상태 소실)', () => {
    const ed = make({
      content: {
        type: 'doc',
        content: [
          {
            type: 'details',
            attrs: { open: false },
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'Q. 데드락 4조건은?' }] },
              {
                type: 'detailsContent',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: '상호배제·점유대기' }] },
                ],
              },
            ],
          },
        ],
      },
    })
    const out = editorToMarkdown(ed)
    expect(out).toContain('**Q. 데드락 4조건은?**')
    expect(out).toContain('상호배제·점유대기')
    expect(out).not.toContain('<details')
  })

  it('열화 — 형광펜은 색이 사라지고 글자만 남는다', () => {
    const ed = make({
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '기아 현상', marks: [{ type: 'highlight', attrs: { color: 'yellow' } }] },
            ],
          },
        ],
      },
    })
    const out = editorToMarkdown(ed)
    expect(out.trim()).toBe('기아 현상')
    expect(out).not.toContain('yellow')
    expect(out).not.toContain('mark')
  })

  it('열화 — 멘션 칩은 앱 경로 링크가 된다', () => {
    const noteId = '11111111-1111-4111-8111-111111111111'
    const ed = make({
      mention: true,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: STUDY_NOTE_MENTION_TYPE, attrs: { noteId, label: '네트워크 정리' } },
            ],
          },
        ],
      },
    })
    expect(editorToMarkdown(ed).trim()).toBe(`[네트워크 정리](/study-notes/${noteId})`)
  })

  it('markdown 확장을 끄면 평문으로 떨어진다 (던지지 않는다)', () => {
    const ed = new Editor({
      extensions: buildEditorExtensions({ placeholder: 'ph', features: { markdown: false } }),
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '메모' }] }],
      },
    })
    expect(editorToMarkdown(ed)).toBe('메모')
  })
})

/**
 * 🔴 XSS 회귀 잠금 — `Markdown.configure({ html: false })` 한 줄이 방어의 전부다.
 * 파서 출력이 `el.innerHTML` 로 흐르는 싱크가 있어서(handleMarkdownPaste), 설정이
 * true 로 뒤집히면 붙여넣은 `<img onerror>` 가 그 순간 실행된다. 설정을 직접 단언할
 * 수는 없으니 **동작으로** 잠근다: HTML 태그가 요소가 아니라 평문으로 남아야 한다.
 */
describe('마크다운 붙여넣기 — raw HTML 미주입 (html:false 회귀 잠금)', () => {
  it('붙여넣은 <script>·<img onerror> 는 요소가 되지 않고 평문으로 남는다', () => {
    const ed = make()
    // 신호 게이트(2종+)를 통과해야 파서까지 간다 — 제목 + 목록
    const hostile = '# 제목\n\n- 항목 하나\n\n본문 <img src=x onerror="window.__pwned=1"> 그리고\n\n<script>window.__pwned2 = 1</script>'
    const result = handleMarkdownPaste(ed, hostile)
    expect(result.handled).toBe(true)

    // ① 문서 JSON 에 image·html 류 노드가 없다 — 전부 text 로 내려앉았다
    const types = new Set<string>()
    ed.state.doc.descendants((node) => {
      types.add(node.type.name)
    })
    expect([...types].some((t) => /image|html/i.test(t))).toBe(false)
    // ② 태그 문자열이 **글자 그대로** 본문에 남아 있다 (이스케이프됐다는 뜻)
    expect(ed.getText()).toContain('<img src=x onerror=')
    // ③ 실행되지 않았다
    expect((window as { __pwned?: number }).__pwned).toBeUndefined()
    expect((window as { __pwned2?: number }).__pwned2).toBeUndefined()
  })
})

describe('looksLikeCodeEditorHtml — 코드 에디터 복사물 판정 (2026-08-19)', () => {
  const VSCODE_HTML =
    '<meta charset=\'utf-8\'><div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Menlo, Monaco, \'Courier New\', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #569cd6;"># 제목</span></div></div>'
  const NOTION_HTML =
    '<meta charset="utf-8"><h1>제목</h1><p>본문 <strong>굵게</strong></p><table><tr><td>셀</td></tr></table>'

  it('VS Code 복사물(모노스페이스 인라인 스타일) → true', () => {
    expect(looksLikeCodeEditorHtml(VSCODE_HTML)).toBe(true)
  })

  it('웹페이지·노션 복사물(시맨틱 HTML) → false — 기존 양보 경로 유지', () => {
    expect(looksLikeCodeEditorHtml(NOTION_HTML)).toBe(false)
  })

  it('본문 뒤쪽 코드블록의 모노스페이스는 오탐하지 않는다 (앞 600자만 판정)', () => {
    const webWithCodeBlock = NOTION_HTML + 'x'.repeat(600) + '<pre style="font-family: Consolas, monospace">code</pre>'
    expect(looksLikeCodeEditorHtml(webWithCodeBlock)).toBe(false)
  })
})
