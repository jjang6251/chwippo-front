import type { InterviewKeyword } from '@/types/interviewPrep'

/**
 * 회사 조사 `interviewKeywords` 칩의 카테고리별 색.
 *
 * - tech: 기술·아키텍처 (파랑)
 * - talent: 인재상·문화 (초록)
 * - business: 사업·전략 (보라)
 * - role: 직무 특화 (주황)
 * - issue: 회사 이슈 (빨강)
 *
 * 🔴 **공용 위치인 이유** — 원래 `CompanyResearchCard` 안 지역 상수였는데
 * 카드 추가 직후 인라인 펼침(`CardResearchReveal`)이 같은 칩을 쓴다. 두 벌로 두면
 * 한쪽만 색을 고치는 순간 같은 키워드가 화면마다 다른 색이 된다.
 */
export const KEYWORD_CATEGORY_STYLE: Record<string, string> = {
  tech: 'bg-info/10 text-info border-info/30',
  talent: 'bg-success/10 text-success border-success/30',
  business: 'bg-violet/10 text-violet border-violet/30',
  role: 'bg-warning/10 text-warning border-warning/30',
  issue: 'bg-danger/10 text-danger border-danger/30',
}

/** 카테고리 없는 legacy string 키워드 (구 캐시) 기본색 */
export const KEYWORD_DEFAULT_STYLE = 'bg-info/10 text-info border-info/30'

/**
 * 키워드 하나를 표시용 `{ keyword, style }` 로 정규화.
 * 캐시에 `InterviewKeyword` 객체와 구 `string` 이 섞여 있어 소비처마다 같은 분기를 쓴다.
 */
export function keywordChip(kw: InterviewKeyword | string): {
  keyword: string
  style: string
} {
  const isObj = typeof kw === 'object' && kw !== null
  const keyword = isObj ? kw.keyword : kw
  const category = isObj ? kw.category : null
  return {
    keyword,
    style: (category && KEYWORD_CATEGORY_STYLE[category]) || KEYWORD_DEFAULT_STYLE,
  }
}
