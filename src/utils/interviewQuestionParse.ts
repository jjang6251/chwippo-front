/**
 * 질문 은행 D2 — **붙여넣은 덩어리를 질문 목록으로 쪼개는 순수 함수.**
 *
 * 컴포넌트가 아니라 여기 있는 이유는 두 가지다 — 화면 없이 검증할 수 있어야 하고
 * (실패 모드가 전부 문자열 처리다), 폼 파일에서 함수를 export 하면 fast refresh 가 깨진다.
 */

/** 서버 `BULK_MAX_ITEMS` 와 같은 값 — 한 번에 담을 수 있는 질문 수 */
export const BULK_MAX_ITEMS = 50
/** 서버 `normalizeQuestionText` 와 같은 값 — trim 후 1~500자 */
export const QUESTION_MAX_CHARS = 500

/** 붙여넣기 줄이 목록에서 빠지는 이유 — 화면에 그대로 표시된다 */
export type ParsedExclusion = 'duplicate' | 'too_long' | 'over_limit'

export interface ParsedQuestionLine {
  /** 접두 번호를 떼고 trim 한 본문 */
  text: string
  /** null 이면 추가 대상 */
  exclude: ParsedExclusion | null
}

/**
 * 목록에서 흔한 접두 표기.
 *
 * `1.` `1)` `- ` `• ` `Q1.` `Q.` 를 뗀다. 숫자는 3자리까지만 보고 **`.` 나 `)` 가 이어져야만**
 * 접두로 친다 — 그래야 `3년 후 목표는?` 같은 진짜 질문의 첫 글자가 잘려나가지 않는다.
 */
const PREFIX_RE = /^\s*(?:[-–—•*]\s*|[Qq]?\s*\d{1,3}\s*[.)]\s*|[Qq]\s*[.)]\s*)/

/** 중복 판정용 — 대소문자·공백을 무시한다 ("자기소개 해주세요" ≡ "자기소개해주세요") */
const dedupeKey = (text: string) => text.replace(/\s+/g, '').toLowerCase()

/**
 * 붙여넣은 덩어리를 질문 목록으로 쪼갠다.
 *
 * 🔴 **기존 질문과의 중복은 걸러내지 않는다** — 서버도 허용한다. 같은 질문을 다른 차수에서
 * 또 받는 건 실제로 일어나는 일이고, 무엇이 중복인지 판단하는 건 사용자 몫이다.
 * 여기서 막는 건 **이번에 붙여넣은 덩어리 안의 완전 중복**뿐이다 (복사가 겹친 경우).
 */
export function parsePastedQuestions(raw: string): ParsedQuestionLine[] {
  const seen = new Set<string>()
  const out: ParsedQuestionLine[] = []
  let kept = 0

  for (const line of raw.split('\n')) {
    const text = line.replace(PREFIX_RE, '').trim()
    if (!text) continue

    if (text.length > QUESTION_MAX_CHARS) {
      out.push({ text, exclude: 'too_long' })
      continue
    }
    const key = dedupeKey(text)
    if (seen.has(key)) {
      out.push({ text, exclude: 'duplicate' })
      continue
    }
    seen.add(key)
    if (kept >= BULK_MAX_ITEMS) {
      out.push({ text, exclude: 'over_limit' })
      continue
    }
    kept += 1
    out.push({ text, exclude: null })
  }
  return out
}
