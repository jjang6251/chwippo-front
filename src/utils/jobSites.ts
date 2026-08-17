/**
 * 공고 사이트 바로가기 허브 — 사이트 목록 (plans/jobsite-hub.md · 2026-08-17 CEO 확정).
 *
 * 🔴 **링크만 한다.** 크롤링·URL fetch·og 메타 수집은 영구 금지다 (잡코리아 v 사람인 판례 —
 * 법적 경계는 plan 문서 참조). 이름·도메인은 여기 하드코딩이 전부이고, 파비콘도 대상 사이트가
 * 아니라 Google s2 캐시(`getFaviconUrl`)에서 온다.
 *
 * ## 왜 이 5개인가 (2026-08-17 웹 리서치 실측)
 *
 * 범용 2대장 + 신입 특화 3종. 순서 = MAU순 → 특화순.
 * - 잡코리아 MAU 1,086만(21개월 연속 1위) · 사람인 979만 (2026 상반기)
 * - 자소설닷컴 = 신입 공채 달력 · 캐치 = 대기업·신입 기업분석 · 링커리어 = 인턴·대외활동
 * - **원티드는 뺐다** — MAU 48만(사람인의 1/20) + 경력 중심. 직군 슬롯(2단계) 후보로만
 *
 * ⚠️ 목록 변경 = 배포다 (admin 설정 아님 — N=9 규모에 과해서 의도적으로 상수).
 * 2단계(직군 맞춤 슬롯 — 개발이면 점핏·프로그래머스)는 클릭 계측 결과를 보고 결정한다.
 */
export interface JobSite {
  /** 계측 이벤트 이름에 들어간다 (`jobhub_{id}_{placement}`) — 영소문자만 */
  id: string
  name: string
  /** 파비콘 조회용 (Google s2) */
  domain: string
  url: string
}

export const JOB_SITES: readonly JobSite[] = [
  { id: 'jobkorea', name: '잡코리아', domain: 'www.jobkorea.co.kr', url: 'https://www.jobkorea.co.kr' },
  { id: 'saramin', name: '사람인', domain: 'www.saramin.co.kr', url: 'https://www.saramin.co.kr' },
  { id: 'jasoseol', name: '자소설닷컴', domain: 'jasoseol.com', url: 'https://jasoseol.com' },
  { id: 'catch', name: '캐치', domain: 'www.catch.co.kr', url: 'https://www.catch.co.kr' },
  { id: 'linkareer', name: '링커리어', domain: 'linkareer.com', url: 'https://linkareer.com' },
] as const
