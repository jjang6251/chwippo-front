import { countChars } from './charCount'

export interface CleanupIssue {
  key: string
  label: string
  count: number
}

export interface CleanupResult {
  cleaned: string
  issues: CleanupIssue[]
  // 원본 텍스트에서 "눈에 보이는" 문제 구간 [start, endExclusive] — 하이라이트용
  ranges: Array<[number, number]>
}

// 자소서에서 허용할 문장부호 (그 외 특수문자는 모두 제거). 문자(\p{L})·숫자(\p{N})·공백(\s)은 항상 허용.
// 문자 클래스 안에서 ] 와 - 는 이스케이프 필요. u00B7=가운뎃점 u2026=… u2013=– u2014=—
const ALLOWED_PUNCT = ".,?!\\u00B7:;\\u2026'\"()\\[\\]{}~/%&+\\-\\u2013\\u2014"
const SPECIAL_RE = () => new RegExp(`[^\\p{L}\\p{N}\\s${ALLOWED_PUNCT}]`, 'gu')
const EMOJI_RE = () => /\p{Extended_Pictographic}/gu
const JAMO_RE = () => /[ㄱ-ㅣ]+/g
const SMARTQUOTE_RE = () => /[‘’“”]/g
// NBSP(U+00A0)는 \s에 걸려 특수문자 제거를 통과하지만, 제출 시스템에서 일반 공백과 다르게 처리될 수 있어 정규화한다.
const FULLWIDTH_SPACE_RE = () => /[\u3000\u00A0]/g
// 전각 문장부호는 SPECIAL_RE에 걸려 통째로 제거되면 정보가 손실되므로, 제거 대신 반각으로 변환한다.
const FULLWIDTH_PUNCT_MAP: Record<string, string> = {
  '，': ',', '．': '.', '！': '!', '？': '?', '（': '(', '）': ')',
  '：': ':', '；': ';', '、': ',', '。': '.', '㈜': '(주)',
}
const FULLWIDTH_PUNCT_RE = () => /[，．！？（）：；、。㈜]/g
const TAB_RE = () => /\t/g
const DUP_SPACE_RE = () => / {2,}/g
// 반복 문장부호 축약. 마침표(...)는 말줄임 의도 판단이 모호해 제외한다.
const DUP_PUNCT_RE = () => /([!?~])\1+/g
const LINE_PAD_RE = () => /^ +| +$/gm
// 문단 구분용 빈 줄 1개는 자소서 관행상 허용(인사담당자 다수가 문단 나누기 권장). 빈 줄 2개+(줄바꿈 3개+)만 1개로 축약.
const MANY_NEWLINE_RE = () => /\n{3,}/g
// 줄 끝이 쉼표인데 줄바꿈된 경우 → 이어지는 문장으로 합침
const COMMA_NEWLINE_RE = () => /([,，、])[ \t]*\n[ \t]*/g

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

function collectRanges(text: string, re: RegExp, into: Array<[number, number]>): void {
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    into.push([m.index, m.index + m[0].length])
    if (m[0].length === 0) re.lastIndex++
  }
}

