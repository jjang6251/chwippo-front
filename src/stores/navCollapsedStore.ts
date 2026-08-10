import { create } from 'zustand'

/**
 * 전역 메뉴(사이드바) 접기 — 데스크탑 전용.
 *
 * 🔴 **왜 필요했나** (2026-08-10). 면접 ↔ 자소서 나란히 보기가 콘텐츠 폭 862px 을 요구하는데,
 * 사이드바가 `lg`(1024) 에서 나타나며 **224px 을 한꺼번에 가져간다.** 그래서 창을 넓힐수록
 * 「1열 → 2열 → 1열 → 2열」 로 **비단조**하게 움직이는 구간(1024~1157)이 생겼다.
 * 접힌 레일(56px)이면 1024 에서도 콘텐츠가 888px 이라 그 구간이 사라진다.
 *
 * 폭 제한(`max-w-[1100px]`)을 푸는 대신 이 길을 택했다 — 넓게 보고 싶을 때 **사용자가**
 * 메뉴를 접는 쪽이, 모든 페이지의 줄길이가 화면 따라 늘어나는 것보다 낫다는 판단.
 *
 * 저장한다. 접는 건 「지금 이 화면만」이 아니라 **작업 방식**이라, 페이지를 옮기거나
 * 새로고침할 때마다 되돌아오면 매번 다시 접어야 한다.
 */
const STORAGE_KEY = 'chwippo-nav-collapsed'

function loadInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Safari 프라이빗 등 localStorage 차단 환경 — 펼친 상태가 안전한 기본값
    return false
  }
}

interface NavCollapsedState {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

export const useNavCollapsedStore = create<NavCollapsedState>((set) => ({
  collapsed: loadInitial(),
  setCollapsed: (collapsed) => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* 저장 실패해도 이번 세션 동작은 유지 */
    }
    set({ collapsed })
  },
}))
