/**
 * 간단 word-level diff (JobSprout 패턴) — green add / red remove.
 * 외부 lib 없이 LCS 기반 구현 (메시지당 ~수백 단어, 충분히 빠름).
 *
 * 반환: token 배열 — kind ('equal' | 'added' | 'removed')
 */

export type DiffToken = { kind: 'equal' | 'added' | 'removed'; text: string }

/** 한글·영문·구두점 단위 토큰화 — 공백·줄바꿈 보존 */
function tokenize(s: string): string[] {
  if (!s) return []
  return s.match(/[\s]+|[^\s]+/g) ?? []
}

/** LCS 기반 word diff */
export function wordDiff(a: string, b: string): DiffToken[] {
  const aT = tokenize(a)
  const bT = tokenize(b)
  const n = aT.length
  const m = bT.length

  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0),
  )
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aT[i - 1] === bT[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // backtrack
  const out: DiffToken[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (aT[i - 1] === bT[j - 1]) {
      out.unshift({ kind: 'equal', text: aT[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.unshift({ kind: 'removed', text: aT[i - 1] })
      i--
    } else {
      out.unshift({ kind: 'added', text: bT[j - 1] })
      j--
    }
  }
  while (i > 0) {
    out.unshift({ kind: 'removed', text: aT[i - 1] })
    i--
  }
  while (j > 0) {
    out.unshift({ kind: 'added', text: bT[j - 1] })
    j--
  }

  // 인접 same kind 병합 — 가시성 ↑
  return mergeAdjacent(out)
}

function mergeAdjacent(tokens: DiffToken[]): DiffToken[] {
  const out: DiffToken[] = []
  for (const t of tokens) {
    const last = out[out.length - 1]
    if (last && last.kind === t.kind) {
      last.text += t.text
    } else {
      out.push({ ...t })
    }
  }
  return out
}
