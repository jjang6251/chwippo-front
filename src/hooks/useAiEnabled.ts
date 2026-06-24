/**
 * AI 기능 일시 비활성화 flag.
 *
 * 베타 D-day (2026-08-14) 전 일정 관리 핵심에 집중 — AI 기능 진입점 차단.
 * 결제 인프라 도입 + AI 개발 재개 시 `return true` 로 변경.
 *
 * 복구 절차 — `company/07_ops/ai-features-disabled.md` 참고 (1줄 변경).
 *
 * **Hide 영역**:
 * - Sidebar 의 자소서 / 면접 준비 메뉴
 * - BoardDetail 의 자소서 / 면접 준비 탭
 * - 자소서 / 면접 페이지 라우트 가드 (dashboard redirect)
 * - 활동일지 노트의 AI 요약 button
 *
 * **유지** — 자소서 수동 작성, 활동일지, 회사조사 cache 표시, 모든 일정 관리.
 */
export function useAiEnabled(): boolean {
  return false
}
