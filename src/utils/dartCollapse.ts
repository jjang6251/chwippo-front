/**
 * card-detail-remodel — BoardDetail "회사 정보(DART)" 섹션 펼침/접힘 기억.
 *
 * 범용 collapsePref 유틸에 위임 (공고 요건 등 접힘 카드와 구현 공유). API·키는 하위호환 유지.
 */
import { loadCollapseExpanded, saveCollapseExpanded } from './collapsePref'

export const DART_EXPANDED_STORAGE_KEY = 'board:dart-expanded:v1'

/** localStorage 에서 펼침 상태 복원. 없거나 접근 불가 시 기본값 false(접힘). */
export function loadDartExpanded(): boolean {
  return loadCollapseExpanded(DART_EXPANDED_STORAGE_KEY)
}

export function saveDartExpanded(expanded: boolean): void {
  saveCollapseExpanded(DART_EXPANDED_STORAGE_KEY, expanded)
}
