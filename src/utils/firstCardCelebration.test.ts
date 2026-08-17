/**
 * A5 — 첫 카드 연출 판정 시나리오:
 * 1. 빈 목록 + 첫 실 카드 → true + seen 마킹
 * 2. 샘플 카드만 있는 목록 → true (샘플은 판정 제외)
 * 3. 생성 카드가 캐시에 이미 반영돼도 (createdId 제외) → true
 * 4. 이미 실 카드 보유 → false + seen 마킹 (도입 전 유저 영구 소진)
 * 5. seen 플래그 존재 → false (삭제 후 재생성 재발동 방지)
 * 6. 투어 중 → false 지만 seen 마킹 (기회 소진)
 * 7. userId 없음 → false + 마킹 안 함
 * 8. 캐시 undefined → false + 마킹 안 함 (판정 불가 — 기회 보존)
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasCelebratedFirstCard,
  shouldCelebrateFirstCard,
} from './firstCardCelebration'
import type { Application } from '@/types/application'

const USER = 'user-1'
const app = (id: string, isSample = false) =>
  ({ id, isSample, companyName: 'c', status: 'IN_PROGRESS' }) as Application

const base = {
  userId: USER,
  existingApplications: [] as Application[],
  createdId: 'new-1',
}

describe('shouldCelebrateFirstCard', () => {
  beforeEach(() => localStorage.clear())

  it('1) 빈 목록 + 첫 실 카드 → true + seen 마킹', () => {
    expect(shouldCelebrateFirstCard(base)).toBe(true)
    expect(hasCelebratedFirstCard(USER)).toBe(true)
  })

  it('2) 샘플 카드만 있는 목록 → true', () => {
    expect(
      shouldCelebrateFirstCard({
        ...base,
        existingApplications: [app('s1', true), app('s2', true)],
      }),
    ).toBe(true)
  })

  it('3) 생성 카드가 캐시에 이미 반영돼도 createdId 제외 → true', () => {
    expect(
      shouldCelebrateFirstCard({
        ...base,
        existingApplications: [app('new-1')],
      }),
    ).toBe(true)
  })

  it('4) 이미 실 카드 보유 → false + seen 마킹 (영구 소진)', () => {
    expect(
      shouldCelebrateFirstCard({
        ...base,
        existingApplications: [app('old-1')],
      }),
    ).toBe(false)
    // 이후 카드 전부 삭제하고 다시 만들어도 재발동 없음
    expect(shouldCelebrateFirstCard(base)).toBe(false)
  })

  it('5) seen 플래그 존재 → false', () => {
    shouldCelebrateFirstCard(base) // 1회 소진
    expect(shouldCelebrateFirstCard({ ...base, createdId: 'new-2' })).toBe(false)
  })

  // 6) 「투어 중 → 생략」 케이스는 2026-08-17 온보딩 투어 제거로 함께 삭제.
  //    겹칠 오버레이가 없어져 판정 축 자체가 사라졌다.

  it('7) userId 없음 → false + 마킹 안 함', () => {
    expect(shouldCelebrateFirstCard({ ...base, userId: undefined })).toBe(false)
    expect(hasCelebratedFirstCard(USER)).toBe(false)
  })

  it('8) 캐시 undefined → false + 마킹 안 함 (기회 보존)', () => {
    expect(
      shouldCelebrateFirstCard({ ...base, existingApplications: undefined }),
    ).toBe(false)
    expect(hasCelebratedFirstCard(USER)).toBe(false)
  })
})
