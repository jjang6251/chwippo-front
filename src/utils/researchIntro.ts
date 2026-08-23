/**
 * 「보드 진입 1회 노출」의 기억 — **이 사용자에게 조사 스트립이 실제로 뜬 적이 있는가.**
 *
 * ## 왜 필요한가
 *
 * 스트립(`CardResearchReveal`)은 **카드를 만드는 순간에만** 뜬다. 그런데 이미 카드를 만들어 둔
 * 기존 사용자는 그 순간을 영영 못 만난다 — 「회사 알아보기」가 생긴 걸 알 방법이 없다.
 * 공지로 "볼 수 있어요" 라고 **말하는** 것보다 그 사람 회사의 실제 키워드를 **보여주는** 게 세다.
 * 그래서 **보드 진입 시 1회** 자동 노출을 붙이고, 그 기회를 여기서 관리한다.
 *
 * ## 🔴 이 플래그의 뜻은 「시도했다」가 아니라 「떴다」다
 *
 * 기록 시점은 **스트립이 실제로 렌더된 순간**(`CardResearchReveal`)이다. 조사가 없어 아무것도
 * 안 떴으면 기회는 **그대로 남는다** — 나중에 그 회사 조사가 채워지면 그때 뜬다.
 * 커버리지가 낮은 지금 배포해도 기회가 낭비되지 않는 게 이 설계의 핵심이다.
 *
 * **카드 추가로 뜬 것도 같은 기회를 쓴다.** 새 사용자가 첫 카드에서 이미 봤는데 며칠 뒤 보드에
 * 들어왔다고 **같은 회사 걸 또 보면** 안 된다.
 *
 * ## 저장 형태
 *
 * - **사용자별 키** `chwippo:research-reveal-seen:{userId}` — 기존 관례
 *   (`chwippo:first-card-celebrated:{userId}` · `chwippo:research-seen:{userId}:{appId}`)를 따른다.
 * - 🔴 사용자 단위로 가른다 — 한 기기에서 계정을 바꿨을 때 남의 기록을 물려받으면 새 계정은
 *   이 기능을 소개받지 못한 채 시작한다.
 * - 카드별 열람 기억(`researchSeen.ts`)과 **다른 축**이다. 저쪽은 "이 카드 조사를 열었나"(계속
 *   쓸모 있는 신호), 이쪽은 "이 사람에게 한 번 보여줬나"(한 번 쓰고 죽는 기회).
 * - DB 작업 없음. 기기가 바뀌면 한 번 더 뜨는데, 그건 **그 기기에서 처음 보는 것**이라 맞는 동작이다.
 *
 * 🔴 **storage 접근 불가(사파리 프라이빗 등)면 「이미 봤음」으로 답한다** — 안 뜨는 쪽이다.
 * 저장이 안 되는 환경에서 뜨는 쪽을 고르면 **보드에 들어올 때마다** 3주 전 카드의 조사가
 * 다시 튀어나온다. 한 번 못 보는 것보다 매번 보는 게 훨씬 나쁘다.
 * (`firstCardCelebration`·`researchSeen` 도 같은 이유로 같은 방향을 고른다.)
 */

const KEY_PREFIX = 'chwippo:research-reveal-seen:'

/** 이 사용자에게 조사 스트립이 뜬 적이 있는가 (판정 불가 시 `true` — 위 주석 참조) */
export function hasSeenResearchReveal(userId: string | undefined): boolean {
  if (!userId) return true
  try {
    return localStorage.getItem(KEY_PREFIX + userId) !== null
  } catch {
    return true
  }
}

/** 노출 기록. 실패해도 조용히 넘어간다 — 다음 방문에 한 번 더 뜰 뿐이다 */
export function markResearchRevealSeen(userId: string | undefined): void {
  if (!userId) return
  try {
    localStorage.setItem(KEY_PREFIX + userId, new Date().toISOString())
  } catch {
    /* best-effort */
  }
}
