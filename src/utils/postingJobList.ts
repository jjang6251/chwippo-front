/**
 * 「어느 직무로 지원하세요?」 후보 목록 만들기 — **공고 표기 그대로**를 읽기 좋게만 배열한다.
 *
 * ## 후보는 우리 어휘가 아니다
 *
 * 여기 들어오는 문자열은 파서가 그 공고에서 뽑은 **부문 이름**이다 (「사무영업(IT)」·
 * 「문산차량/전기」). 우리 계열 14벌로 갈아끼우지 않는다 — 사용자가 지원하는 건 공고에
 * 적힌 그 부문이고, 카드 직무 칸에도 그 표기가 그대로 들어간다.
 *
 * ## 하는 일 둘
 *
 * 1. **접두어 묶음** — 공기업 공채는 「사무영업(일반)」·「사무영업(IT)」처럼 괄호 앞이 겹친다.
 *    같은 접두어가 2개 이상이면 소제목으로 접고 괄호 안만 줄로 남긴다. 10줄이 전부
 *    「사무영업…」으로 시작하면 눈이 접두어를 매번 다시 읽는다.
 *    🔴 **1개짜리 접두어는 묶지 않는다** — 소제목 아래 줄 하나는 위계만 늘리고 정보는 0이다.
 * 2. **내 직무와 가까운 후보 하나** — 프로필 희망 직무와 **같은 계열**로 판정되면 배지를 달고
 *    위로 올린다. 🔴 **자동 선택은 하지 않는다** — 계열이 같다는 건 우리 추측이지 사용자가
 *    한 말이 아니고, 부문이 다르면 요건이 통째로 다르다 (계획서 정정 4 ②-b).
 *    묶음 안 후보면 **그 묶음째** 올린다 — 「IT」만 뽑아 올리면 무슨 부문의 IT 인지 사라진다.
 */
import { classifyJob } from '@/utils/jobRole'

export interface JobCandidateRow {
  kind: 'item'
  /** 실제로 카드에 저장될 값 — 언제나 공고 표기 원문 */
  value: string
  /** 화면에 쓸 글자. 묶음 안이면 괄호 안만 */
  label: string
  /** 묶음 소제목 아래에 들여 쓰나 */
  indented: boolean
  /** 「✦ 내 직무와 가까움」 */
  closeMatch: boolean
}

export interface JobCandidateGroup {
  kind: 'group'
  label: string
}

export type JobCandidateEntry = JobCandidateGroup | JobCandidateRow

/** 「사무영업(IT)」 → `{ prefix: '사무영업', suffix: 'IT' }` · 괄호가 없으면 prefix 없음 */
function splitPrefix(value: string): { prefix: string; suffix: string } | null {
  const open = value.indexOf('(')
  if (open <= 0) return null
  const close = value.lastIndexOf(')')
  if (close <= open + 1) return null
  const prefix = value.slice(0, open).trim()
  const suffix = value.slice(open + 1, close).trim()
  if (!prefix || !suffix) return null
  return { prefix, suffix }
}

/** 내 희망 직무의 계열 — 판정 실패(`none`·`ambiguous`)면 비교 자체를 안 한다 */
function profileSeriesId(profileJobTitle: string | null | undefined): string | null {
  const t = profileJobTitle?.trim()
  if (!t) return null
  const verdict = classifyJob(t)
  return verdict.status === 'confident' ? verdict.series.id : null
}

/**
 * 후보 중 「내 직무와 가까운」 것 **하나**를 고른다.
 *
 * 🔴 여럿이 걸리면 아무것도 고르지 않는다. 브랜드·퍼포먼스·콘텐츠 마케터가 전부 걸린 상황에서
 * 하나에만 배지를 달면 **우리가 골라 준 것처럼** 읽힌다 — 그건 물어보는 화면이 할 일이 아니다.
 */
export function findCloseMatch(
  candidates: string[],
  profileJobTitle: string | null | undefined,
): string | null {
  const seriesId = profileSeriesId(profileJobTitle)
  if (!seriesId) return null
  const matched = candidates.filter((c) => {
    const v = classifyJob(c)
    return v.status === 'confident' && v.series.id === seriesId
  })
  return matched.length === 1 ? matched[0] : null
}

/**
 * 후보 문자열 목록 → 화면에 그릴 엔트리 목록.
 *
 * @param candidates 파서가 뽑은 공고 표기 (상한 15 — 서버가 자른다)
 * @param profileJobTitle 내 희망 직무 (배지 판정용 · 없으면 배지 없음)
 */
export function buildJobCandidateList(
  candidates: string[],
  profileJobTitle?: string | null,
): JobCandidateEntry[] {
  // 빈 문자열·중복은 화면에 그릴 값이 아니다 (서버가 걸러도 여기서 한 번 더 — 읽기 경계)
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of candidates) {
    const v = typeof raw === 'string' ? raw.trim() : ''
    if (!v || seen.has(v)) continue
    seen.add(v)
    clean.push(v)
  }
  if (clean.length === 0) return []

  const parsed = clean.map((value) => ({ value, split: splitPrefix(value) }))
  const prefixCount = new Map<string, number>()
  for (const p of parsed) {
    if (!p.split) continue
    prefixCount.set(p.split.prefix, (prefixCount.get(p.split.prefix) ?? 0) + 1)
  }
  const groupedPrefixes = new Set(
    [...prefixCount.entries()].filter(([, n]) => n >= 2).map(([k]) => k),
  )

  const close = findCloseMatch(clean, profileJobTitle)

  /** 원래 순서를 지키며 묶음 단위로 자른다 — 묶음은 첫 멤버가 나온 자리에 선다 */
  type Block = { prefix: string | null; rows: JobCandidateRow[] }
  const blocks: Block[] = []
  const blockByPrefix = new Map<string, Block>()

  for (const p of parsed) {
    const grouped = p.split && groupedPrefixes.has(p.split.prefix) ? p.split : null
    const row: JobCandidateRow = {
      kind: 'item',
      value: p.value,
      label: grouped ? grouped.suffix : p.value,
      indented: !!grouped,
      closeMatch: p.value === close,
    }
    if (!grouped) {
      blocks.push({ prefix: null, rows: [row] })
      continue
    }
    const existing = blockByPrefix.get(grouped.prefix)
    if (existing) {
      existing.rows.push(row)
    } else {
      const block: Block = { prefix: grouped.prefix, rows: [row] }
      blockByPrefix.set(grouped.prefix, block)
      blocks.push(block)
    }
  }

  // 가까운 후보가 든 블록을 통째로 맨 위로 (묶음이면 소제목까지 함께 — 라벨 맥락 보존)
  if (close) {
    const idx = blocks.findIndex((b) => b.rows.some((r) => r.closeMatch))
    if (idx > 0) blocks.unshift(...blocks.splice(idx, 1))
  }

  const out: JobCandidateEntry[] = []
  for (const b of blocks) {
    if (b.prefix) out.push({ kind: 'group', label: b.prefix })
    out.push(...b.rows)
  }
  return out
}

/** 카드 안에 바로 펼칠까(≤3), 「직무 고르기」 버튼 + 시트로 보낼까(≥4) */
export const JOB_INLINE_MAX = 3
export function shouldPickInSheet(candidates: string[]): boolean {
  return candidates.length > JOB_INLINE_MAX
}
