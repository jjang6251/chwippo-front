/**
 * 회사 조사 **자유 텍스트 필드의 서식 파서** 4종 —
 * 타임라인(`recentTrends`) · 번호 목록(`differentiators`) · 가치 목록(`coreValues`) ·
 * 인용 선언문(`visionMission`).
 *
 * 🔴 **네 파서를 한 파일에 둔다.** 원문이 전부 같은 LLM 산출물이라 서식 관습(번호 마커·
 * ` — ` 머리말·꼬리 괄호 주석)이 필드를 넘나든다. 파일이 갈라지면 규칙이 두 벌이 되고
 * 한쪽만 고쳐진다. (파일명은 첫 파서에서 왔다.)
 *
 * 🔴 **서식이 회사마다 다르다.** 352개사 시드(`company-research-seed-2026-08.1` + kodit) 실측:
 *   - `recentTrends` — `1)` 290 · 날짜로 시작 30+14 · `①` 15 · 아무 패턴 없음 2
 *   - `differentiators` — `1)` 279 · `①` 21 · 아무 패턴 없음 51 (날짜는 거의 없다)
 *   - `coreValues`(322) — **괄호 나열형 65** · `·` 포함 101 · `— ` 포함 57 · **번호형 2**
 *   - `visionMission`(310) — 인용부호 169 · 라벨(`비전:`) 41
 *   같은 필드인데 번호가 `①` / `1)` 이고 날짜가 `2026-01` / `2026-04-28` / `(2026-07-01 발표)` 다.
 *   LLM 산출물이라 앞으로도 새 서식이 섞인다고 봐야 한다.
 *
 * 그래서 이 모듈의 계약은 **"확신할 때만 구조를 돌려준다"** 이다 —
 * 조금이라도 애매하면 `null` 을 돌려 호출부가 **원문 문단을 그대로** 떨어뜨리게 한다.
 * 화면이 깨지는 것보다 밋밋한 문단이 낫다. 산출물의 모든 조각은 **원문의 부분 문자열**이어야
 * 한다(전수 검사로 확인 — 걷어내는 건 번호 마커·구분자·조사뿐).
 *
 * 🔴 **키워드 하이라이트는 기각했다** (2026-08-22). 대안으로 검토됐으나 —
 *   ① 한국어는 조사·어미가 붙어 문자열 매칭이 어긋나고 같은 단어가 여러 항목에 나온다
 *   ② 빽빽한 문단에 색을 뿌리면 **더 시끄러워진다.** 지금 문제는 강조 부족이 아니라 구조 미사용
 *   ③ 이 앱에서 형광펜은 **사용자가 직접 치는 것**(공부 노트)이라 앱이 칠하면 의미가 겹친다.
 *   그래서 강조를 더하는 대신 **원문에 이미 있는 구조**(번호·괄호·인용부호·라벨)를 드러낸다.
 *
 * 🔴 **날짜는 문자열 그대로 둔다.** 원문에서 뽑은 표시용 텍스트일 뿐 timestamp 가 아니다 —
 * `new Date()` 로 파싱하면 `2026-01` 처럼 일자 없는 값이 브라우저 TZ 를 타고 하루 밀린다.
 * (KST 변환이 필요한 건 `cachedAt` 뿐이고 그건 `@/utils/datetime` 헬퍼가 처리한다.)
 */

/** 원문에서 실제로 관측된 번호 마커 — ①~⑩ */
const CIRCLED_CHARS = '①②③④⑤⑥⑦⑧⑨⑩'

export interface TimelineEntry {
  /** 원문에서 뽑은 날짜 문자열 그대로 (`2026-04-28` · `2026-01` · `2025년 이후`). 없으면 null */
  date: string | null
  /** 날짜·번호를 떼어낸 본문 */
  text: string
}

