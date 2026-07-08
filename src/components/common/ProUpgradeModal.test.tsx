/**
 * ProUpgradeModal — AI 사용 한도 섹션 테스트.
 *
 * 시나리오:
 * 1. 공개 feature 3개(자소서 채팅·심층 점검·노트 요약) 행 렌더
 * 2. 소진 상태 → 사용량 text-danger, 임박(80%+) → text-warning
 * 3. quota 미로드(로딩·실패) → 섹션 자체 숨김 (silent)
 * 4. 응답에 feature 없으면 그 행 숨김 (방어)
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProUpgradeModal } from './ProUpgradeModal'
import { useMyAiQuotas } from '@/hooks/useMyAiQuotas'
import type { MyAiQuotaRow } from '@/types/aiQuota'

vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiQuotas: vi.fn(),
  useMyAiQuota: vi.fn(),
}))

const mockedQuotas = vi.mocked(useMyAiQuotas)

/** 컴포넌트는 `.data` 만 읽음 — 최소 shape 를 hook 반환 타입으로 좁혀 override 없이 mock */
function mockData(data: MyAiQuotaRow[] | undefined) {
  mockedQuotas.mockReturnValue({ data } as ReturnType<typeof useMyAiQuotas>)
}

const baseProps = {
  balance: 50,
  tier: 'free' as const,
  monthlyCoinLimit: 100,
  nextResetAt: '2026-08-01T00:00:00.000Z',
  onClose: () => {},
}

function row(feature: MyAiQuotaRow['feature'], over: Partial<MyAiQuotaRow> = {}): MyAiQuotaRow {
  return {
    feature,
    enabled: true,
    dayUsed: 0,
    dayLimit: 10,
    monthUsed: 0,
    monthLimit: 100,
    cooldownSeconds: 10,
    nextAvailableAt: null,
    ...over,
  }
}

describe('ProUpgradeModal — AI 사용 한도', () => {
  beforeEach(() => mockedQuotas.mockReset())

  it('공개 feature 3개 행 렌더 (라벨·순서)', () => {
    mockData([row('coverletter_chat'), row('coverletter_feedback'), row('note_summary')])
    render(<ProUpgradeModal {...baseProps} />)

    expect(screen.getByText('AI 사용 한도')).toBeInTheDocument()
    expect(screen.getByText('자소서 AI 채팅')).toBeInTheDocument()
    expect(screen.getByText('AI 심층 점검')).toBeInTheDocument()
    expect(screen.getByText('활동 노트 AI 요약')).toBeInTheDocument()
  })

  it('소진 → text-danger, 임박(80%+) → text-warning', () => {
    mockData([
      row('coverletter_chat', { dayUsed: 10, dayLimit: 10 }), // 소진
      row('coverletter_feedback', { dayUsed: 8, dayLimit: 10 }), // 80% 임박
    ])
    render(<ProUpgradeModal {...baseProps} />)

    const exhausted = screen.getByText('10 / 10회')
    expect(exhausted).toHaveClass('text-danger')

    const imminent = screen.getByText('8 / 10회')
    expect(imminent).toHaveClass('text-warning')
  })

  it('quota 미로드 시 섹션 숨김 (silent)', () => {
    mockData(undefined)
    render(<ProUpgradeModal {...baseProps} />)

    expect(screen.queryByText('AI 사용 한도')).not.toBeInTheDocument()
  })

  it('응답에 없는 feature 행은 숨김 (방어)', () => {
    mockData([row('coverletter_chat')])
    render(<ProUpgradeModal {...baseProps} />)

    expect(screen.getByText('자소서 AI 채팅')).toBeInTheDocument()
    expect(screen.queryByText('AI 심층 점검')).not.toBeInTheDocument()
    expect(screen.queryByText('활동 노트 AI 요약')).not.toBeInTheDocument()
  })
})
