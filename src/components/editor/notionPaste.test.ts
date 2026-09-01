/**
 * 노션 콜아웃(`<aside>`) 붙여넣기 보정 spec.
 *
 * 스니펫은 전부 **합성**이다 — 실제 클립보드의 형태만 그대로 미러링하고 내용은 옮기지 않았다.
 *
 * 시나리오 (text/html)
 *   기본     여는 블록 + 내용 + 닫는 블록 → blockquote · 마커 소멸 · 이모지가 인용 첫 문단
 *   연속     붙어 있는 aside 2개 → 인용 2개, 서로 섞이지 않는다
 *   li 안    여는·닫는 둘 다 같은 `<li>` 안 → 인용은 li 안에 생기고 li 는 쪼개지지 않는다
 *   경계가로 여는 건 문단인데 닫는 마커가 뒤따르는 `<ol>` 마지막 항목 끝 → 목록 통째로 인용
 *   문단끝   닫는 마커가 내용 문단 끝에 붙은 형태 → 마커만 떼고 그 문단까지 인용에 포함
 *   짝없음   여는 것만 있고 닫는 게 없다 → 원문 그대로 (잘못 감싸느니 리터럴로 둔다)
 *   무관     마커가 없다 → 원문 그대로 (모든 붙여넣기가 지나는 길이라 부작용 0)
 *
 * 시나리오 (text/plain)
 *   기본     `<aside>` 단독 줄 구간 → `> ` 인용, 이모지 유지, 구간 안 빈 줄은 `>` 로 이어 붙임
 *   목록     구간 안 번호 목록도 인용 안에 들어간다
 *   연속     붙어 있는 2개
 *   짝없음·무관  원문 그대로
 */
import { describe, it, expect } from 'vitest'
import { convertNotionAsides, convertNotionAsideMarkdown } from './notionPaste'