/**
 * 번호 목록 → 항목 배열. 목록이 아니면 `null`.
 *
 * 판정 기준 (하나라도 어긋나면 null — 오탐이 곧 문단 파괴다):
 *   1. 마커가 2개 이상
 *   2. 번호가 **1부터 순서대로** — 본문 속 우연한 `2)` 로 문단이 쪼개지는 걸 막는다
 *   3. 첫 마커가 **맨 앞** — 앞에 도입 문장이 있으면 그 문장을 잃는다
 *   4. 빈 항목 없음
 */
export function parseNumberedList(raw?: string | null): string[] | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  return (
    segmentsBy(s, new RegExp(`[${CIRCLED_CHARS}]\\s*`, 'g'), (m) =>
      CIRCLED_CHARS.indexOf(m[0].trim()) + 1,
    ) ?? segmentsBy(s, /(?:^|\s)(\d{1,2})\)\s/g, (m) => Number(m[1]))
  )
}

/**
 * `recentTrends` → **날짜가 앞에 붙은 타임라인**. 타임라인이 아니면 `null`(→ 원문 문단).
 *
 * 번호 목록이 우선이고, 번호가 없으면 `A / B / C` 슬래시 구분을 시도한다
 * (`하이브`: `2026-05: … / 2026-02: … / 2025년 이후: …`).
 *
 * 🔴 **날짜가 절반에 못 미치면 타임라인이 아니다.** 빈 배지가 줄줄이 선 세로선보다
 * 원문 문단이 낫다. 최소 2개는 날짜가 있어야 "시간순" 이라는 형태가 성립한다.
 */
export function parseTimeline(raw?: string | null): TimelineEntry[] | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const segments = parseNumberedList(s) ?? slashSegments(s)
  if (!segments) return null
  const entries = segments.map(toEntry)
  const dated = entries.filter((e) => e.date !== null).length
  if (dated < 2 || dated * 2 < entries.length) return null
  return entries
}

// ── coreValues — 가치 목록 ──────────────────────────────────────────────

/** 원문에서 관측된 따옴표 6종 (`'열정'` · `"Beyond the Best"` · 스마트 쿼트) */
const QUOTE_CHARS = `'‘’"“”`

export interface ValueItem {
  /** 가치의 이름 — `인재제일` · `Customer` · `기술로 연결합니다` */
  name: string
  /** 괄호·콜론으로 붙어 있던 부연. 없으면 null */
  note: string | null
}

export interface ValueList {
  /** ` — ` 앞 도입구 (`5대 핵심가치` · `SK Values`). 목록 항목이 아니다 */
  lead: string | null
  items: ValueItem[]
  /** 목록 뒤에 붙은 출처·부연 (`삼성전자 공식 5대 핵심가치`) */
  tail: string | null
}

/**
 * `coreValues` → **이름 + 부연 목록**. 목록이 아니면 `null`(→ 원문 문단).
 *
 * 🔴 **주 패턴은 쉼표+괄호형**이다 — `이름(부연), 이름(부연), …` 65건.
 * 번호형(`①`)은 352개 중 **2건**뿐이라 그것만 보고 파서를 짜면 대부분 안 걸린다.
 *
 * 오탐 방어 (하나라도 어긋나면 null — 산문에 억지로 쉼표를 끊으면 문장이 토막난다):
 *   1. 항목 3개 이상
 *   2. 이름은 **라벨**이지 문장이 아니다 — 20자 이하 · 마침표/콜론/` / `/짝 없는 따옴표 없음
 *   3. **절반 이상이 괄호 부연을 갖거나**, 아니면 **전부 12자 이하**여야 한다
 *      (`농협 3대 핵심가치 '농심', '현장', '공감'을 기반으로 …` 같은 산문을 여기서 걸러낸다)
 */
