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

/** BoardDetail 공고 요건 접힘 상태 키 */
export const JOB_POSTING_EXPANDED_STORAGE_KEY = 'board:jobposting-expanded:v1'

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
