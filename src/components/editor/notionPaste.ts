/**
 * 노션 붙여넣기 보정 — 콜아웃(`<aside>`) 을 인용으로.
 *
 * ## 왜 (2026-09-02 실사용)
 *
 * 노션 페이지를 복사해 공부 노트에 붙이면 콜아웃이 **리터럴 텍스트**로 박힌다.
 * 노션이 클립보드에 싣는 건 콜아웃 블록이 아니라 마크다운 유래의 `<aside>` 글자라서,
 * tiptap 은 그걸 그냥 문단 내용으로 읽는다. 사용자 눈에는 `<aside>` 와 `</aside>` 가
 * 본문 사이사이에 끼어 있는 상태가 된다.
 *
 * ## 실측한 페이로드 형태 (한 문서 20쌍 전수)
 *
 * `text/html`
 * - 여는 블록: `<p>&lt;aside&gt;<br>\n{이모지}</p>` — 20/20 이 이 한 형태
 * - 닫는 블록: `<p>&lt;/aside&gt;</p>` 16 / 목록 마지막 항목 끝의 `…<br>\n&lt;/aside&gt;</li>` 4
 * - 여는 블록이 `<li>` 안에 통째로 들어 있는 경우도 있다 (여는·닫는 둘 다 같은 li)
 * - 여는 블록은 문단인데 닫는 마커는 뒤따르는 `<ol>`·`<ul>` 안에 있는, **경계를 가로지르는** 형태가 흔하다
 *
 * `text/plain`
 * - `<aside>` 단독 줄 → 이모지 줄 → 빈 줄 → 내용 → `</aside>` 단독 줄 (20/20 단독 줄)
 *
 * ## 원칙
 *
 * - **짝이 맞는 구간만** 손댄다. 여는 것만 있고 닫는 게 없으면 그대로 둔다 —
 *   잘못 감싸서 남의 문단을 인용에 삼키느니 리터럴이 낫다.
 * - `<li>` 경계를 깨지 않는다. 마커가 목록 안에서 끝나면 **목록을 통째로** 인용에 넣는다.
 * - 마커가 하나도 없으면 **입력을 그대로 돌려준다** (참조까지 동일). 모든 붙여넣기가
 *   이 함수를 지나므로 노션이 아닌 붙여넣기에 비용·부작용이 0 이어야 한다.
 * - **던지지 않는다.** 이상하면 원문을 돌려준다 — 붙여넣기가 통째로 죽는 것보다 낫다.
 *
 * 🔴 토글(접기) 복원은 **불가능**하다. 이 페이로드에는 토글 구조가 실려 오지 않는다.
 */

const OPEN_MARKER = '<aside>'
const CLOSE_MARKER = '</aside>'

interface Marker {
  kind: 'open' | 'close'
  /** 마커 텍스트를 직접 담고 있는 요소 — 여는 `<p>`, 닫는 `<p>`·`<li>` */
  el: Element
  text: Text
}

/** 문서 순서대로 마커를 모은다 (한 텍스트 노드에 둘 이상 있어도 전부) */
function collectMarkers(root: Element): Marker[] {
  const found: Marker[] = []
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child as Text
        const el = text.parentElement
        if (!el) continue
        const re = /<\/?aside>/g
        let hit: RegExpExecArray | null
        while ((hit = re.exec(text.data))) {
          found.push({ kind: hit[0] === OPEN_MARKER ? 'open' : 'close', el, text })
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child)
      }
    }
  }
  walk(root)
  return found
}

/**
 * 짝 맞추기 — 닫히지 않은 여는 마커는 **버린다**.
 * 여는 게 연달아 나오면 뒤엣것이 살아남는다 (가장 가까운 짝).
 */
function pairMarkers(markers: Marker[]): Array<[Marker, Marker]> {
  const pairs: Array<[Marker, Marker]> = []
  let open: Marker | null = null
  for (const marker of markers) {
    if (marker.kind === 'open') open = marker
    else if (open) {
      pairs.push([open, marker])
      open = null
    }
  }
  return pairs
}

/** root 바로 아래부터 el 까지의 조상 경로. root 에 닿지 못하면 빈 배열 */
function pathFrom(root: Element, el: Element): Element[] {
  const path: Element[] = []
  let node: Element | null = el
  while (node && node !== root) {
    path.unshift(node)
    node = node.parentElement
  }
  return node === root ? path : []
}

/**
 * 여는·닫는 요소를 아우르는 **같은 부모 위의 구간**을 blockquote 로 감싼다.
 *
 * 둘의 부모가 다르면(문단 → 뒤따르는 목록 안) 공통 조상까지 올라가 그 층에서 감싼다.
 * 그래서 목록은 통째로 인용 안에 들어가고 `<li>` 는 쪼개지지 않는다.
 */
