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
  tourActive: boolean
}): boolean {
  const { userId, existingApplications, createdId, tourActive } = opts
  if (!userId || !existingApplications) return false
  if (hasCelebratedFirstCard(userId)) return false

  const priorRealCards = existingApplications.filter(
    (a) => !a.isSample && a.id !== createdId,
  )
  if (priorRealCards.length > 0) {
    // 이미 카드가 있던 유저(연출 도입 전 가입 등) — 기회 소진 처리
    markFirstCardCelebrated(userId)
    return false
  }

  // 여기부터는 "진짜 첫 카드" — 보여주든 투어로 생략하든 기회는 1회 소진
  markFirstCardCelebrated(userId)
  return !tourActive
}
