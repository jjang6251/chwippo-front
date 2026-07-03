import { useState } from 'react'

/**
 * Native WebView 안에서 렌더링되는지 감지.
 *
 * chwippo-mobile 은 WebView 로드 시:
 *  - 커스텀 User-Agent 에 `chwippo-mobile-webview` 포함
 *  - 초기 URL query `?native=1` 첨부 (첫 진입만 · 이후 sessionStorage 로 유지)
 *
 * 감지된 경우:
 *  - MobileNav (하단 탭바) hide — 네이티브 tab bar 와 중첩 방지
 *  - MobileHeader (상단 헤더) hide — 네이티브에선 불필요
 *
 * 데스크탑 Sidebar 는 이미 `hidden lg:flex` 로 mobile viewport 에서 hide 됨.
 *
 * Apple Guideline 4.2 방어 — WebView 안에 웹 navigation 노출되면 "웹 wrapper" 로 판정 · reject 위험.
 */

const STORAGE_KEY = 'chwippo:native-mode'

function detectNativeMode(): boolean {
  if (typeof window === 'undefined') return false

  // 1) sessionStorage 우선 (라우팅으로 query param 이 사라져도 유지)
  if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return true

  // 2) URL query param `?native=1` (초기 진입 시)
  const params = new URLSearchParams(window.location.search)
  if (params.get('native') === '1') {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  }

  // 3) User-Agent 감지 (mobile 이 커스텀 UA 붙임)
  if (
    typeof navigator !== 'undefined' &&
    /chwippo-mobile-webview/i.test(navigator.userAgent)
  ) {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  }

  return false
}

export function useNativeMode(): boolean {
  // 초기 계산으로 확정 · UA 는 세션 내 변하지 않으므로 setState 재계산 불필요
  const [isNative] = useState<boolean>(() => detectNativeMode())
  return isNative
}