function wrapRange(root: Element, openEl: Element, closeEl: Element): boolean {
  const doc = root.ownerDocument
  const quote = doc.createElement('blockquote')

  if (openEl === closeEl) {
    openEl.parentNode?.insertBefore(quote, openEl)
    quote.appendChild(openEl)
    return true
  }

  const openPath = pathFrom(root, openEl)
  const closePath = pathFrom(root, closeEl)
  if (openPath.length === 0 || closePath.length === 0) return false

  let depth = 0
  while (
    depth < openPath.length &&
    depth < closePath.length &&
    openPath[depth] === closePath[depth]
  ) {
    depth++
  }
  // 한쪽이 다른 쪽의 조상 — 감쌀 구간을 정할 수 없다. 마커를 리터럴로 남긴다
  if (depth === openPath.length || depth === closePath.length) return false

  const start = openPath[depth]
  const end = closePath[depth]
  const parent = start.parentNode
  if (!parent || end.parentNode !== parent) return false
  // 닫는 쪽이 앞서 있으면 짝이 아니다
  if (!(start.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING)) return false

  parent.insertBefore(quote, start)
  let node: ChildNode | null = start
  while (node) {
    const next: ChildNode | null = node.nextSibling
    quote.appendChild(node)
    if (node === end) break
    node = next
  }
  return true
}

/** 여는 마커 제거 — 리터럴과 뒤따르는 `<br>` 만 걷고 **이모지는 남긴다** */
function stripOpenMarker({ el, text }: Marker): void {
  if (!text.parentNode) return
  text.data = text.data.replace(OPEN_MARKER, '')
  if (!text.data.trim()) {
    const after = text.nextSibling
    text.remove()
    if (after && after.nodeName === 'BR') after.remove()
  }
  const head = el.firstChild
  if (head && head.nodeType === Node.TEXT_NODE) {
    ;(head as Text).data = (head as Text).data.replace(/^\s+/, '')
  }
  // 이모지조차 없었으면 빈 문단이 남는다 — 지운다
  if (el.childNodes.length === 0) el.remove()
}

/**
 * 닫는 마커 제거.
 * 마커만 있던 문단은 통째로 사라지고, 내용 끝에 붙어 있던 형태는 **그 내용을 남긴다**.
 */
function stripCloseMarker({ el, text }: Marker): void {
  if (!text.parentNode) return
  text.data = text.data.replace(CLOSE_MARKER, '')
  if (!text.data.trim()) {
    const before = text.previousSibling
    text.remove()
    if (before && before.nodeName === 'BR') before.remove()
  }
  const tail = el.lastChild
  if (tail && tail.nodeType === Node.TEXT_NODE) {
    ;(tail as Text).data = (tail as Text).data.replace(/\s+$/, '')
  }
  if (el.childNodes.length === 0) el.remove()
}

/**
 * 붙여넣은 `text/html` 의 노션 콜아웃 마커를 인용으로 바꾼다.
 *
 * `<p>&lt;aside&gt;<br>⚠️</p><p>내용</p><p>&lt;/aside&gt;</p>`
 *   → `<blockquote><p>⚠️</p><p>내용</p></blockquote>`
 *
 * 바꿀 게 없으면 **인자를 그대로** 돌려준다.
 */
export function convertNotionAsides(html: string): string {
  // 노션이 아닌 붙여넣기는 여기서 끝난다 — 아래 DOM 왕복을 태우지 않는다
  if (!html.includes('aside')) return html

  try {
    const root = document.createElement('div')
    root.innerHTML = html

    const pairs = pairMarkers(collectMarkers(root))
    if (pairs.length === 0) return html

    let changed = false
    for (const [open, close] of pairs) {
      if (!wrapRange(root, open.el, close.el)) continue
      // 🔴 감싼 **뒤에** 걷는다 — 마커만 있던 문단이 먼저 사라지면 구간의 끝을 잃는다
      stripCloseMarker(close)
      stripOpenMarker(open)
      changed = true
    }
    return changed ? root.innerHTML : html
  } catch {
    return html
  }
}

/**
 * 붙여넣은 `text/plain` 의 노션 콜아웃 구간을 마크다운 인용(`> `)으로 바꾼다.
 *
 * HTML 이 함께 오지 않은 경로(평문만 복사) 용. 마커는 **단독 줄**일 때만 인정한다 —
 * 실측 20쌍이 전부 단독 줄이고, 본문에 우연히 섞인 글자를 건드리지 않으려면 이게 맞다.
 *
 * 구간 안의 빈 줄은 `>` 한 글자로 남긴다. 그냥 비우면 인용이 거기서 끊겨
 * 이모지와 본문이 **다른 인용 블록**으로 갈라진다.
 */
export function convertNotionAsideMarkdown(text: string): string {
  if (!text.includes(OPEN_MARKER)) return text

  const lines = text.split('\n')
  const pairs: Array<[number, number]> = []
  let open = -1
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed === OPEN_MARKER) open = i
    else if (trimmed === CLOSE_MARKER && open >= 0) {
      pairs.push([open, i])
      open = -1
    }
  })
  if (pairs.length === 0) return text

  const markerLines = new Set<number>()
  const quotedLines = new Set<number>()
  for (const [from, to] of pairs) {
    markerLines.add(from)
    markerLines.add(to)
    for (let i = from + 1; i < to; i++) quotedLines.add(i)
  }

  const out: string[] = []
  lines.forEach((line, i) => {
    if (markerLines.has(i)) return
    if (!quotedLines.has(i)) out.push(line)
    else out.push(line.trim() === '' ? '>' : `> ${line}`)
  })
  return out.join('\n')
}
