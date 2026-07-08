/**
 * AI 기능 공개 flag (기능별).
 *
 * 2026-07-08 — AI 재공개 (자소서 + 활동일지 노트 요약 + 코인 UI). 유저 트리거
 * 회사 조사는 코드에서 완전 제거됨 (pre-seed 캐시 조회만 유지).
 *
 * 면접 AI (사이드바 메뉴 · BoardDetail 탭 · /interviews 라우트) 는 비공개 유지 —
 * 공개 시점에 `useInterviewAiEnabled` 를 true 로 변경 (1줄).
 *
 * 이력 — company/07_ops/ai-features-disabled.md (2026-06-24 전면 차단 → 부분 재공개).
 */
export function useAiEnabled(): boolean {
  return true
}

/** 면접 AI 진입점 전용 flag — 비공개 유지 */
export function useInterviewAiEnabled(): boolean {
  return false
}
