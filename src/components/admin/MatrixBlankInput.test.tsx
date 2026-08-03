/**
 * 🔴 **비제어 숫자 입력에서 "빈칸으로 두고 나가면 0 이 저장되던" 문제** (2026-08-03).
 *
 * 두 매트릭스는 `defaultValue` + `onBlur` 인 **비제어** 입력이라 타이핑은 멀쩡했다.
 * 그런데 blur 핸들러가 `Number(e.target.value)` 를 그대로 썼고, `Number('') === 0` 이라
 * **값을 지우고 다른 곳을 클릭하면 0 이 저장 대상**이 됐다:
 *
 * - `TierConfigMatrix` — 티어 한도가 0 (해당 티어 사용자 전원이 즉시 한도 소진 상태)
 * - `FeatureCoinMetaMatrix` — 평균 코인이 0 (코인 예측·잔액 표시가 통째로 어긋남)
 *
 * 게다가 비제어라 화면엔 **빈칸만 남아** 뭐가 저장됐는지도 안 보인다.
 *
 * **결정: 빈칸 = 변경 없음** (CEO 2026-08-03). 직전 값으로 되돌리고 확인 모달을 띄우지 않는다.
 * 단 `FeatureCoinMetaMatrix.fixedCoinCost` 는 **빈칸 = `null`(미설정)이 의도된 의미**라
 * 이 규칙에서 제외한다 — 같은 "빈칸" 이 필드마다 다른 뜻을 갖는다는 게 이 화면의 핵심이다.
 *
 * 관찰 방법 — 변경이 성립하면 반드시 확인 모달이 뜬다. 그래서
 * **"입력값이 복구됐고 모달이 안 떴다"** 로 "변경 없음" 을 판정한다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TierConfigMatrix } from './TierConfigMatrix'
import { FeatureCoinMetaMatrix } from './FeatureCoinMetaMatrix'
import { tierConfigAdminApi } from '@/api/tierConfigAdmin'
import { featureCoinMetaAdminApi } from '@/api/featureCoinMetaAdmin'

vi.mock('@/api/tierConfigAdmin', () => ({
  tierConfigAdminApi: {
    listAll: vi.fn(),
    getPreview: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('@/api/featureCoinMetaAdmin', () => ({
  featureCoinMetaAdminApi: { listAll: vi.fn(), update: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({ toast: { show: vi.fn() } }))

const tierList = vi.mocked(tierConfigAdminApi.listAll)
const tierPreview = vi.mocked(tierConfigAdminApi.getPreview)
const metaList = vi.mocked(featureCoinMetaAdminApi.listAll)
const metaUpdate = vi.mocked(featureCoinMetaAdminApi.update)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('매트릭스 숫자 입력 — 빈칸 = 변경 없음', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tierPreview.mockResolvedValue({ affectedUsers: 0, sample: [] })
    tierList.mockResolvedValue([
      {
        tier: 'free',
        monthlyCoinLimit: '100',
        inputTokenCapPerCall: 8000,
        defaultCooldownSeconds: 30,
        companyResearchDailyCap: 3,
        noteSummaryCooldownMinutes: 5,
        priceKrw: null,
        active: true,
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ])
    metaList.mockResolvedValue([
      {
        feature: 'coverletter_chat',
        chargesCoins: true,
        avgCoinCost: '11.40',
        fixedCoinCost: null,
        description: null,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ])
  })

  describe('TierConfigMatrix', () => {
    it('빈칸으로 두고 나가면 직전 값이 복구되고 확인 모달이 안 뜬다', async () => {
      render(<TierConfigMatrix />, { wrapper })
      const el = (await screen.findByLabelText(
        /free 월 한도/i,
      )) as HTMLInputElement
      const before = el.value

      await userEvent.clear(el)
      fireEvent.blur(el)

      expect(el.value).toBe(before)
      // 변경이 성립했다면 preview 를 불러 모달을 띄운다 — 안 불렸어야 한다
      expect(tierPreview).not.toHaveBeenCalled()
    })

    it('실제로 값을 바꾸면 확인 흐름이 진행된다 (가드가 과잉 발동하지 않는다)', async () => {
      render(<TierConfigMatrix />, { wrapper })
      const el = (await screen.findByLabelText(
        /free 월 한도/i,
      )) as HTMLInputElement

      await userEvent.clear(el)
      await userEvent.type(el, '500')
      fireEvent.blur(el)

      await waitFor(() => expect(tierPreview).toHaveBeenCalled())
    })
  })

  describe('FeatureCoinMetaMatrix', () => {
    it('평균 코인을 빈칸으로 두고 나가면 직전 값이 복구된다', async () => {
      render(<FeatureCoinMetaMatrix />, { wrapper })
      const el = (await screen.findByLabelText(
        /coverletter_chat 평균 코인/,
      )) as HTMLInputElement

      await userEvent.clear(el)
      fireEvent.blur(el)

      expect(Number(el.value)).toBe(11.4)
    })

    /**
     * 🔴 여기만 규칙이 다르다 — `fixedCoinCost` 는 **빈칸이 `null`(미설정)** 을 뜻한다.
     * "모든 빈칸을 복구하자" 는 일괄 수정이 정확히 이걸 깨뜨린다.
     */
    it('고정 코인의 빈칸은 null 로 저장된다 (0 이 아니다)', async () => {
      metaUpdate.mockResolvedValue({} as never)
      metaList.mockResolvedValue([
        {
          feature: 'coverletter_chat',
          chargesCoins: true,
          avgCoinCost: '11.40',
          fixedCoinCost: 5, // 값이 있어야 "지워서 null 로" 가 성립한다
          description: null,
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-08-01T00:00:00Z',
        },
      ])
      render(<FeatureCoinMetaMatrix />, { wrapper })
      const el = (await screen.findByLabelText(
        /coverletter_chat 고정 코인/,
      )) as HTMLInputElement

      await userEvent.clear(el)
      fireEvent.blur(el)
      fireEvent.click(await screen.findByText('확인'))

      // 🔴 DOM 값만 보면 이 케이스를 못 잡는다 — 비제어라 어느 쪽이든 화면엔 빈칸이 남는다.
      //    **무엇이 저장되는가**를 봐야 null 과 0 이 갈린다 (뮤테이션 테스트에서 확인).
      await waitFor(() => expect(metaUpdate).toHaveBeenCalled())
      expect(metaUpdate.mock.calls[0][1]).toEqual({ fixedCoinCost: null })
    })
  })
})
