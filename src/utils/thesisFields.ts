/**
 * 「논문」 섹션이 쓰는 대학원 키 — 필드 사전에서 **이름으로 골라** 그린다.
 *
 * 🔴 사전의 `storage:'extra'` 를 전부 그리지 않는다. 옛 배포본에는 추가 정보 6키(취미·특기 등)가
 * 아직 살아 있을 수 있고, 앞으로 다른 extra 키가 늘 수도 있다 — 이 섹션은 아래 4키만 본다.
 * 그래서 사전 응답이 옛 것이든 새 것이든 결과가 같다 (못 찾은 키는 조용히 빠진다).
 *
 * 훅(`useThesisFields`)이 아니라 여기 두는 이유: 게이지(`myinfoProgress`)도 같은 목록을 봐야
 * 하는데, 순수 유틸이 훅을 import 하면 방향이 뒤집힌다.
 */
export const THESIS_FIELD_KEYS = [
  'academic_advisor',
  'research_field',
  'paper_title',
  'paper_content',
] as const

/** 「논문」 섹션이 열리는 최종 학력 — 지도교수·논문은 석·박사 지원서에만 있는 칸이다 */
export const GRAD_DEGREES = ['master', 'doctor'] as const
