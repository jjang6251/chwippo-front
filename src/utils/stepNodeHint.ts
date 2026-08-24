/**
 * 「단계 노드를 눌러 이동할 수 있다」 안내를 이 사용자에게 보여준 적이 있는가.
 *
 * ## 왜 안내가 필요한가
 *
 * 스텝바 노드는 **눌러서 현재 단계를 옮기는 컨트롤**인데, 그렇게 보이는 신호가
 * 데스크탑의 hover(툴팁·확대)뿐이었다. **터치에는 hover 가 없다.** 그래서 모바일
 * 사용자는 「단계 완료하기 버튼만 눌러야 하는 줄 알았다」고 했다 (2026-08-24 실사용 보고).
 *
 * 누름 피드백(`StepBar` 의 `pressedIndex`)이 붙었으니 **한 번 눌러보면** 그 다음부터는 안다.
 * 문제는 **첫 한 번**이라, 한 번만 말해주는 이 안내가 정확한 도구다.
 *
 * ## 기기 단위인 이유
 *
 * 사용자별 키를 쓰지만 저장소는 localStorage 라 **기기가 바뀌면 한 번 더 뜬다.**
 * 그건 그 기기에서 처음 보는 것이라 맞는 동작이다 — 조작법 안내는 기기마다 한 번씩
 * 봐도 손해가 없다. DB 작업이 필요 없다는 뜻이기도 하다.
 * 키 형태는 기존 관례(`chwippo:research-reveal-seen:{userId}` ·
 * `chwippo:first-card-celebrated:{userId}`)를 그대로 따른다.
 *
 * 🔴 **storage 접근 불가(사파리 프라이빗 등)면 「이미 봤음」으로 답한다** — 안 뜨는 쪽이다.
 * 저장이 안 되는 환경에서 뜨는 쪽을 고르면 **보드에 들어올 때마다** 같은 안내가 나온다.
 * 한 번 못 보는 것보다 매번 보는 게 훨씬 나쁘다 (`researchIntro` 와 같은 판단).
 */

const KEY_PREFIX = 'chwippo:step-node-hint-seen:'

/** 이 사용자에게 안내가 뜬 적이 있는가 (판정 불가 시 `true` — 위 주석 참조) */
export function hasSeenStepNodeHint(userId: string | undefined): boolean {
  if (!userId) return true
  try {
    return localStorage.getItem(KEY_PREFIX + userId) !== null
  } catch {
    return true
  }
}

/** 노출 기록. 실패해도 조용히 넘어간다 — 다음 방문에 한 번 더 뜰 뿐이다 */
export function markStepNodeHintSeen(userId: string | undefined): void {
  if (!userId) return
  try {
    localStorage.setItem(KEY_PREFIX + userId, new Date().toISOString())
  } catch {
    /* best-effort */
  }
}
