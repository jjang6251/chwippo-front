/**
 * 활동 총괄 회고 모달 spec (베타 피드백).
 *
 * 5축 — 정상 / 빈 string → null / boundary (5000자) / 초기 render / save mutation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivitySummaryModal } from './ActivitySummaryModal'
import { activityApi } from '@/api/activity'
import type { Activity } from '@/types/activity'

vi.mock('@/api/activity', () => ({
  activityApi: {
    update: vi.fn(),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const updateMock = vi.mocked(activityApi.update)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    userId: 'user-1',
    name: '카카오 인턴',
    type: 'intern',
    org: null,
    role: null,
    resultUrl: null,
    outcome: null,
    startedAt: null,
    endedAt: null,
    archivedAt: null,
    legacyExperienceId: null,
    summaryReflection: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const onClose = vi.fn()

describe('ActivitySummaryModal', () => {
  beforeEach(() => {
    updateMock.mockReset()
    onClose.mockReset()
  })

  describe('초기 render', () => {
    it('open=false → 미렌더', () => {
      render(
        <ActivitySummaryModal
          open={false}
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.queryByText(/활동 총괄 회고/)).not.toBeInTheDocument()
    })

    it('activity 의 기존 summary 가 textarea 에 채워짐', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity({
            summaryReflection: '6개월 인턴 wrap up',
          })}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      expect(textarea.value).toBe('6개월 인턴 wrap up')
    })

    it('summary null → textarea 빈 값', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity({ summaryReflection: null })}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      expect(textarea.value).toBe('')
    })

    it('header 에 activity name + "수정" 라벨 (기존 summary 있을 때)', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity({
            summaryReflection: '기존',
            name: '동아리',
          })}
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.getByText(/동아리/)).toBeInTheDocument()
      expect(screen.getByText(/\(수정\)/)).toBeInTheDocument()
    })
  })

  describe('글자수 카운터', () => {
    it('0자 → quaternary 색', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.getByText(/0 \/ 5000/)).toBeInTheDocument()
    })

    it('500자 입력 → success 색', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity({ summaryReflection: 'A'.repeat(500) })}
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.getByText(/500 \/ 5000/)).toBeInTheDocument()
    })

    it('textarea maxLength=5000 (HTML 강제)', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      expect(textarea.maxLength).toBe(5000)
    })
  })

  describe('save mutation payload', () => {
    it('non-empty save → trimmed string payload', async () => {
      updateMock.mockResolvedValue(
        makeActivity({ summaryReflection: '새 wrap up' }),
      )
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '  새 wrap up  ' } })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      expect(updateMock).toHaveBeenCalledWith('act-1', {
        summaryReflection: '새 wrap up',
      })
    })

    it('빈 string 저장 → null payload (clear)', async () => {
      updateMock.mockResolvedValue(
        makeActivity({ summaryReflection: null }),
      )
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity({ summaryReflection: '기존' })}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '   ' } })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      expect(updateMock).toHaveBeenCalledWith('act-1', {
        summaryReflection: null,
      })
    })

    it('save 성공 → onClose 호출', async () => {
      updateMock.mockResolvedValue(makeActivity())
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'X' } })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('취소 → onClose 호출, mutation 미실행', () => {
      render(
        <ActivitySummaryModal
          open
          activity={makeActivity()}
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('취소'))
      expect(onClose).toHaveBeenCalled()
      expect(updateMock).not.toHaveBeenCalled()
    })
  })
})
