/**
 * Microsoft Clarity — 서비스 이용 행태 분석 (히트맵·세션 리플레이).
 *
 * **왜 붙이나** — 2026-08-04 확인: 실사용자의 자소서 AI 사용이 **0건**이었다. 카드는 늘고
 * d7 리텐션 56%(9명 코호트)인데 AI 만 아무도 안 쓴다. **"어디서 멈추는가" 를 볼 수단이 없어서**
 * 원인을 추측만 할 수 있었다 (GA·Mixpanel 등 미설치).
 *
 * 🔴 **`VITE_CLARITY_PROJECT_ID` 미설정이면 완전 no-op** — Sentry 와 같은 패턴이다.
 * 방침보다 먼저 켜면 **고지 없는 수집**이 되므로 순서는 항상 **방침 배포 → ID 주입** 이다.
 * (초안은 8/11 시행이었으나 CEO 가 2026-08-04 즉시 시행으로 결정했고, 그날 ID 를 주입했다.
 * 2026-08-06 운영 번들에서 주입 확인.)
 *
 * ⚠️ **이 파일은 SPA 만 담당한다.** `public/guide/*.html` 6장은 React 밖이라 여기가 안 돈다 —
 * 그쪽은 `public/guide/analytics.js` 가 따로 붙인다. **프로젝트 ID 를 바꾸면 두 곳 다 바꾼다**
 * (여기는 env, 저기는 상수 — 정적 HTML 이 빌드 치환을 못 받기 때문).
 *
 * ## 마스킹 — 이게 이 파일의 핵심이다
 *
 * 치뽀 화면에는 **자소서 본문·지원 회사·활동 기록** 이 그대로 렌더된다. 세션 리플레이는
 * DOM 을 기록하므로, 설정 없이 붙이면 **남의 자소서를 영상으로 보관**하게 된다.
 *
 * Clarity 기본값도 입력창·숫자·이메일은 마스킹하지만(마스킹된 콘텐츠는 업로드되지 않음),
 * 그것만으로는 부족하다 — 자소서 본문은 `<div>` 로도 렌더된다. 그래서
 * **민감 화면 컨테이너에 `data-clarity-mask="true"`** 를 직접 붙인다 (`useClarityMask`).
 *
 * ⚠️ **"특정 화면에서 수집 중단" 은 불가능하다.** Clarity 클라이언트 API 는
 * `consent`·`identify`·`set`·`event`·`upgrade` 뿐이고 **stop/pause 가 없다.** SPA 라 스크립트가
 * 한 번 로드되면 이후 라우팅까지 기록된다. 그래서 방침 문구도 "수집하지 않습니다" 가 아니라
 * **"마스킹되어 전송되지 않습니다"** 로 적었다 — 지킬 수 있는 말만 쓴다.
 *
 * ⚠️ 앱(WebView)에서는 붙이지 않는다. 네이티브 화면 흐름과 섞이면 해석이 어긋나고,
 * 앱 사용자는 별도 분석 경로가 필요하다.
 */

const SCRIPT_ID = 'clarity-script'

/** 앱 WebView 여부 — `index.html` 이 세운 표식을 그대로 쓴다 */
function isNative(): boolean {
  return document.documentElement.dataset.native === '1'
}

/**
 * Clarity 초기화. 미설정·앱·중복 호출 시 아무것도 하지 않는다.
 *
 * 스크립트는 Microsoft 가 안내하는 형태 그대로 주입한다.
 */
export function initClarity(): void {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID
  if (!projectId) return // 미설정 = 비활성 (시행일 전·로컬·CI)
  if (isNative()) return
  if (document.getElementById(SCRIPT_ID)) return // 중복 주입 방지

  const w = window as unknown as {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] }
  }
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      ;(w.clarity!.q = w.clarity!.q || []).push(args)
    }

  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.async = true
  s.src = `https://www.clarity.ms/tag/${projectId}`
  document.head.appendChild(s)
}

/** Clarity 가 실제로 켜져 있는가 (admin 상태 표시용) */
export function isClarityActive(): boolean {
  return Boolean(import.meta.env.VITE_CLARITY_PROJECT_ID) && !isNative()
}

/**
 * 민감 화면 컨테이너에 붙이는 마스킹 속성.
 *
 * ```tsx
 * <div {...CLARITY_MASK}>{/* 자소서 본문 *\/}</div>
 * ```
 *
 * 🔴 `data-clarity-mask="false"` 는 **효과가 없다** (Microsoft 문서 명시).
 * 해제하려면 `data-clarity-unmask` 를 써야 하므로, 실수로 노출될 방향이 아니다.
 */
export const CLARITY_MASK = { 'data-clarity-mask': 'true' } as const