/** 결과를 문자열로 훑지 않고 구조로 본다 — 공백 직렬화에 흔들리지 않게 */
function parse(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

const textsOf = (nodes: NodeListOf<Element>) =>
  Array.from(nodes, (n) => n.textContent?.trim() ?? '')

describe('convertNotionAsides — text/html', () => {
  it('기본 짝 → blockquote 로 감싸고 마커는 사라진다 (이모지는 첫 문단)', () => {
    const html =
      "<meta charset='utf-8'><p>&lt;aside&gt;<br>\n⚠️</p>\n<p>본문 한 줄</p>\n<p>&lt;/aside&gt;</p>"
    const out = convertNotionAsides(html)

    expect(out).not.toContain('aside')
    const root = parse(out)
    const quotes = root.querySelectorAll('blockquote')
    expect(quotes).toHaveLength(1)
    expect(textsOf(quotes[0].querySelectorAll(':scope > p'))).toEqual(['⚠️', '본문 한 줄'])
  })

  it('연속 aside 2개 → 인용 2개로 갈린다', () => {
    const html =
      '<p>&lt;aside&gt;<br>\n⚠️</p>\n<p>첫째 안내</p>\n<p>&lt;/aside&gt;</p>\n' +
      '<p>&lt;aside&gt;<br>\n📌</p>\n<p>둘째 안내</p>\n<p>&lt;/aside&gt;</p>'
    const out = convertNotionAsides(html)

    expect(out).not.toContain('aside')
    const quotes = parse(out).querySelectorAll('blockquote')
    expect(quotes).toHaveLength(2)
    expect(textsOf(quotes[0].querySelectorAll(':scope > p'))).toEqual(['⚠️', '첫째 안내'])
    expect(textsOf(quotes[1].querySelectorAll(':scope > p'))).toEqual(['📌', '둘째 안내'])
  })

  it('`<li>` 안에 통째로 든 aside → 인용은 li 안에 생기고 li 는 그대로 하나', () => {
    const html =
      '<ul>\n<li>\n<p><strong>항목 제목</strong></p>\n' +
      '<p>&lt;aside&gt;<br>\n🎯</p>\n<p>항목 안 안내</p>\n<p>&lt;/aside&gt;</p>\n' +
      '<p>항목 뒷말</p>\n</li>\n</ul>'
    const out = convertNotionAsides(html)

    expect(out).not.toContain('aside')
    const root = parse(out)
    expect(root.querySelectorAll('li')).toHaveLength(1)
    const quote = root.querySelector('li > blockquote')
    expect(quote).not.toBeNull()
    expect(textsOf(quote!.querySelectorAll(':scope > p'))).toEqual(['🎯', '항목 안 안내'])
    // 인용 밖 문단은 li 에 남아 있어야 한다
    expect(textsOf(root.querySelectorAll('li > p'))).toEqual(['항목 제목', '항목 뒷말'])
  })

  it('닫는 마커가 뒤따르는 목록 마지막 항목 끝에 있으면 목록을 통째로 인용에 넣는다', () => {
    const html =
      '<p>&lt;aside&gt;<br>\n🅰️</p>\n<ol>\n<li><strong>첫째</strong> — 설명</li>\n' +
      '<li><strong>둘째</strong> — 설명<br>\n&lt;/aside&gt;</li>\n</ol>'
    const out = convertNotionAsides(html)

    expect(out).not.toContain('aside')
    const root = parse(out)
    const quote = root.querySelector('blockquote')
    expect(quote).not.toBeNull()
    expect(textsOf(quote!.querySelectorAll(':scope > p'))).toEqual(['🅰️'])
    // li 경계가 깨지지 않는다 — 목록이 인용 안에 통째로 들어간다
    expect(root.querySelector('blockquote > ol')).not.toBeNull()
    expect(textsOf(root.querySelectorAll('li'))).toEqual(['첫째 — 설명', '둘째 — 설명'])
  })

  it('닫는 마커가 내용 문단 끝에 붙어 있으면 마커만 떼고 그 문단까지 인용한다', () => {
    const html = '<p>&lt;aside&gt;<br>\n💡</p>\n<p>마지막 문장.&lt;/aside&gt;</p>'
    const out = convertNotionAsides(html)

    expect(out).not.toContain('aside')
    const quote = parse(out).querySelector('blockquote')
    expect(textsOf(quote!.querySelectorAll(':scope > p'))).toEqual(['💡', '마지막 문장.'])
  })

  /** 🔴 잘못 감싸서 남의 문단을 삼키느니 리터럴로 둔다 */
  it('여는 것만 있고 닫는 게 없으면 원문 그대로', () => {
    const html = '<p>&lt;aside&gt;<br>\n⚠️</p>\n<p>닫히지 않은 안내</p>'
    expect(convertNotionAsides(html)).toBe(html)
  })

  it('마커가 없으면 원문 그대로', () => {
    const html = '<p>보통 문단</p>\n<ul><li>항목</li></ul>'
    expect(convertNotionAsides(html)).toBe(html)
  })

  it('진짜 `<aside>` 요소만 있고 마커는 없으면 원문 그대로', () => {
    const html = '<aside><p>사이드바</p></aside>\n<p>본문</p>'
    expect(convertNotionAsides(html)).toBe(html)
  })

  it('빈 문자열도 던지지 않는다', () => {
    expect(convertNotionAsides('')).toBe('')
  })
})

describe('convertNotionAsideMarkdown — text/plain', () => {
  it('단독 줄 구간 → `> ` 인용, 이모지 유지, 구간 안 빈 줄은 `>` 로 이어 붙인다', () => {
    const input = ['앞 문단', '', '<aside>', '⏰', '', '안내 문장', '</aside>', '', '뒤 문단'].join(
      '\n',
    )
    expect(convertNotionAsideMarkdown(input)).toBe(
      ['앞 문단', '', '> ⏰', '>', '> 안내 문장', '', '뒤 문단'].join('\n'),
    )
  })

  it('구간 안 번호 목록도 같은 인용 안에 들어간다', () => {
    const input = ['<aside>', '🅰️', '', '1. 첫째', '2. 둘째', '</aside>'].join('\n')
    expect(convertNotionAsideMarkdown(input)).toBe(
      ['> 🅰️', '>', '> 1. 첫째', '> 2. 둘째'].join('\n'),
    )
  })

  it('연속 2개도 각각 인용이 된다', () => {
    const input = ['<aside>', '⚠️', '', '첫째', '</aside>', '', '<aside>', '📌', '', '둘째', '</aside>'].join('\n')
    expect(convertNotionAsideMarkdown(input)).toBe(
      ['> ⚠️', '>', '> 첫째', '', '> 📌', '>', '> 둘째'].join('\n'),
    )
  })

  it('여는 것만 있고 닫는 게 없으면 원문 그대로', () => {
    const input = ['<aside>', '⏰', '', '닫히지 않은 안내'].join('\n')
    expect(convertNotionAsideMarkdown(input)).toBe(input)
  })

  it('마커가 없으면 원문 그대로', () => {
    const input = '## 제목\n- 항목'
    expect(convertNotionAsideMarkdown(input)).toBe(input)
  })

  /** 본문에 우연히 섞인 글자는 건드리지 않는다 — 단독 줄일 때만 마커로 본다 */
  it('줄 가운데 낀 `<aside>` 글자는 마커로 보지 않는다', () => {
    const input = ['노션의 <aside> 문법 설명', '</aside> 도 마찬가지'].join('\n')
    expect(convertNotionAsideMarkdown(input)).toBe(input)
  })
})