export function parseValueList(raw?: string | null): ValueList | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // ` — ` 는 **머리말**일 수도(`5대 핵심가치 — 고객 최우선(…), …`) **꼬리 주석**일 수도
  // (`… 상생추구(…) — 삼성전자 공식 5대 핵심가치`) 있다. 목록으로 읽히는 쪽이 본문이다.
  const dash = /\s[—–-]\s/.exec(s)
  if (dash) {
    const left = s.slice(0, dash.index).trim()
    const right = s.slice(dash.index + dash[0].length).trim()
    const asBody = bodyToItems(right)
    if (asBody) return { lead: left, items: asBody.items, tail: asBody.tail }
    const asLead = bodyToItems(left)
    if (asLead) {
      return {
        lead: null,
        items: asLead.items,
        tail: [asLead.tail, right].filter(Boolean).join(' ') || null,
      }
    }
  }

  // 머리 라벨 — `인재상: 유저중심, 라이브서비스 감각, …`
  const colon = /^([^:：(,]{2,20})[:：]\s+([\s\S]+)$/.exec(s)
  if (colon) {
    const r = bodyToItems(colon[2].trim())
    if (r) return { lead: colon[1].trim(), items: r.items, tail: r.tail }
  }

  const r = bodyToItems(s)
  return r ? { lead: null, items: r.items, tail: r.tail } : null
}

const NAME_MAX = 20
/** 부연 없는 목록은 이름이 **전부** 이만큼 짧아야 목록으로 인정한다 */
const SHORT_NAME_MAX = 12

function bodyToItems(body: string): { items: ValueItem[]; tail: string | null } | null {
  // 꼬리 주석 — 맨 끝의 「 (…)」. **괄호 앞 공백**이 부연(`인재제일(…)`)과 주석
  // (`… 신뢰 (제주항공 5대 핵심가치)`)을 가르는 실측 신호다
  let tail: string | null = null
  const t = /\s\(([^()]{2,60})\)\s*[.。]?$/.exec(body)
  if (t) {
    tail = t[1].trim()
    body = body.slice(0, t.index).trim()
  }

  const numbered = parseNumberedList(body)
  if (numbered) {
    const cut = detachTailSentence(numbered)
    if (cut) tail = [cut, tail].filter(Boolean).join(' ')
    // 번호 마커 자체가 목록이라는 강한 증거라 이름 길이는 따지지 않는다
    return { items: numbered.map(toItem), tail }
  }

  let segments = topLevelSplit(body, ',，')
  if (segments.length < 3) {
    // `·` 는 **최상위 쉼표가 없을 때만** 구분자다 — `치밀·철저` 처럼 항목 안에도 쓰인다
    const dots = topLevelSplit(body, '·')
    if (dots.length >= 3) segments = dots
  }
  if (segments.length < 3) return null

  segments = segments.map((x) => x.replace(/[.。]$/, '').trim()).filter(Boolean)
  const cut = detachTailSentence(segments)
  if (cut) tail = [cut, tail].filter(Boolean).join(' ')

  const items = segments.map(toItem)
  if (
    items.some(
      (i) =>
        !i.name ||
        i.name.length > NAME_MAX ||
        /[.。:：]|\s\/\s/.test(i.name) ||
        hasUnbalancedQuote(i.name),
    )
  ) {
    return null
  }
  const withNote = items.filter((i) => i.note).length
  const allShort = items.every((i) => i.name.length <= SHORT_NAME_MAX)
  if (withNote * 2 < items.length && !allShort) return null
  return { items, tail }
}

/** 괄호 밖(depth 0)에서만 자른다 — `정도경영(정직·공정·신뢰)` 의 안쪽 구분자를 지킨다 */
function topLevelSplit(s: string, separators: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && separators.includes(ch)) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

