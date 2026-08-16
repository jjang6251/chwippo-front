import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Application, InterviewNudge } from '@/types/application'

const h = vi.hoisted(() => ({
  isDemo: false,
  markShown: vi.fn(),
  dismiss: vi.fn(),
  dismissedLocally: false,
}))

vi.mock('@/contexts/demoMode', () => ({ useDemoMode: () => h.isDemo }))
vi.mock('@/hooks/useInterviewNudge', () => ({
  useMarkInterviewNudgeShown: () => ({ mutate: h.markShown }),
  useDismissInterviewNudge: () => ({ mutate: h.dismiss }),
  isInterviewNudgeDismissedLocally: () => h.dismissedLocally,
}))

import { useInterviewNudgeFlow } from './useInterviewNudgeFlow'

/**
 * 판정 **분업** 검증.
 *
 * | 조건 | 누가 |
 * |---|---|
 * | 이 스텝이 면접인가 (+ 결과 계열 제외) | **프론트** |
 * | 안 띄웠나 · 영구차단 · 이 스텝 세션 | **서버** (`interviewNudge.show`) |
 *
 * 🔴 **둘 다 참일 때만 뜬다.** 한쪽만 보면 ① 서버가 면접 여부를 알아야 하거나(정규식 복제 →
 * 드리프트) ② 결과 발표 단계에서 뜬다.
 */
describe('useInterviewNudgeFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.isDemo = false
    h.dismissedLocally = false
    sessionStorage.clear()
  })

  function appWith(
    stepName: string,
    nudge?: InterviewNudge,
  ): Application & { interviewNudge?: InterviewNudge } {
    return {
      id: 'app-1',
      companyName: '카카오',
      steps: [{ id: 'st-1', name: stepName, scheduledDate: null }],
      interviewNudge: nudge,
    } as unknown as Application & { interviewNudge?: InterviewNudge }
  }

  const SHOW: InterviewNudge = { show: true, variant: 'first' }

  it('D-0 프론트·서버 둘 다 통과 → 뜬다', () => {
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
    expect(result.current.pending).toMatchObject({
      stepId: 'st-1',
      stepName: '2차 면접',
      companyName: '카카오',
      variant: 'first',
    })
  })

  it('🔴 D-1 서버가 show:true 여도 면접 스텝이 아니면 안 뜬다', () => {
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() => result.current.consider(appWith('서류 제출', SHOW), 0))
    expect(result.current.pending).toBeNull()
  })

  it('🔴 D-1b 「면접 결과 발표」 도 안 뜬다 (서버는 모른다)', () => {
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() => result.current.consider(appWith('면접 결과 발표', SHOW), 0))
    expect(result.current.pending).toBeNull()
  })

  it('🔴 D-2 면접 스텝이어도 서버가 show:false 면 안 뜬다', () => {
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() =>
      result.current.consider(
        appWith('2차 면접', { show: false, variant: 'first' }),
        0,
      ),
    )
    expect(result.current.pending).toBeNull()
  })

  it('서버 응답에 interviewNudge 가 아예 없으면(구버전) 안 뜬다', () => {
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() => result.current.consider(appWith('2차 면접'), 0))
    expect(result.current.pending).toBeNull()
  })

  /**
   * 🔴 **B-2 로컬 보조 방어선.** 「다시 보지 않기」 서버 저장이 실패했을 때를 덮는다.
   * 이게 없으면 사용자가 명시적으로 누른 약속이 네트워크 사정으로 깨진다.
   */
  it('🔴 B-2 로컬에 dismiss 기록이 있으면 서버가 show:true 여도 안 뜬다', () => {
    h.dismissedLocally = true
    const { result } = renderHook(() => useInterviewNudgeFlow())
    act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
    expect(result.current.pending).toBeNull()
  })

  describe('닫기 — 체크 여부가 결과를 가른다', () => {
    it('H-1 체크 없이 닫으면 shownAt 만 기록', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => result.current.close(false))
      expect(h.markShown).toHaveBeenCalledWith({ appId: 'app-1', stepId: 'st-1' })
      expect(h.dismiss).not.toHaveBeenCalled()
      expect(result.current.pending).toBeNull()
    })

    it('H-2 체크하고 닫으면 shownAt + 영구 차단 둘 다', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => result.current.close(true))
      expect(h.markShown).toHaveBeenCalled()
      expect(h.dismiss).toHaveBeenCalled()
    })
  })

  describe('🔴 go — CTA 는 기록을 남기고 생성 모달로 넘긴다', () => {
    it('닫기 기록은 close 와 똑같이 남는다 (그 스텝 소진)', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => {
        result.current.go(false)
      })
      expect(h.markShown).toHaveBeenCalledWith({ appId: 'app-1', stepId: 'st-1' })
      expect(h.dismiss).not.toHaveBeenCalled()
    })

    it('☑ 상태로 CTA → 영구 차단도 같이 간다', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => {
        result.current.go(true)
      })
      expect(h.dismiss).toHaveBeenCalled()
    })

    /**
     * 🔴 **이게 「그냥 탭으로만 보내던」 문제의 회귀 방어다.**
     * `creating` 에 `stepId` 가 실려야 생성 모달의 면접 차수가 미리 채워진다 —
     * 안 실으면 사용자가 방금 이동한 단계를 드롭다운에서 **또** 고르게 된다.
     */
    it('🔴 creating 에 방금 이동한 스텝이 실린다 (면접 차수 미리 채움)', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => {
        result.current.go(false)
      })
      expect(result.current.creating).toEqual({ appId: 'app-1', stepId: 'st-1' })
      expect(result.current.pending).toBeNull() // 넛지는 닫혔다
    })

    it('cancelCreating → 생성 모달이 닫힌다', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      act(() => {
        result.current.go(false)
      })
      act(() => result.current.cancelCreating())
      expect(result.current.creating).toBeNull()
    })
  })

  /**
   * 🔴 **데모에선 아예 안 뜬다** (CEO 2026-08-17).
   *
   * 예전 테스트는 「서버를 안 부른다」·「생성 모달을 안 연다」를 봤는데, 지금은 모달 자체가
   * 안 뜨므로 **그 단언들은 공허하게 통과한다** (뜨지도 않은 걸 닫으면 당연히 아무 일도 없다).
   * 그래서 단언 지점을 `pending` 으로 옮긴다 — 여기가 실제 계약이다.
   */
  describe('데모 — 안내를 띄우지 않는다', () => {
    beforeEach(() => {
      h.isDemo = true
    })

    it('🔴 서버가 show 를 줘도 뜨지 않는다', () => {
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      expect(result.current.pending).toBeNull()
    })

    it('🔴 「데모 응답에 필드가 없어서」가 아니라 **명시적으로** 막는다', () => {
      // 데모 어댑터가 나중에 interviewNudge 를 채워도 뚫리면 안 된다 —
      // 이 케이스는 필드가 완전히 채워진 응답을 그대로 넣어 본다
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() =>
        result.current.consider(
          { ...appWith('2차 면접', SHOW), interviewNudge: { show: true, variant: 'first' } },
          0,
        ),
      )
      expect(result.current.pending).toBeNull()
      expect(h.markShown).not.toHaveBeenCalled()
    })

    it('데모가 아니면 같은 입력에 정상적으로 뜬다 (가드가 데모에만 걸린다)', () => {
      h.isDemo = false
      const { result } = renderHook(() => useInterviewNudgeFlow())
      act(() => result.current.consider(appWith('2차 면접', SHOW), 0))
      expect(result.current.pending).not.toBeNull()
    })
  })
})