export function cleanupCoverletter(text: string, limit: number | null = null): CleanupResult {
  const issues: CleanupIssue[] = []
  const rawRanges: Array<[number, number]> = []

  // 원본에서 "보이는" 문제 구간 수집 (공백/줄바꿈 정리는 하이라이트하지 않음)
  collectRanges(text, FULLWIDTH_SPACE_RE(), rawRanges)
  collectRanges(text, SMARTQUOTE_RE(), rawRanges)
  collectRanges(text, FULLWIDTH_PUNCT_RE(), rawRanges)
  collectRanges(text, TAB_RE(), rawRanges)
  collectRanges(text, EMOJI_RE(), rawRanges)
  collectRanges(text, JAMO_RE(), rawRanges)
  collectRanges(text, SPECIAL_RE(), rawRanges)
  rawRanges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const ranges: Array<[number, number]> = []
  for (const [s, e] of rawRanges) {
    const last = ranges[ranges.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else ranges.push([s, e])
  }

  let s = text
  const add = (key: string, label: string, count: number) => { if (count > 0) issues.push({ key, label, count }) }

  // 1. 전각 공백 → 일반 공백
  add('fullwidth', '특수 공백(전각·NBSP)', countMatches(s, FULLWIDTH_SPACE_RE()))
  s = s.replace(FULLWIDTH_SPACE_RE(), ' ')

  // 2. 둥근(스마트) 따옴표 → 직선 따옴표
  add('smartquotes', '둥근 따옴표', countMatches(s, SMARTQUOTE_RE()))
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")

  // 3. 탭 → 공백
  add('tabs', '탭 문자', countMatches(s, TAB_RE()))
  s = s.replace(TAB_RE(), ' ')

  // 4. 전각 문장부호 → 반각 (제거 대신 변환해 정보 손실 방지)
  add('fullwidthPunct', '전각 문장부호', countMatches(s, FULLWIDTH_PUNCT_RE()))
  s = s.replace(FULLWIDTH_PUNCT_RE(), (ch) => FULLWIDTH_PUNCT_MAP[ch] ?? ch)

  // 5. 이모지·그림문자 제거 (남은 ZWJ/VS16 등 보조문자는 특수문자 정리에서 제거됨)
  add('emoji', '이모지·그림문자', countMatches(s, EMOJI_RE()))
  s = s.replace(EMOJI_RE(), '')

  // 6. 한글 자모 단독 사용(ㅋㅋ, ㅎㅎ, ㅠㅠ 등) 제거
  add('jamo', '한글 자모 단독 사용(ㅋㅋ, ㅎㅎ 등)', countMatches(s, JAMO_RE()))
  s = s.replace(JAMO_RE(), '')

  // 7. 문장부호를 제외한 특수문자 제거
  add('special', '허용되지 않는 특수문자', countMatches(s, SPECIAL_RE()))
  s = s.replace(SPECIAL_RE(), '')

  // 8. 반복된 문장부호(!!, ?? 등) → 1개
  add('dupPunct', '반복된 문장부호(!!, ?? 등)', countMatches(s, DUP_PUNCT_RE()))
  s = s.replace(DUP_PUNCT_RE(), '$1')

  // 9. 연속된 공백 → 1개
  add('spaces', '연속된 공백', countMatches(s, DUP_SPACE_RE()))
  s = s.replace(DUP_SPACE_RE(), ' ')

  // 10. 줄 앞뒤 공백 제거
  add('trailing', '줄 앞뒤 공백', countMatches(s, LINE_PAD_RE()))
  s = s.split('\n').map((line) => line.trim()).join('\n')

  // 11. 과도한 빈 줄(빈 줄 2개 이상) → 1개 (문단 구분용 빈 줄 1개는 유지)
  add('newlines', '과도한 빈 줄(2개 이상)', countMatches(s, MANY_NEWLINE_RE()))
  s = s.replace(MANY_NEWLINE_RE(), '\n\n')

  // 12. 줄 끝 쉼표 뒤 줄바꿈 → 한 문장으로 합침
  add('commaBreak', '문장 도중 줄바꿈(쉼표 뒤)', countMatches(s, COMMA_NEWLINE_RE()))
  s = s.replace(COMMA_NEWLINE_RE(), '$1 ')

  // 전체 앞뒤 공백·줄바꿈 정리
  s = s.trim()

  // 13. (옵션) 글자수 제한 초과
  if (limit != null) {
    const len = countChars(s).total
    if (len > limit) {
      issues.push({ key: 'overLimit', label: `글자수 초과 (${len.toLocaleString()} / ${limit.toLocaleString()}자)`, count: len - limit })
    }
  }

  return { cleaned: s, issues, ranges }
}