function toItem(segment: string): ValueItem {
  const paren = /^([^(]{1,24})\(([\s\S]+)\)$/.exec(segment)
  if (paren) return { name: unquote(paren[1]), note: paren[2].trim() }
  const colon = /^([^:：(]{1,20})[:：]\s*([\s\S]+)$/.exec(segment)
  if (colon) return { name: unquote(colon[1]), note: colon[2].trim() }
  return { name: unquote(segment), note: null }
}

function unquote(t: string): string {
  const m = new RegExp(`^[${QUOTE_CHARS}]([\\s\\S]+)[${QUOTE_CHARS}]$`).exec(t.trim())
  return m ? m[1].trim() : t.trim()
}

/** 이름 안에 짝 없는 따옴표 = 구조를 잘못 끊었다는 신호 (`인재상은 'Knowledge`) */
function hasUnbalancedQuote(t: string): boolean {
  const n = (t.match(new RegExp(`[${QUOTE_CHARS}]`, 'g')) ?? []).length
  return n % 2 === 1
}

/**
 * 마지막 항목 뒤에 붙은 **별도 문장**은 항목이 아니라 꼬리다 —
 * 네이버 `④ 시대를 기록합니다(…). 슬로건은 '…'.`
 * 🔴 배열을 제자리에서 고친다(호출부가 잘라낸 뒤의 항목을 그대로 쓰게).
 */
function detachTailSentence(segments: string[]): string | null {
  const last = segments[segments.length - 1]
  const m = /^([\s\S]+?\))\s*[.。]\s+([\s\S]+)$/.exec(last)
  if (!m) return null
  segments[segments.length - 1] = m[1].trim()
  return m[2].trim()
}

// ── visionMission — 인용 선언문 ────────────────────────────────────────

export interface QuotedStatement {
  /** `비전` · `미션` · `그룹 비전` — 없으면 null */
  label: string | null
  /** 따옴표 안의 선언문 (따옴표는 벗긴다) */
  text: string
  /** 선언문 뒤에 **떨어져** 붙은 부연 (`— 최고의 금융회사로…` · `(공식, hdec.kr)`) */
  note: string | null
}

export interface QuotedStatements {
  quotes: QuotedStatement[]
  /** 인용으로 읽히지 않은 나머지 — 문단으로 이어 붙인다 (버리지 않는다) */
  rest: string | null
}

const VM_LABELS =
  '비전|미션|경영이념|경영철학|사명|슬로건|기업이념|경영방침|핵심철학|브랜드 미션'
const VM_LABEL_RE = new RegExp(`^((?:그룹\\s*)?(?:${VM_LABELS}))\\s*(?:[:：]|은|는)?\\s*([\\s\\S]*)$`)
const VM_QUOTED_RE = new RegExp(
  `^[${QUOTE_CHARS}]([^${QUOTE_CHARS}]{2,})[${QUOTE_CHARS}]\\s*([\\s\\S]*)$`,
)

/**
 * `visionMission` → **인용 선언문 목록**. 선언문 형태가 아니면 `null`(→ 원문 문단).
 *
 * 회사가 **직접 쓴 말**이고 자소서에 그대로 옮기는 재료라 인용 블록으로 띄운다.
 * 인용부호가 아예 없으면(실측 141/310 = 45%) 손대지 않는다 — 문단 그대로다.
 *
 * 앞에서부터 읽다가 **처음 막히는 조각에서 멈추고** 나머지는 `rest` 로 넘긴다.
 * 전부-아니면-전무로 하면 `비전: '…' / 미션: '…'. 식품사업부문 미션은 …` 같은
 * 꼬리 한 문장 때문에 앞의 멀쩡한 선언문 둘을 통째로 잃는다.
 *
 * 🔴 **인용 뒤가 조사로 이어지면 선언문이 아니다** — `'일등LG', 경영이념 '…'을 … 실천` ·
 * `'…'라는 브랜드 미션 아래 …`. 문장 속 인용을 블록으로 뽑으면 문장이 두 동강 난다.
 * 떨어져 나온 부연(`—` · `(` · `/` 로 시작)만 `note` 로 받는다.
 */
export function parseQuotedStatements(raw?: string | null): QuotedStatements | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  if (!new RegExp(`[${QUOTE_CHARS}]`).test(s)) return null

  const segments = s
    .split(new RegExp(`\\s/\\s|(?<=[가-힣)${QUOTE_CHARS}])[.。]\\s+`))
    .map((x) => x.trim())
    .filter(Boolean)

  const quotes: QuotedStatement[] = []
  let sawQuoted = false
  let i = 0
  for (; i < segments.length; i++) {
    const one = parseStatement(segments[i])
    if (!one) break
    if (one.quoted) sawQuoted = true
    quotes.push({ label: one.label, text: one.text, note: one.note })
  }
  // 🔴 따옴표에서 온 선언문이 하나도 없으면 그냥 라벨 붙은 산문이다 (한국콜마)
  if (quotes.length === 0 || !sawQuoted) return null
  const rest = segments.slice(i).join(' ').trim()
  return { quotes, rest: rest || null }
}

