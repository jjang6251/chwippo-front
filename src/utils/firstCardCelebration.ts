import type { Application } from '@/types/application'

/**
 * A5 — 첫 지원 카드 생성 보상 연출 판정.
 *
 * 규칙:
 * - 계정당 1회 (localStorage, userId 별 키) — 삭제 후 재생성 시 재발동 방지
 * - 샘플 카드(is_sample)는 "첫 카드" 판정에서 제외
 * - 온보딩 투어 중엔 투어가 흐름을 안내하므로 생략 (기회는 소진 처리)
 * - applications 캐시가 없으면 판정 불가 → 보수적으로 생략
 */

const KEY_PREFIX = 'chwippo:first-card-celebrated:'

export function hasCelebratedFirstCard(userId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + userId) !== null
  } catch {
    return true // storage 접근 불가 (사파리 프라이빗 등) → 연출 생략이 안전
  }
}

export function markFirstCardCelebrated(userId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + userId, new Date().toISOString())
  } catch {
    // best-effort — 실패해도 연출만 중복될 수 있을 뿐 기능 영향 없음
  }
}

export function shouldCelebrateFirstCard(opts: {
  userId: string | undefined
  /** 생성 직전 시점의 목록 (react-query 캐시). undefined = 판정 불가 */
  existingApplications: Application[] | undefined
  /** 방금 생성된 카드 id — 캐시에 이미 반영됐어도 제외하고 판정 */
  createdId: string
}): boolean {
  const { userId, existingApplications, createdId } = opts
  if (!userId || !existingApplications) return false
  if (hasCelebratedFirstCard(userId)) return false

  /**
   * 🔴 **온보딩이 담아 준 「지원 예정」 카드는 「이미 카드가 있던 유저」로 치지 않는다.**
   *
   * 온보딩 2단 보상이 만드는 카드는 `is_sample = false` 인 **진짜 회사의 진짜 카드**라
   * 예전 필터(`!isSample`)에 그대로 걸렸다. 그 결과 회사를 하나라도 담은 사람은 나중에
   * 처음으로 「지원 중」 카드를 만들어도 **축하가 영영 안 떴다** — 기회가 조용히 소진됐다.
   *
   * 픽 카드는 사용자가 **고르기만** 한 것이지 지원을 시작한 게 아니다(상태가 `PLANNED`,
   * 마감일도 스텝 날짜도 없다). 첫 축하가 말하는 「입력 1번 = 관리 3종」은 지원을 시작할 때
   * 일어나는 일이므로, 축하의 기준도 **첫 「지원 중」 카드**여야 한다.
   *
   * 🔴 `PLANNED` 을 함께 본다 — 픽 카드를 「지원 시작」으로 승격했다면 그건 이미 진짜
   * 지원이라 다음 카드가 「첫 카드」일 수 없다.
   */
  const priorRealCards = existingApplications.filter(
    (a) =>
      !a.isSample &&
      a.id !== createdId &&
      !(a.createdVia === 'onboarding_pick' && a.status === 'PLANNED'),
  )
  if (priorRealCards.length > 0) {
    // 이미 카드가 있던 유저(연출 도입 전 가입 등) — 기회 소진 처리
    markFirstCardCelebrated(userId)
    return false
  }

  // 여기부터는 "진짜 첫 카드" — 기회는 1회 소진
  //
  // 🔴 예전엔 `tourActive` 를 받아 **투어 중이면 연출을 생략**했다 (온보딩 투어와
  // 축하 오버레이가 겹치면 둘 다 안 읽힌다). 2026-08-17 투어를 제거하면서 축을 없앴다 —
  // 겹칠 상대가 사라졌으므로 「진짜 첫 카드면 무조건 축하」로 단순해진다.
  markFirstCardCelebrated(userId)
  return true
}
