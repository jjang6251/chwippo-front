/**
 * F6 PR 2 Phase 5.4 — AlertThresholds 페이지 테스트.
 *
 * 시나리오:
 * 1. 정상 로드 → 임계치 input 값 채워짐
 * 2. 빈 history → "최근 24h 알람 없음"
 * 3. 테스트 알람 버튼 클릭 → mutation 호출 + 토스트
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Monitoring } from './Monitoring'
import { alertThresholdsApi } from '@/api/alertThresholds'

vi.mock('@/api/alertThresholds', () => ({
  alertThresholdsApi: {
    get: vi.fn(),
    update: vi.fn(),
    test: vi.fn(),
  },
}))

vi.mock('@/api/systemStatus', () => ({
  systemStatusApi: {
    get: vi.fn().mockResolvedValue({
      backend: 'up',
      db: 'ok',
      openai: 'configured',
      anthropic: 'configured',
    }),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn() },
}))

const getMock = vi.mocked(alertThresholdsApi.get)
const testMock = vi.mocked(alertThresholdsApi.test)
const updateMock = vi.mocked(alertThresholdsApi.update)

function makeThresholds(overrides: Partial<import('@/api/alertThresholds').AlertThresholds> = {}) {
  return {
    id: 1 as const,
    dailyCostThresholdUsd: 50,
    hourlyErrorRateThreshold: 0.1,
    vsYesterdayIncreaseThreshold: 200,
    enabled: true,
    adminGrantPerHourAlert: 10000,
    adminGrantSingleAlert: 10000,
    inquirySlaHours: 24,
    abuserSuspectDailyCalls: 100,
    freeUserSignupSpikePct: 200,
    costOutlierStddev: 2.0,
        perUserDailyCostUsd: 0.5,
        perFeatureDailyCostUsd: 5.0,
        outputTruncationCount1h: 3,
        chargedFailureCount1h: 1,
    updatedBy: null,
    updatedAt: '2026-05-28T00:00:00Z',
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

async function waitForRow() {
  await waitFor(() => expect(screen.queryByText('로딩 중...')).toBeNull(), {
    timeout: 1000,
  })
}

describe('Monitoring page', () => {
  beforeEach(() => {
    getMock.mockReset()
    testMock.mockReset()
  })

  it('정상 로드 → 임계치 input 표시', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        perUserDailyCostUsd: 0.5,
        perFeatureDailyCostUsd: 5.0,
        outputTruncationCount1h: 3,
        chargedFailureCount1h: 1,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    expect(screen.getByText('임계치 설정')).toBeInTheDocument()
  })

  it('빈 history → "최근 24h 알람 없음"', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        perUserDailyCostUsd: 0.5,
        perFeatureDailyCostUsd: 5.0,
        outputTruncationCount1h: 3,
        chargedFailureCount1h: 1,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    expect(screen.getByText('최근 24h 알람 없음')).toBeInTheDocument()
  })

  // PR_B2 Phase 2b — 신규 6 임계치 form 동작 매트릭스 (CTO 시각 검증 spec)
  describe('PR_B2 Phase 2b — 신규 6 임계치 변경', () => {
    beforeEach(() => {
      getMock.mockResolvedValue({
        thresholds: makeThresholds(),
        history: [],
      })
      updateMock.mockResolvedValue(makeThresholds())
    })

    it('초기 로드 시 신규 6 input 의 default 값 채워짐 (admin grant 2 + 신규 4)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      // admin grant 2
      expect(screen.getByLabelText('admin 시간당 grant 합계 (코인)')).toHaveValue(
        10000,
      )
      expect(screen.getByLabelText('admin 1회 grant 임계치 (코인)')).toHaveValue(
        10000,
      )
      // Phase 2 신규 4
      expect(screen.getByLabelText('문의 SLA 시간')).toHaveValue(24)
      expect(screen.getByLabelText('abuser 의심 일 호출')).toHaveValue(100)
      expect(screen.getByLabelText('Free 가입 폭증 (%)')).toHaveValue(200)
      expect(screen.getByLabelText('cost outlier σ')).toHaveValue(2)
    })

    it('admin 시간당 grant 변경 → save 시 payload 에 정확 포함', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('admin 시간당 grant 합계 (코인)')
      fireEvent.change(input, { target: { value: '20000' } })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      const payload = updateMock.mock.calls[0][0]
      expect(payload.adminGrantPerHourAlert).toBe(20000)
      expect(payload.adminGrantSingleAlert).toBe(10000) // 미변경
    })

    it('문의 SLA input 의 onChange → state 변경 → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('문의 SLA 시간') as HTMLInputElement
      fireEvent.change(input, { target: { value: '4' } })
      await waitFor(() => expect(input.value).toBe('4'))
    })

    it('abuser 일 호출 input 의 onChange → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText(
        'abuser 의심 일 호출',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '50' } })
      await waitFor(() => expect(input.value).toBe('50'))
    })

    it('Free 가입 폭증 % input → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText(
        'Free 가입 폭증 (%)',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '300' } })
      await waitFor(() => expect(input.value).toBe('300'))
    })

    it('cost outlier σ 의 소수 → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('cost outlier σ') as HTMLInputElement
      fireEvent.change(input, { target: { value: '2.5' } })
      await waitFor(() => expect(input.value).toBe('2.5'))
    })

    it('값 미변경 시 저장 버튼 disabled (dirty=false)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const saveBtn = screen.getByText('저장') as HTMLButtonElement
      expect(saveBtn.disabled).toBe(true)
    })

    it('1 임계치만 변경해도 save 시 payload 6 + 기존 3 모두 포함 (PATCH 안전)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      fireEvent.change(screen.getByLabelText('admin 1회 grant 임계치 (코인)'), {
        target: { value: '5000' },
      })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      const payload = updateMock.mock.calls[0][0]
      // Phase 1 + Phase 2 6 임계치 모두 포함
      expect(payload).toHaveProperty('adminGrantPerHourAlert')
      expect(payload).toHaveProperty('adminGrantSingleAlert')
      expect(payload).toHaveProperty('inquirySlaHours')
      expect(payload).toHaveProperty('abuserSuspectDailyCalls')
      expect(payload).toHaveProperty('freeUserSignupSpikePct')
      expect(payload).toHaveProperty('costOutlierStddev')
      // 기존 3
      expect(payload).toHaveProperty('dailyCostThresholdUsd')
      expect(payload).toHaveProperty('hourlyErrorRateThreshold')
      expect(payload).toHaveProperty('vsYesterdayIncreaseThreshold')
      expect(payload).toHaveProperty('enabled')
    })

    it('서버에서 다른 default 값 받아도 input 반영 (server-driven)', async () => {
      getMock.mockResolvedValue({
        thresholds: makeThresholds({
          adminGrantPerHourAlert: 5000,
          inquirySlaHours: 12,
          costOutlierStddev: 3.5,
        }),
        history: [],
      })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      // flaky fix — 로딩 종료 ≠ input 상태 반영. 값이 실제로 주입될 때까지 대기
      await waitFor(() =>
        expect(
          screen.getByLabelText('admin 시간당 grant 합계 (코인)'),
        ).toHaveValue(5000),
      )
      expect(screen.getByLabelText('문의 SLA 시간')).toHaveValue(12)
      expect(screen.getByLabelText('cost outlier σ')).toHaveValue(3.5)
    })
  })

  it('테스트 알람 버튼 → mutation 호출', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        perUserDailyCostUsd: 0.5,
        perFeatureDailyCostUsd: 5.0,
        outputTruncationCount1h: 3,
        chargedFailureCount1h: 1,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    testMock.mockResolvedValue({ status: 'sent' })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    fireEvent.click(screen.getByText('🧪 테스트 알람 보내기'))
    await waitFor(() => expect(testMock).toHaveBeenCalled())
  })

  /**
   * 🔴 **라벨을 눌러도 아무 일이 없었다.**
   *
   * `ThresholdField` 가 라벨을 `<p>` 로 그려서, 13개 임계값 전부 조작 가능한 영역이
   * **128px 입력창뿐**이었다 (Vercel WIG "Labels clickable" 위반). `aria-label` 이 있어
   * 스크린리더는 읽었기 때문에 **접근성 검사로는 통과하는** 형태였다.
   *
   * 이 spec 이 없으면 `htmlFor` 는 다음 리팩터에서 조용히 사라진다 — 사라져도
   * 화면은 똑같이 보이고 기존 테스트도 전부 통과하기 때문이다.
   */
  describe('라벨 ↔ 입력창 연결', () => {
    it('라벨을 클릭하면 해당 입력창에 포커스가 간다', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds(), history: [] })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      // fireEvent 는 raw 이벤트만 쏴서 **label 활성화 기본 동작이 안 일어난다** —
      // htmlFor 를 지워도 통과해버리므로 여기선 userEvent 여야 한다
      await userEvent.click(screen.getByText('출력 잘림 (1h)'))

      expect(screen.getByLabelText('출력 잘림 (1h)')).toHaveFocus()
    })

    /**
     * 🔴 **kill switch 만 일부러 연결하지 않았다.**
     *
     * 이 행은 `<button>` 을 감싸는데 `<button>` 도 labelable 이라, `htmlFor` 를 붙이면
     * **라벨 글자를 클릭하는 것만으로 알람 전체가 꺼진다.** "모든 라벨을 클릭 가능하게" 라는
     * 일괄 리팩터가 정확히 이걸 깨뜨리므로, 예외를 테스트로 못 박는다.
     */
    it('kill switch 라벨은 클릭해도 토글되지 않는다 (오조작 방지)', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds({ enabled: true }), history: [] })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      await userEvent.click(screen.getByText('알람 전체 활성'))

      expect(screen.getByText('✓ 활성')).toBeInTheDocument()
    })
  })


  /**
   * 🔴 **화살표는 되는데 직접 타이핑이 안 되던 문제** (2026-08-03 CEO 발견).
   *
   * `onChange={(e) => setX(Number(e.target.value))}` 는 얼핏 맞아 보이지만,
   * `<input type="number">` 의 `.value` 는 **유효한 숫자 문자열이 아니면 `""` 를 돌려준다**
   * (HTML 값 정제 알고리즘). `Number("") === 0` 이라 **입력이 미완성인 모든 순간이 0 으로
   * 확정**됐다 — 지우면 즉시 `0`, 소수점을 찍는 순간에도 `0`.
   *
   * 화살표(스텝퍼)는 항상 완성된 숫자만 만들어 이 경로를 안 타므로 **정상으로 보였다.**
   * 그래서 "일부 입력 방식에서만" 깨지는 형태였고 기존 테스트 12개가 전부 통과했다.
   */
  describe('숫자 직접 입력', () => {
    it('전체를 지우면 빈칸이 유지된다 (0 으로 튀지 않는다)', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds(), history: [] })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const el = screen.getByLabelText('출력 잘림 (1h)') as HTMLInputElement
      await userEvent.clear(el)

      expect(el.value).toBe('')
    })

    /**
     * 빈칸인 채로 저장하면 임계값이 **0 으로 저장**된다 — 알람이 매 tick 울리거나
     * (@Min(1) 인 필드는) 400 으로 튕긴다. 포커스를 떠날 때 마지막 유효값으로 되돌린다.
     */
    it('빈칸인 채 포커스를 떠나면 직전 값으로 복구된다', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds(), history: [] })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const el = screen.getByLabelText('출력 잘림 (1h)') as HTMLInputElement
      await userEvent.clear(el)
      fireEvent.blur(el)

      expect(el.value).toBe('3')
    })

    it('지우고 새 숫자를 치면 그대로 들어간다', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds(), history: [] })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const el = screen.getByLabelText('출력 잘림 (1h)') as HTMLInputElement
      await userEvent.clear(el)
      await userEvent.type(el, '12')

      expect(el.value).toBe('12')
    })

    /** 빈칸은 부모 state 로 올라가면 안 된다 — 저장 payload 가 0 으로 오염된다 */
    it('빈칸 상태에서 저장해도 payload 는 0 이 아니다', async () => {
      getMock.mockResolvedValue({ thresholds: makeThresholds(), history: [] })
      updateMock.mockResolvedValue(makeThresholds())
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const el = screen.getByLabelText('출력 잘림 (1h)') as HTMLInputElement
      await userEvent.clear(el)
      await userEvent.type(el, '9')
      await userEvent.clear(el)
      fireEvent.blur(el)
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      expect(updateMock.mock.calls[0][0].outputTruncationCount1h).not.toBe(0)
    })

    /**
     * 서버가 다른 값을 내려주면 draft 도 따라와야 한다 (draft 가 고립되면 안 됨).
     *
     * ⚠️ `waitForRow()` 만으로는 부족하다 — 로딩 문구가 사라지는 시점과 부모 state 동기화가
     * 끝나는 시점이 **다르다.** 입력창은 하드코딩 default(3) 를 잠깐 비추고 서버값으로 바뀐다.
     * 처음엔 즉시 단언해서 3회 중 1회만 통과하는 flaky 테스트가 됐다.
     */
    it('서버 값이 바뀌면 입력창에 반영된다', async () => {
      getMock.mockResolvedValue({
        thresholds: makeThresholds({ outputTruncationCount1h: 7 }),
        history: [],
      })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      await waitFor(() =>
        expect(
          (screen.getByLabelText('출력 잘림 (1h)') as HTMLInputElement).value,
        ).toBe('7'),
      )
    })
  })

})
