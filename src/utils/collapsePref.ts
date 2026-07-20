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
