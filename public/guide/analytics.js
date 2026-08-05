/**
 * 가이드 페이지(정적 HTML) 전용 Clarity 로더.
 *
 * 🔴 **왜 따로 필요한가** — 가이드 6장은 `public/` 의 정적 HTML 이라 SPA 밖이다.
 * `src/lib/clarity.ts` 의 `initClarity()` 는 React 앱이 부팅될 때만 돈다. 그래서 2026-08-06
 * 실측 시 **가이드 페이지에 추적 태그가 0개**였다 — SEO 로 만든 표면인데 유입이 잡히는 곳이
 * GSC 노출·클릭밖에 없었다.
 *
 * ⚠️ **ID 가 SPA 와 두 곳에 나뉜다.** SPA 는 `VITE_CLARITY_PROJECT_ID` (env), 여기는 상수다.
 * 정적 HTML 은 빌드 치환을 못 받기 때문이다. **프로젝트 ID 를 바꾸면 두 곳 다 바꾼다** —
 * `src/lib/clarity.ts` 상단에도 같은 경고를 달아 뒀다.
 *
 * 🔴 이 ID 는 비밀이 아니다. 모든 방문자의 브라우저가 `clarity.ms/tag/{ID}` 를 직접 받아가므로
 * 이미 완전 공개된 값이다 (GA measurement ID 와 같은 성격). public 레포 커밋으로 새로 노출되는
 * 정보가 없다.
 *
 * ⚠️ 마스킹은 붙이지 않는다 — 가이드에는 사용자 데이터가 렌더되지 않는다. 앱 화면의
 * 자소서·활동 기록 마스킹은 `ClarityMask` 가 담당한다.
 */
;(function () {
  // 🔴 운영 도메인에서만 수집한다. 없으면 로컬 개발·CI e2e·Vercel 프리뷰 트래픽이 전부
  //    운영 Clarity 프로젝트에 섞여 들어간다 (env 가드를 쓰는 SPA 와 달리 이 파일은 상수라서
  //    가드가 없으면 어디서 열든 켜진다).
  var HOSTS = ['chwippo.com', 'www.chwippo.com']
  if (HOSTS.indexOf(location.hostname) === -1) return

  var PROJECT_ID = 'xx3xca2tts'

  // Microsoft 가 안내하는 형태 그대로 (`src/lib/clarity.ts` 와 동일)
  window.clarity =
    window.clarity ||
    function () {
      ;(window.clarity.q = window.clarity.q || []).push(arguments)
    }

  var s = document.createElement('script')
  s.id = 'clarity-script'
  s.async = true
  s.src = 'https://www.clarity.ms/tag/' + PROJECT_ID
  document.head.appendChild(s)
})()