function parseStatement(
  segment: string,
): (QuotedStatement & { quoted: boolean }) | null {
  const lab = VM_LABEL_RE.exec(segment)
  const label = lab ? lab[1].trim() : null
  const body = lab ? lab[2].trim() : segment

  const q = VM_QUOTED_RE.exec(body)
  if (q) {
    const note = q[2].trim()
    if (note && !/^[—–([/]/.test(note)) return null // 조사로 이어짐 = 문장 속 인용
    return { label, text: q[1].trim(), note: note || null, quoted: true }
  }
  // 라벨은 있는데 따옴표가 없는 조각 (`미션: 인재와 기술을 바탕으로 …`) —
  // 같은 값 안에 진짜 인용이 하나라도 있을 때만 살아남는다
  if (!label) return null
  const rest = body.replace(/[.。]$/, '')
  if (!rest || rest.length > 90 || new RegExp(`[${QUOTE_CHARS}]`).test(rest)) return null
  return { label, text: rest, note: null, quoted: false }
}

// ────────────────────────────────────────────────────────────────────────

function segmentsBy(
  s: string,
  marker: RegExp,
  numberOf: (m: RegExpMatchArray) => number,
): string[] | null {
  const marks = [...s.matchAll(marker)]
  if (marks.length < 2) return null
  if (marks[0].index !== 0) return null // 도입 문장이 있으면 손대지 않는다
  if (marks.some((m, i) => numberOf(m) !== i + 1)) return null

  const segments = marks.map((m, i) => {
    const start = m.index! + m[0].length
    const end = i + 1 < marks.length ? marks[i + 1].index! : s.length
    return s.slice(start, end).trim()
  })
  return segments.every((t) => t.length > 0) ? segments : null
}

/** ` / ` 로 나뉜 3토막 이상 — 슬래시가 하나뿐이면 문장 속 슬래시일 수 있어 받지 않는다 */
function slashSegments(s: string): string[] | null {
  const parts = s
    .split(/\s\/\s/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length >= 3 ? parts : null
}

/**
 * 항목 머리의 날짜를 뽑는다.
 *
 * 🔴 `20\d{2}년…` 을 먼저 본다 — 순서를 바꾸면 「2026년 하반기」에서 `2026` 만 떼어내고
 * 본문이 「년 하반기…」로 시작해버린다.
 */
const DATE_HEAD =
  /^(\()?\s*(20\d{2}년(?:\s*\d{1,2}월)?(?:\s*이후)?|20\d{2}(?:[-.]\d{1,2}){0,2})/

function toEntry(segment: string): TimelineEntry {
  const m = DATE_HEAD.exec(segment)
  if (!m) return { date: null, text: segment }

  let rest = segment.slice(m[0].length)
  // `(2026-07-01 발표) 기존 …` — 괄호로 열렸으면 닫는 괄호까지가 머리다
  if (m[1]) {
    const close = rest.indexOf(')')
    if (close < 0) return { date: null, text: segment } // 닫히지 않으면 손대지 않는다
    rest = rest.slice(close + 1)
  }
  // 날짜와 본문 사이의 구두점만 걷어낸다 (`2026-04-28 발표: …` 의 「발표」 같은 말은 남긴다)
  rest = rest.replace(/^\s*\(KST\)/, '').replace(/^[\s:：,.·\-–—]+/, '')
  if (!rest) return { date: null, text: segment } // 날짜만 남으면 본문이 사라진다
  return { date: m[2].replace(/\./g, '-'), text: rest }
}
