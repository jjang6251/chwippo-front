import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  noteAiActionApi,
  type NoteAiActionBody,
  type NoteAiResource,
} from '@/api/noteAiAction'
import { serverMessage } from '@/hooks/useStepDetail'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import { useSpaLeaveConfirm } from '@/hooks/useSpaLeaveConfirm'
import { toast } from '@/stores/toastStore'

/**
 * 노트 AI 패널의 단발 요청 훅.
 *
 * ## 상태는 셋뿐이다 — running · error · done
 * 패널은 이 셋으로 스켈레톤 / 서버 문구+재시도 / 결과 프리뷰를 그린다.
 * `run()` 은 **던지지 않는다** — 실패도 결과의 한 종류로 돌려줘야 히스토리에 남는다.
 *
 * ## 🔴 게이트가 호출 **앞**에 있다
 * `useRequireAiConsent` 를 통과하지 못하면 요청 자체를 보내지 않는다(`cancelled`).
 * 데모 모드에서는 이 훅이 가입 유도 모달을 띄우고 조용히 멈춘다 — 토스트를 내지 않는다.
 *
 * ## 🔴 성공·실패 무관 잔여를 다시 읽는다
 * 차감은 서버가 판정한다(캐시 hit·blocked 는 무차감). 프론트가 낙관적으로 깎으면
 * 어긋나므로 `onSettled` 에서 한도·코인 잔액을 통째로 무효화한다.
 *
 * ## 🔴 새로고침 = 코인만 날아가는 사고
 * 요청이 떠 있는 동안 이탈 경고를 건다. 페이지에 이미 미저장 가드가 있으면 리스너가
 * 둘이 되는데, 둘 다 `preventDefault()` 만 하므로 결과는 OR 과 같다.
 */

/** 요청 실패 시 기본 문구 — **서버가 문구를 주면 언제나 그쪽이 이긴다** */
const FALLBACK_MESSAGE = '요청에 실패했어요. 잠시 후 다시 시도해 주세요.'
const FALLBACK_BY_STATUS: Record<string, string> = {
  blocked_consent: 'AI 사용 동의가 필요해요. 다시 시도해 주세요.',
  blocked_quota: 'AI 사용 한도에 도달했어요.',
  blocked_moderation: '입력 내용이 가이드라인을 위반해 차단됐어요.',
  blocked_input_cap: '선택한 내용이 너무 길어요. 범위를 줄여서 다시 시도해 주세요.',
  blocked_cost_quota: '오늘 AI 사용량이 많아 잠시 막혔어요. 잠시 후 다시 시도해 주세요.',
}
/** `blocked_quota` 로 오지만 한도 문제가 아닌 것 — 이중 클릭·새로고침 재진입 */
const ALREADY_RUNNING_MESSAGE =
  '이미 요청이 진행 중이에요. 결과가 도착할 때까지 기다려 주세요.'
const PROVIDER_OUTAGE_MESSAGE =
  'AI 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.'

export type NoteAiOutcome =
  /** 동의 게이트에서 사용자가 멈춤 — 토스트 없음, 히스토리에도 남기지 않는다 */
  | { kind: 'cancelled' }
  /** `truncated` = 출력 한도에서 잘림 — 성공이지만 온전하지 않다 (결과 카드가 경고한다) */
  | { kind: 'ok'; markdown: string; cached: boolean; truncated: boolean }
  | { kind: 'blocked'; message: string }
  | { kind: 'error'; message: string }

/** 인터셉터가 이미 토스트를 냈는가 (400 서버 문구 등) — 중복 노출 방지 */
function wasToastShown(err: unknown): boolean {
  return Boolean((err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown)
}

export function useNoteAiAction(resource: NoteAiResource) {
  const qc = useQueryClient()
  const ensureAiConsent = useRequireAiConsent()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: NoteAiActionBody) => noteAiActionApi.run(resource, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })

  useUnloadGuard(isPending)
  // beforeunload 가 못 덮는 SPA 내부 이동(사이드바·탭·멘션 링크) — 짝으로 막는다 (2026-08-19)
  useSpaLeaveConfirm(
    isPending,
    'AI가 아직 생성 중이에요. 지금 나가면 이 대화는 사라져요 (같은 요청을 다시 하면 결과는 무료로 받을 수 있어요). 나갈까요?',
  )

  const run = useCallback(
    async (body: NoteAiActionBody): Promise<NoteAiOutcome> => {
      if (!(await ensureAiConsent())) return { kind: 'cancelled' }
      try {
        const res = await mutateAsync(body)
        if (res.status === 'ok') {
          // 빈 markdown 은 성공이 아니다 — 서버가 걸러도 방어선을 한 겹 둔다
          if (!res.markdown?.trim()) {
            const message = '결과가 비어 있어요. 다시 시도해 주세요.'
            toast.error(message)
            return { kind: 'error', message }
          }
          return {
            kind: 'ok',
            markdown: res.markdown,
            cached: Boolean(res.cached),
            truncated: Boolean(res.truncated),
          }
        }
        if (res.status === 'error') {
          const message =
            res.reason ??
            (res.errorKind === 'provider_outage'
              ? PROVIDER_OUTAGE_MESSAGE
              : FALLBACK_MESSAGE)
          toast.error(message)
          return { kind: 'error', message }
        }
        // 🔴 ALREADY_RUNNING 선분기 — 한도 소진 문구를 내보내면 사용자가 오해한다
        const message =
          res.code === 'ALREADY_RUNNING'
            ? (res.reason ?? ALREADY_RUNNING_MESSAGE)
            : (res.reason ?? FALLBACK_BY_STATUS[res.status] ?? FALLBACK_MESSAGE)
        toast.error(message)
        return { kind: 'blocked', message }
      } catch (err) {
        const message = serverMessage(err, FALLBACK_MESSAGE)
        if (!wasToastShown(err)) toast.error(message)
        return { kind: 'error', message }
      }
    },
    [ensureAiConsent, mutateAsync],
  )

  return { run, pending: isPending }
}
