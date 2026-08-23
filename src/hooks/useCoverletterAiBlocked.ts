import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useNativeMode } from '@/hooks/useNativeMode'

/**
 * 🔴 **자소서 AI 차단 게이트 — 이 조건이 IAP 방어선이다. 완화 금지.**
 *
 * 막는 것은 **코인을 쓰는 AI 진입점**뿐이다: 「✨ AI 에게 묻기」·「🔍 자소서 검사」·
 * AI 채팅 패널(데스크탑 aside)·모바일 AI FAB·바텀시트·공고 파싱.
 * 문항·답변 **편집은 막지 않는다** (2026-08-23 CEO — 모바일 편집 개방).
 *
 * 왜 이 한 줄이 방어선인가: 치뽀 앱은 `https://chwippo.com` 을 띄우는 **WebView 셸**이라
 * **웹을 배포하면 앱 심사 없이 앱 안 동작이 바뀐다.** 코인 소비 기능이 앱에 노출되면
 * Apple IAP 강제 대상이 되는데, 실수로 열려도 **아무도 안 막고 우리도 모른다.**
 *
 * 두 조건을 OR 하는 이유:
 *  - `useMediaQuery('(max-width: 1023px)')` 만으로는 태블릿 RN 앱(뷰포트가 lg 이상)에서
 *    코인 소비 AI 가 노출되는 구멍이 생긴다.
 *  - `useNativeMode()` 를 함께 OR 해 뷰포트 폭과 무관하게 RN 네이티브(태블릿 포함)를
 *    Apple IAP 심사 리스크 차원에서 전부 차단한다.
 *
 * 회귀 방어: `src/pages/Coverletter/CoverletterDocPage.aiBlock.test.tsx`
 */
export function useCoverletterAiBlocked(): boolean {
  // 두 훅 모두 무조건 호출 (rules-of-hooks) 후 OR — `||` 단락으로 조건 호출 금지
  const isBelowLg = useMediaQuery('(max-width: 1023px)')
  const isNative = useNativeMode()
  return isBelowLg || isNative
}
