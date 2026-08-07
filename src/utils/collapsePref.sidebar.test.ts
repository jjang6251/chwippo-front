/**
 * 면접 세션 사이드바 펼침 기본값 규칙.
 *
 * 🔴 이 키만 다른 접힘 카드와 **기본값이 반대**다 — 공고 요건·DART 는 기본 접힘이지만
 * 사이드바는 접힌 채로 시작하면 **자료가 있는지조차 보이지 않는다.**
 * `loadCollapseExpanded` 를 그대로 쓰면 값이 없을 때 접힘이 되므로 호출부가
 * `getItem` 을 직접 읽어 "저장값 없음"과 "접힘으로 저장됨"을 구분한다.
 *
 * ⚠️ **화면 폭은 더 이상 초기값에 관여하지 않는다** (2026-08-06). 사이드바가
 * `hidden md:block` 으로 **데스크탑 전용**이 되면서, 모바일에서는 이 값과 무관하게
 * 렌더되지 않는다. 모바일의 자료 창구는 `세션 자료` 모달이다.
 * 폭 분기를 여기 남겨두면 "모바일에서 접힘으로 저장" 된 사용자가 데스크탑에서도
 * 접힌 채로 시작하는 혼선이 생긴다.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  INTERVIEW_SIDEBAR_EXPANDED_STORAGE_KEY as KEY,
  saveCollapseExpanded,
} from './collapsePref'

/** InterviewSessionPage 의 초기값 로직과 같은 규칙 */
function resolveInitial(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved !== null) return saved === '1'
  } catch {
    /* 접근 불가 → 기본 펼침 */
  }
  return true
}

describe('면접 사이드바 펼침 기본값', () => {
  beforeEach(() => localStorage.clear())

  it('저장값이 없으면 펼침 — 접힌 채 시작하면 자료가 있는지조차 안 보인다', () => {
    expect(resolveInitial()).toBe(true)
  })

  it('🔴 사용자가 접었으면 접힌 채로 복원된다', () => {
    saveCollapseExpanded(KEY, false)
    expect(resolveInitial()).toBe(false)
  })

  it('사용자가 펼쳤으면 펼친 채로 복원된다', () => {
    saveCollapseExpanded(KEY, true)
    expect(resolveInitial()).toBe(true)
  })

  it('다른 접힘 카드 키와 섞이지 않는다', () => {
    saveCollapseExpanded('board:jobposting-expanded:v1', false)
    expect(resolveInitial()).toBe(true) // 저장값 없음 → 기본 펼침
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
