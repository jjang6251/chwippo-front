import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useNativeMode } from '@/hooks/useNativeMode'

/**
 * 자소서 편집·AI 는 데스크탑 웹 전용 (CEO 결정 2026-07-09).
 * 모바일 뷰포트(lg 미만) 또는 RN 네이티브(태블릿 포함 — 뷰포트가 데스크탑 폭이어도
 * IAP 심사 리스크로 차단)는 보기 전용.
 *
 * 두 조건을 OR 하는 이유:
 *  - `useMediaQuery('(max-width: 1023px)')` 만으로는 태블릿 RN 앱(뷰포트가 lg 이상)에서
 *    편집·코인 소비 AI 가 노출되는 구멍이 생긴다.
 *  - `useNativeMode()` 를 함께 OR 해 뷰포트 폭과 무관하게 RN 네이티브(태블릿 포함)를
 *    Apple IAP 심사 리스크 차원에서 전부 보기 전용으로 강제한다.
 */
export function useCoverletterReadOnly(): boolean {
  // 두 훅 모두 무조건 호출 (rules-of-hooks) 후 OR — `||` 단락으로 조건 호출 금지
  const isBelowLg = useMediaQuery('(max-width: 1023px)')
  const isNative = useNativeMode()
  return isBelowLg || isNative
}
