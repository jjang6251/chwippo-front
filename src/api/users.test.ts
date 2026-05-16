/**
 * api/users.ts 단위 테스트 — patchDashboardConfig 화이트리스트 필터.
 *
 * 시나리오:
 * 1. 모든 ID가 KNOWN 리스트에 있음 → 그대로 전송
 * 2. KNOWN에 없는 ID 1개 섞임 (예: 'myinfo_progress') → 해당 ID 필터링, 나머지만 전송
 * 3. 모두 unknown → 빈 sections 전송 (호출자 결정)
 * 4. 알려진 ID 순서 보존 (reorder 케이스)
 *
 * Why: 옛 버전 앱에서 만들어진 orphan section ID가 사용자 DB에 남아있다가 reorder 시
 * 그대로 echo back되면 백엔드 @IsIn 검증 400. 저장 직전 필터로 자동 정리.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  patchDashboardConfig,
  KNOWN_DASHBOARD_SECTION_IDS,
} from './users'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}))

const mockedPatch = vi.mocked(apiClient.patch)

beforeEach(() => {
  vi.clearAllMocks()
  mockedPatch.mockResolvedValue({
    data: { data: { sections: [] } },
  } as never)
})

describe('patchDashboardConfig — orphan section ID 필터', () => {
  it('1. 모든 ID 유효 → 그대로 전송', async () => {
    const input = {
      sections: [
        { id: 'stats', visible: true },
        { id: 'dday', visible: true },
        { id: 'todos', visible: false },
      ],
    }
    await patchDashboardConfig(input)
    expect(mockedPatch).toHaveBeenCalledWith(
      '/users/me/dashboard-config',
      input,
    )
  })

  it("2. unknown ID(예: 'myinfo_progress') 섞임 → 필터링", async () => {
    await patchDashboardConfig({
      sections: [
        { id: 'stats', visible: true },
        { id: 'myinfo_progress', visible: true }, // ← orphan
        { id: 'dday', visible: true },
      ],
    })
    expect(mockedPatch).toHaveBeenCalledWith('/users/me/dashboard-config', {
      sections: [
        { id: 'stats', visible: true },
        { id: 'dday', visible: true },
      ],
    })
  })

  it('3. 모두 unknown → sections 빈 배열로 전송', async () => {
    await patchDashboardConfig({
      sections: [
        { id: 'orphan_a', visible: true },
        { id: 'orphan_b', visible: false },
      ],
    })
    expect(mockedPatch).toHaveBeenCalledWith('/users/me/dashboard-config', {
      sections: [],
    })
  })

  it('4. 알려진 ID 순서 보존 (reorder)', async () => {
    await patchDashboardConfig({
      sections: [
        { id: 'cover_letter_quick', visible: true },
        { id: 'stats', visible: true },
        { id: 'goals', visible: true },
      ],
    })
    const calledWith = mockedPatch.mock.calls[0][1] as {
      sections: { id: string }[]
    }
    expect(calledWith.sections.map((s) => s.id)).toEqual([
      'cover_letter_quick',
      'stats',
      'goals',
    ])
  })

  it('5. KNOWN 리스트가 기대 ID 집합과 일치 (백엔드 VALID_SECTION_IDS 동기화)', () => {
    expect(new Set(KNOWN_DASHBOARD_SECTION_IDS)).toEqual(
      new Set([
        'stats',
        'dday',
        'todos',
        'today_schedule',
        'top_applications',
        'goals',
        'calendar_mini',
        'cover_letter_quick',
      ]),
    )
  })
})
