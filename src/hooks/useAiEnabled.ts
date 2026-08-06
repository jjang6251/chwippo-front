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

/**
 * 면접 AI 진입점 전용 flag — 비공개 유지.
 *
 * 🔴 **품질 검증 미통과 상태다** (2026-08-07 교차검증). 답변에 면접장에서 말할 수 없는
 * 문장이 섞이고, 자료에 없는 기술을 "했다고 했는데" 로 단정하며, 활동 기록 참조가
 * 어긋난 사례가 남아 있다. 그대로 열면 사용자가 틀린 내용을 외워서 말한다.
 * 남은 수정과 재검증을 통과한 뒤에 켠다 (여기 1줄).
 *
 * 로컬 실기 확인이 필요하면 임시로 true 로 두되, **커밋 전에 반드시 되돌린다.**
 */
export function useInterviewAiEnabled(): boolean {
  return false
}
