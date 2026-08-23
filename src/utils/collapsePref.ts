/**
 * 접힘/펼침 선호 전역 저장 (localStorage) — 범용 유틸.
 *
 * BoardDetail 의 DART(회사 정보)·공고 요건 등 접힘 카드가 공유. 키만 다르게 전달.
 * 정책: 기본 접힘(false). localStorage 접근 불가(프라이빗 모드 등)면 조용히 기본값.
 */

/** localStorage 에서 펼침 상태 복원. 없거나 접근 불가 시 false(접힘). */
export function loadCollapseExpanded(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function saveCollapseExpanded(key: string, expanded: boolean): void {
  try {
    localStorage.setItem(key, expanded ? '1' : '0')
  } catch {
    /* 저장 실패는 조용히 무시 (세션 내 상태는 유지) */
  }
}

/**
 * 펼친 항목 id 목록 복원 — **저장값이 없으면 `null`**.
 *
 * 🔴 `loadCollapseExpanded` 로는 못 하는 구분이 필요해서 따로 둔다:
 * 「아직 아무것도 안 건드림」(null)과 「전부 접어 둠」(`[]`)은 다르다.
 * 전자는 기본 동작(첫 문항 자동 펼침)을 돌려도 되지만, 후자에 그러면
 * **사용자가 접은 걸 매번 다시 펼치는 것**이 된다.
 */
export function loadExpandedIds(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    // 손상된 값(수동 편집·구버전)은 「없음」으로 취급 — 던지면 페이지가 죽는다
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null
  } catch {
    return null
  }
}

export function saveExpandedIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* 저장 실패는 조용히 무시 (세션 내 상태는 유지) */
  }
}

/**
 * 공고 요건 접힘 상태 키 — **카드 상세와 자소서 풀페이지가 공유한다.**
 * 같은 배너·같은 데이터라, "공고 요건은 접어두고 싶다" 는 화면과 무관한 선호다.
 * 화면마다 따로 두면 "여긴 기억하는데 저긴 왜 안 하지" 가 생긴다 (2026-08-23 실사용 지적).
 */
export const JOB_POSTING_EXPANDED_STORAGE_KEY = 'board:jobposting-expanded:v1'

/** 회사 조사 배너 접힘 상태 키 — 위와 같은 이유로 소비처(자소서·카드 상세 탭) 공유 */
export const COMPANY_RESEARCH_EXPANDED_STORAGE_KEY = 'coverletter:research-expanded:v1'

/** 자소서 문항 카드 펼침 목록 키 — **지원 카드별**(회사마다 자소서가 다르다) */
export const coverletterExpandedKey = (applicationId: string) =>
  `coverletter:expanded:${applicationId}`

/**
 * 면접 세션 좌측 자료 사이드바 펼침 상태 키.
 *
 * ⚠️ 이 키만 **기본값이 "펼침"** 이다. `loadCollapseExpanded` 는 값이 없을 때 접힘(false)을
 * 돌려주므로, 호출부가 `getItem` 을 직접 읽어 "저장값 없음" 과 "접힘으로 저장됨" 을 구분한다.
 * 사이드바는 접힌 채로 시작하면 자료가 있는지조차 모른다.
 *
 * 사이드바는 **데스크탑 전용**이다 (`hidden md:block`) — 모바일에서는 이 값과 무관하게
 * 렌더되지 않고, 자료는 `세션 자료` 모달이 전담한다.
 */
export const INTERVIEW_SIDEBAR_EXPANDED_STORAGE_KEY =
  'interview:sidebar-expanded:v1'
