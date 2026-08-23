/**
 * 「회사 알아보기」 미열람 점의 기억 — **이 카드의 조사를 한 번이라도 열었는가.**
 *
 * ## 왜 이 뜻인가
 *
 * 🔴 **핵심은 점의 모양이 아니라 사라지는 조건이다.** 항상 켜져 있으면 벽지가 되고, 더 나쁘게는
 * **읽지 않은 알림처럼 읽혀 계속 거슬린다.** 그래서 「새 기능이 생겼어요」(한 번 쓰고 죽는 신호)가
 * 아니라 **「이 회사 건 아직 안 봤어요」**(계속 쓸모 있는 신호)로 정의한다 —
 * 새 회사를 추가하면 그 카드엔 다시 뜨고, 이미 본 회사는 조용하다.
 *
 * ## 저장 형태
 *
 * - **카드별 × 사용자별 키** `chwippo:research-seen:{userId}:{appId}` — 기존 관례
 *   (`chwippo:first-card-celebrated:{userId}` · `chwippo:weekly-prompt:{weekStart}`)를 따른다.
 * - 🔴 **사용자 단위로 가르는 게 필수다.** 한 기기에서 계정을 바꿨을 때 남의 열람 기록을
 *   물려받으면 새 계정의 카드가 처음부터 조용해진다.
 * - 🔴 배열 1개(JSON)가 아니라 **키를 카드마다 나눈다.** 여러 탭이 동시에 열려 있을 때
 *   read-modify-write 는 서로의 기록을 덮어쓴다 — 키를 나누면 그 경합 자체가 없다.
 *   개수는 카드 수만큼이라 사실상 수십 개다.
 * - DB 작업 없음 (localStorage 전용). 기기가 바뀌면 점이 다시 뜨는데, 그건 **다른 기기에서
 *   처음 보는 것**이라 오히려 맞는 동작이다.
 *
 * 🔴 **storage 접근 불가(사파리 프라이빗 등)면 「봤음」으로 답한다** — 점을 띄우는 쪽이 아니라.
 * 저장이 안 되는 환경에서 점을 띄우면 **영원히 사라지지 않는 점**이 되어, 위에서 피하려던
 * "거슬리는 벽지" 를 정확히 만든다. (`firstCardCelebration` 도 같은 이유로 연출을 생략한다.)
 */

const KEY_PREFIX = 'chwippo:research-seen:'

const storageKey = (userId: string, applicationId: string) =>
  `${KEY_PREFIX}${userId}:${applicationId}`

/** 이 사용자가 이 카드의 조사를 열어본 적이 있는가 (판정 불가 시 `true` — 위 주석 참조) */
export function hasSeenResearch(
  userId: string | undefined,
  applicationId: string,
): boolean {
  if (!userId || !applicationId) return true
  try {
    return localStorage.getItem(storageKey(userId, applicationId)) !== null
  } catch {
    return true
  }
}

/** 열람 기록. 실패해도 조용히 넘어간다 — 점이 한 번 더 뜰 뿐 기능에는 영향이 없다 */
export function markResearchSeen(
  userId: string | undefined,
  applicationId: string,
): void {
  if (!userId || !applicationId) return
  try {
    localStorage.setItem(storageKey(userId, applicationId), new Date().toISOString())
  } catch {
    /* best-effort */
  }
}
