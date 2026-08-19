import type { Editor } from '@tiptap/react'

/**
 * 문서 페이지가 tiptap **문서 자체**를 읽어야 하는 두 가지 — 목차와 토글 일괄 접기.
 *
 * 컴포넌트 파일에서 떼어 둔 이유는 둘 다 순수 함수라 spec 이 직접 부를 수 있어서다
 * (그리고 컴포넌트 파일에서 함수를 export 하면 fast refresh 가 깨진다).
 */

export interface TocItem {
  level: number
  text: string
  /** ProseMirror 문서 위치 — 클릭 시 `view.nodeDOM(pos)` 로 DOM 을 찾는다 */
  pos: number
}

/**
 * h1·h2·h3 를 뽑는다. h4 부터 넣으면 목차가 잘게 부서져 "지금 어디쯤인지" 를 오히려
 * 잃는다. 빈 제목 줄은 건너뛴다.
 *
 * (원래 h1 을 뺐었다 — "제목 칸이 따로 있어 안 쓰인다"는 근거였는데, 툴바 H1 버튼과
 * 마크다운 `#` 이 h1 을 만드는 이상 긴 문서의 챕터 축이 목차에서 빠지는 게 더 아팠다.
 * 2026-08-18 CEO 목차 세부 검증에서 정정.)
 */
export function extractToc(editor: Editor): TocItem[] {
  const items: TocItem[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const level = Number(node.attrs.level)
    const text = node.textContent.trim()
    if (level >= 1 && level <= 3 && text) items.push({ level, text, pos })
  })
  return items
}

/**
 * 목차 들여쓰기 — **문서의 최상위 레벨 기준 상대값**.
 *
 * 절대 레벨로 들여쓰면 h2 만 쓰는 문서(템플릿 전부)가 통째로 한 칸 밀린다.
 * 상대로 하면 h2 문서는 지금 모습 그대로, h1 챕터를 쓰는 문서만 3단 위계가 생긴다.
 * (2026-08-18 실측: h1·h2 가 전부 12px 로 같아 위계가 목차에서 안 보였다)
 */
export function tocIndentClass(level: number, minLevel: number): string {
  const depth = Math.max(0, Math.min(2, level - minLevel))
  // 8px 간격은 벽처럼 보였다 (2026-08-19 실사용 — 제목 60개짜리 학습 문서에서 체감).
  // 들여쓰기 12px 간격 + 타이포 차등(tocLevelClass)이 짝이다
  return ['pl-3', 'pl-6', 'pl-9'][depth]
}

/**
 * 목차 레벨별 타이포 차등 — 들여쓰기만으로는 depth 가 안 보인다 (2026-08-19).
 * 최상위 = 또렷하게, 아래로 갈수록 작고 옅게. 활성/조상 색은 호출부 state 가 덮는다
 * (여기선 크기·굵기만 담당 — 색까지 주면 활성 하이라이트와 충돌).
 */
export function tocLevelClass(level: number, minLevel: number): string {
  const depth = Math.max(0, Math.min(2, level - minLevel))
  return ['text-xs font-medium', 'text-xs', 'text-[11px]'][depth]
}

/**
 * 활성 항목의 **조상 경로** — h3 이 활성이면 소속 h2·h1 도 은은하게 켠다.
 *
 * 🔴 챕터(h1) 바로 밑에 섹션(h2)이 붙으면 스크롤 기준선을 두 제목이 거의 동시에 지나
 * h1 이 활성인 순간이 찰나뿐이다 — 사용자에겐 "H1 은 인식이 안 된다"로 보인다
 * (2026-08-18 실기). 단일 하이라이트의 구조적 한계라, 하위를 읽는 동안 소속 챕터를
 * 함께 켜서 "지금 어느 챕터의 어느 섹션인지"가 항상 보이게 한다.
 */
export function tocAncestorPositions(toc: TocItem[], activePos: number | null): Set<number> {
  const out = new Set<number>()
  if (activePos === null) return out
  const idx = toc.findIndex((t) => t.pos === activePos)
  if (idx < 0) return out
  let level = toc[idx].level
  for (let i = idx - 1; i >= 0 && level > 1; i--) {
    if (toc[i].level < level) {
      out.add(toc[i].pos)
      level = toc[i].level
    }
  }
  return out
}

export function countDetails(editor: Editor): { total: number; open: number } {
  let total = 0
  let open = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'details') return
    total += 1
    if (node.attrs.open === true) open += 1
  })
  return { total, open }
}

/**
 * 토글 일괄 열기/접기.
 *
 * 🔴 **한 트랜잭션에 모아서** dispatch 한다. 하나씩 보내면 되돌리기(undo)가 토글 개수만큼
 * 쌓여서, 실수로 눌렀을 때 Ctrl+Z 를 스무 번 눌러야 원래대로 돌아온다.
 * 바꿀 게 없으면 아무 것도 보내지 않는다 — 빈 트랜잭션도 자동 저장을 깨운다.
 */
export function setAllDetailsOpen(editor: Editor, open: boolean): void {
  const { state } = editor
  const tr = state.tr
  let changed = false
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'details' || node.attrs.open === open) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, open })
    changed = true
  })
  if (changed) editor.view.dispatch(tr)
}
