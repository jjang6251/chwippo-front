import type {
  CompanyResearchData,
  CompanyResearchResult,
} from '@/types/interviewPrep'

/**
 * 회사 조사 응답의 **내용 유무** 판정.
 *
 * 🔴 컴포넌트 파일이 아니라 여기 있는 이유 — 「회사 알아보기」 탭을 **띄울지 말지**는
 * `BoardDetail`(탭 줄)이 정하고, 내용은 `CompanyInfoTab` 이 그린다. 판정이 두 벌이 되면
 * "탭은 있는데 내용이 비었다" 는 최악의 조합이 생긴다.
 */

/** 조사 12항목 — `sources`·`inferredFields` 는 내용이 아니라 메타라 뺀다 */
const CONTENT_KEYS = [
  'businessSummary',
  'coreValues',
  'visionMission',
  'recentTrends',
  'financials',
  'competitors',
  'differentiators',
  'jobInsights',
  'interviewKeywords',
  'companyProfile',
  'talentProfile',
  'productsAndTech',
] as const satisfies readonly (keyof CompanyResearchData)[]

/**
 * 문자열은 공백 제외, 배열은 길이, 객체는 값 중 하나라도 채워졌는지.
 *
 * 🔴 **글자가 있어도 「확인하지 못함」뿐이면 빈 것으로 친다** (`isUnconfirmedOnly`).
 * 실측 352개사에서 `coreValues` 6건 · `visionMission` 6건이 여기 걸린다 — 취준생이
 * 소제목을 보고 눈을 옮겼는데 "없습니다"를 읽는 건 시간 낭비다.
 */
export function isFilled(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length > 0 && !isUnconfirmedOnly(v)
  if (Array.isArray(v)) return v.length > 0
  if (v && typeof v === 'object') return Object.values(v).some(isFilled)
  return false
}

/**
 * **문장 전체가 부정으로만 끝나는가** — 「확인하지 못함」류 판정.
 *
 * 🔴 **과잉 차단이 이 판정의 진짜 위험이다.** 부정 뒤에(또는 앞에) 내용이 붙는 경우가
 * 훨씬 많다 — `…는 확인되지 않았다. 우리금융그룹 차원에서는 정도경영과 …을 강조한다`
 * (우리금융캐피탈) · `…확인하지 못했으나, 'Online Trading의 First-mover'…` (키움증권) ·
 * `HD현대 그룹 인재상 3대 축: 최고에 도전하는 열정, … 별도 문구는 확인하지 못해 대체`
 * (HD현대중공업). 실측상 부정어를 품은 값 78건 중 **12건만** 순수 부정이다.
 * 그래서 절 단위로 쪼갠 뒤 **모든 절이 부정일 때만** true 를 돌린다.
 *
 * 판정:
 *   1. 최상위 괄호를 떼어 본문·괄호로 나눈다
 *   2. 괄호가 **메타 주석**(`대체 서술`·`비공개`·`재확인 필요`)이거나 그 자체로 순수 부정이면 버린다
 *      — 남은 괄호는 내용이므로 절로 합류시킨다 (`(현대차그룹 공통 핵심가치인 무한책임정신…)`)
 *   3. 문장·연결어미(`…으나` `…지만` `…며,` `대신` ` — `)로 절을 쪼갠다
 *   4. **모든 절**이 부정어를 포함하면 순수 부정
 */
export function isUnconfirmedOnly(raw?: string | null): boolean {
  const s = (raw ?? '').trim()
  if (!s) return false
  const [body, parens] = splitTopLevelParens(s)
  const parts = clausesOf(body)
  for (const p of parens) {
    if (META_PAREN.test(p) && !/[·,]/.test(p)) continue // 메타 주석 — 내용이 아니다
    if (isUnconfirmedOnly(p)) continue
    parts.push(...clausesOf(p))
  }
  if (parts.length === 0) return NEGATION.test(s)
  return parts.every((p) => NEGATION.test(p))
}

/** 실측에서 관측된 부정 표현 — 「확인하지 못함」 「확정하지 못함」 「확인되지 않았다」 등 */
const NEGATION =
  /(확인|확정|파악|특정)(하지|되지|할 수)?\s*(못|않|없|안)|찾을 수 없|찾지 못|명시(되어 있지|하고 있지|되지)\s*않|공개(하고 있지|되어 있지)\s*않|알 수 없|미확인/

/** 내용이 아니라 조사 과정을 적은 괄호 */
const META_PAREN = /대체 서술|비공개|재확인 필요|추가 확인 필요|학습\s*지식\s*기반|출처 미상/

function splitTopLevelParens(s: string): [string, string[]] {
  let depth = 0
  let body = ''
  let cur = ''
  const parens: string[] = []
  for (const ch of s) {
    if (ch === '(') {
      depth++
      if (depth === 1) {
        cur = ''
        continue
      }
    }
    if (ch === ')') {
      depth--
      if (depth === 0) {
        parens.push(cur)
        continue
      }
      if (depth < 0) {
        depth = 0
        body += ch
        continue
      }
    }
    if (depth === 0) body += ch
    else cur += ch
  }
  if (depth > 0) return [s, []] // 안 닫힌 괄호 — 손대지 않는다
  return [body, parens]
}

function clausesOf(s: string): string[] {
  return s
    .split(
      /(?<=[다음함임됨])[.。](?:\s+|$)|(?:았|었|하)?으나[\s,]|지만[\s,]|(?:으)?며,|\s[—–]\s|대신\s/,
    )
    .map((c) => (c ?? '').trim())
    .filter((c) => c.length > 1)
}

/**
 * 보여줄 조사가 있는가.
 * 🔴 `null`(미조사·만료)·`opt_out`·`blocked`·빈 껍데기가 **전부 같은 처리**다 —
 * 「조사 없으면 조용히」 원칙(스트립과 동일). 빈 탭이 생기면 안 만든 것보다 나쁘다.
 */
export function hasResearchContent(
  data: CompanyResearchResult | null | undefined,
): data is CompanyResearchResult & { research: CompanyResearchData } {
  if (!data || data.status !== 'ok' || !data.research) return false
  const r = data.research
  return CONTENT_KEYS.some((k) => isFilled(r[k]))
}
