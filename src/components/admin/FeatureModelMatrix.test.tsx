import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureModelMatrix } from './FeatureModelMatrix'
import type { FeatureModelRow } from '@/api/featureModelAdmin'

const listAll = vi.fn()
const update = vi.fn()

vi.mock('@/api/featureModelAdmin', () => ({
  featureModelAdminApi: {
    listAll: () => listAll(),
    update: (f: string, m: string) => update(f, m),
  },
}))

const HAIKU = 'claude-haiku-4-5-20251001'

const row = (over: Partial<FeatureModelRow> = {}): FeatureModelRow => ({
  feature: 'coverletter_feedback',
  provider: 'anthropic',
  model: HAIKU,
  label: 'Claude Haiku 4.5',
  costMultiplier: 1,
  inputUsd: 1,
  outputUsd: 5,
  maxOutputTokens: 6000,
  requiresStreaming: false,
  updatedBy: null,
  updatedAt: null,
  selectable: [
    {
      id: HAIKU,
      label: 'Claude Haiku 4.5',
      provider: 'anthropic',
      costMultiplier: 1,
      inputUsd: 1,
      outputUsd: 5,
      blockedReason: null,
    },
    {
      id: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      provider: 'anthropic',
      costMultiplier: 3,
      inputUsd: 3,
      outputUsd: 15,
      blockedReason: null,
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      provider: 'openai',
      costMultiplier: 0.15,
      inputUsd: 0.15,
      outputUsd: 0.6,
      blockedReason: '이 기능은 실시간 응답(스트리밍)이 필요한데 이 모델은 지원하지 않습니다',
    },
  ],
  ...over,
})

const renderMatrix = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FeatureModelMatrix />
    </QueryClientProvider>,
  )

describe('FeatureModelMatrix', () => {
  beforeEach(() => {
    listAll.mockReset()
    update.mockReset()
    listAll.mockResolvedValue([row()])
    update.mockResolvedValue(row())
  })

  describe('표시', () => {
    it('현재 모델과 실단가를 보여준다 (추정이 아니라 청구서와 대조되는 값)', async () => {
      renderMatrix()
      expect(await screen.findByText('$1.00')).toBeInTheDocument()
      expect(screen.getByText('/1M')).toBeInTheDocument()
      expect(screen.getByText('6,000')).toBeInTheDocument()
    })

    /** 드롭다운은 모델명만 — 배수는 원가 열에 이미 있어 중복이었다 */
    it('드롭다운 옵션에 배수를 넣지 않는다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')
      const opt = screen
        .getAllByRole('option')
        .find((o) => o.textContent?.includes('Claude Sonnet 4.6'))!
      expect(opt.textContent).not.toMatch(/배/)
    })

    /**
     * 🔴 못 고르는 모델을 **목록에서 숨기지 않는다.** 숨기면 관리자가
     * "이 모델은 왜 안 보이지" 로 헤맨다 — 사유를 보여주는 게 목적이다.
     */
    it('선택 불가 모델도 목록에 남기고 disabled + 사유를 준다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')

      const blocked = screen
        .getAllByRole('option')
        .find((o) => o.textContent?.includes('GPT-4o mini'))!
      expect(blocked).toBeDisabled()
      expect(blocked.getAttribute('title')).toContain('실시간 응답')
      expect(blocked.textContent).toContain('선택 불가')
    })

    it('스트리밍 필수 feature 는 제약을 표시한다', async () => {
      listAll.mockResolvedValue([row({ requiresStreaming: true })])
      renderMatrix()
      expect(await screen.findByText('실시간 응답 필요')).toBeInTheDocument()
    })

    /**
     * 🔴 행마다 select 가 하나씩이라 이름이 없으면 스크린리더에서 전부 "콤보 상자" 로만
     * 읽힌다 — 어느 기능의 것인지 구분이 안 된다. 테이블 헤더로는 안 붙는다.
     */
    it('select 에 어느 기능인지 알 수 있는 이름이 붙는다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')
      expect(
        screen.getByRole('combobox', { name: /모델 선택/ }),
      ).toBeInTheDocument()
    })

    it('설정이 하나도 없으면 빈 테이블 대신 안내를 보여준다', async () => {
      listAll.mockResolvedValue([])
      renderMatrix()
      expect(
        await screen.findByText(/마이그레이션.*확인해주세요/),
      ).toBeInTheDocument()
      // 헤더만 남은 빈 표를 그리지 않는다
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('레지스트리 밖 모델이 DB 에 남아 있으면 (미등록) 으로 노출', async () => {
      listAll.mockResolvedValue([row({ model: 'gpt-9-ultra' })])
      renderMatrix()
      expect(await screen.findByText(/gpt-9-ultra \(미등록\)/)).toBeInTheDocument()
    })
  })

  describe('변경 흐름', () => {
    it('모델을 고르면 바로 저장하지 않고 확인 모달을 띄운다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'claude-sonnet-4-6' },
      })

      expect(await screen.findByText(/모델 변경/)).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    /** 🔴 원가가 오르는 건 확인 전에 반드시 보여야 한다 — 마진이 조용히 깎이는 걸 막는 장치 */
    it('요금이 오르면 배수·실단가·코인 영향을 명시한다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'claude-sonnet-4-6' },
      })

      const modal = await screen.findByText(/AI 요금이 약 3.0배로 오릅니다/)
      expect(modal).toBeInTheDocument()
      expect(screen.getByText(/\$1.00 → \$3.00/)).toBeInTheDocument()
      expect(screen.getByText(/코인 차감도 같은 비율로 늘어납니다/)).toBeInTheDocument()
    })

    it('요금이 내려가면 인상 경고 대신 인하로 표기', async () => {
      listAll.mockResolvedValue([
        row({ model: 'claude-sonnet-4-6', costMultiplier: 3, inputUsd: 3 }),
      ])
      renderMatrix()
      await screen.findByText('$3.00')

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: HAIKU },
      })

      expect(await screen.findByText(/낮아집니다/)).toBeInTheDocument()
      expect(screen.queryByText(/오릅니다/)).not.toBeInTheDocument()
    })

    it('확인해야 저장된다', async () => {
      renderMatrix()
      await screen.findByText('$1.00')
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'claude-sonnet-4-6' },
      })
      await screen.findByText(/모델 변경/)

      fireEvent.click(screen.getByRole('button', { name: /적용|확인/ }))

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'coverletter_feedback',
          'claude-sonnet-4-6',
        ),
      )
    })
  })

  describe('상태', () => {
    it('로딩 중엔 스켈레톤 (스피너 금지)', () => {
      listAll.mockReturnValue(new Promise(() => {}))
      const { container } = renderMatrix()
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    it('조회 실패 시 안내를 보여준다', async () => {
      listAll.mockRejectedValue(new Error('boom'))
      renderMatrix()
      expect(
        await screen.findByText(/불러오지 못했어요/),
      ).toBeInTheDocument()
    })
  })
})
