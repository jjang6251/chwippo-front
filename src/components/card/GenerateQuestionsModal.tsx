import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CategorySelect } from '@/components/common/CategorySelect'
import { Modal } from '@/components/common/Modal'
import { useMyAiCosts } from '@/hooks/useMyAiQuotas'
import { isNeedCoverletterBlocked } from '@/api/interviewPrep'
import {
  GENERATE_COUNT_MAX,
  MAX_AI_QUESTIONS_PER_SESSION,
} from '@/types/interviewPrep'
import type {
  GenerateSessionDto,
  GenerateSessionResult,
} from '@/types/interviewPrep'

/**
 * 질문 은행 D2b — **AI 질문 생성 모달.**
 *
 * 🔴 **팝오버가 아니라 모달이다.** 이 페이지는 자소서와 나란히 볼 수 있어서 열이 400px 까지
 * 좁아진다 — 팝오버를 띄우면 슬라이더와 select 가 그 폭 안에서 잘리고, 모바일에선 화면
 * 밖으로 나간다. 생성은 코인이 나가는 동작이라 **잘못 눌러 시작되는 일이 없어야** 하고,
 * 그건 모달이 더 잘한다.
 *
 * 🔴 **생성은 이제 지우지 않는다** (ADR-074 뒤집기). 예전 `↻ 다시 생성` 은 기존 질문과
 * 사용자가 쓴 답변을 전부 지우고 20개를 새로 만들었다. 지금은 **원하는 개수만큼 더한다** —
 * 그래서 확인창(`window.confirm`)이 아니라 **선택 화면**이 맞는 자리가 됐다.
 */
/**
 * 🔴 **열릴 때만 마운트된다** (부모가 `{generateOpen && …}` 로 건다). `open` prop 을 받아
 * 계속 떠 있으면 두 가지가 샌다: ① 닫혀 있어도 `useMyAiCosts` 훅이 매 렌더 돌고,
 * ② 개수 기본값이 **최초 1회만** 정해져서, 20개를 만든 뒤 다시 열면 낡은 상한으로 계산된
 * `count` 가 남는다. 마운트를 부모가 쥐면 열 때마다 지금 상태로 다시 계산된다.
 */
interface Props {
  onClose: () => void
  applicationId: string
  /** 로드된 트리의 AI 질문 총수 — 상한(60) 계산 근거 */
  aiQuestionCount: number
  /** 질문이 하나라도 있는 세션인가 — 기본 개수를 가른다 */
  hasQuestions: boolean
  /**
   * 실제 생성. **결과를 그대로 돌려줘야 한다** — `undefined` 면 (동의·직무 게이트 취소,
   * 예외) 모달을 **열어 둔 채** 사용자가 다시 시도할 수 있게 한다.
   */
  onGenerate: (
    dto: GenerateSessionDto,
  ) => Promise<GenerateSessionResult | undefined>
  generating: boolean
  quotaBlocked: boolean
  quotaReason: string | null
}

export function GenerateQuestionsModal({
  onClose,
  applicationId,
  aiQuestionCount,
  hasQuestions,
  onGenerate,
  generating,
  quotaBlocked,
  quotaReason,
}: Props) {
  const navigate = useNavigate()

  /**
   * 상한 = 한 번에 만들 수 있는 수(20)와 **세션에 남은 자리**(60 − 지금) 중 작은 쪽.
   * 서버도 같은 캡을 들고 있어서 넘겨 보내면 어차피 깎여 돌아오는데, 그때는 이미
   * "20개 만들려다 3개 받은" 결과라 사용자가 고장으로 읽는다. 고르기 전에 알려준다.
   */
  const maxCount = Math.max(
    0,
    Math.min(
      GENERATE_COUNT_MAX,
      MAX_AI_QUESTIONS_PER_SESSION - aiQuestionCount,
    ),
  )
  /**
   * 기본값 — 빈 세션은 **한 벌(20개)** 이 있어야 면접 준비가 시작되고, 이미 질문이 있는
   * 세션은 보통 "조금 더" 라서 10개가 맞다. 상한이 그보다 작으면 상한에 맞춘다.
   */
  const [count, setCount] = useState(() =>
    Math.min(hasQuestions ? 10 : 20, Math.max(maxCount, 1)),
  )
  const [category, setCategory] = useState('')
  /**
   * 자소서가 없어 막혔을 때의 **서버 문구**. 토스트가 아니라 모달 안 안내로 바꾸는 이유 —
   * 여기서 필요한 건 "실패했어요" 가 아니라 **자소서를 쓰러 가는 길**이다. 토스트는 몇 초 뒤
   * 사라져서 그 길이 같이 사라진다.
   */
  const [needCoverletter, setNeedCoverletter] = useState<string | null>(null)

  const costs = useMyAiCosts('interview_prep_session')
  const capReached = maxCount === 0

  const start = async () => {
    if (capReached || generating) return
    const result = await onGenerate({ count, category: category || null })
    // 게이트 취소·예외 — 아무 일도 안 일어났으니 모달을 그대로 둔다
    if (!result) return
    if (isNeedCoverletterBlocked(result)) {
      setNeedCoverletter(result.reason ?? '')
      return
    }
    onClose()
  }

  const close = () => {
    setNeedCoverletter(null)
    onClose()
  }

  return (
    <Modal open onClose={close} title="AI 질문 생성">
      {needCoverletter !== null ? (
        <div className="space-y-4">
          {/*
            🔴 **서버 문구를 그대로 쓴다.** 자소서 게이트 문구는 서버가 들고 있고,
            프론트가 고쳐 쓰면 두 곳이 갈라진다. 우리가 더하는 건 **다음 행동**뿐이다.
          */}
          <p className="bg-info/10 border border-info/25 text-text-secondary text-xs rounded-lg p-3 leading-relaxed">
            {needCoverletter}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate(`/board/${applicationId}/coverletter`)}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors"
            >
              <FileText size={14} strokeWidth={2} aria-hidden="true" />
              자소서 쓰러 가기
            </button>
            {/*
              막다른 길로 두지 않는다 — 자소서 없이도 **지금 당장** 할 수 있는 일이 있다.
              D2a 가 직접 추가를 주 동선으로 올린 것과 같은 근거다.
            */}
            <p className="text-text-quaternary text-xs text-center leading-relaxed">
              직접 질문은 지금 바로 추가할 수 있어요.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── 개수 ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="generate-count"
                className="text-text-secondary text-xs font-medium"
              >
                만들 질문 수
              </label>
              <span className="font-mono tabular-nums text-text-primary text-sm font-semibold">
                {count}개
              </span>
            </div>
            <input
              id="generate-count"
              type="range"
              min={1}
              max={Math.max(maxCount, 1)}
              value={count}
              disabled={capReached}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {capReached ? (
              <p className="text-warning text-xs mt-2 leading-relaxed">
                AI 질문이 한도({MAX_AI_QUESTIONS_PER_SESSION}개)에 도달했어요.
              </p>
            ) : (
              maxCount < GENERATE_COUNT_MAX && (
                <p className="text-text-quaternary text-xs mt-2 leading-relaxed">
                  AI 질문 한도({MAX_AI_QUESTIONS_PER_SESSION}개)까지 {maxCount}개
                  남았어요.
                </p>
              )
            )}
          </div>

          {/* ── 카테고리 ── */}
          <div>
            <p className="text-text-secondary text-xs font-medium mb-2">
              질문 유형
            </p>
            <CategorySelect
              value={category}
              onChange={setCategory}
              label="만들 질문 유형"
              emptyLabel="전체 (부족한 유형 위주)"
              wrapperClass="w-full"
            />
          </div>

          {/* ── 코인·쿼터 ── */}
          <div className="space-y-2">
            {/*
              🔴 **개수별 가격을 그리지 않는다.** 예약치는 feature 단위라 개수를 안 본다
              (`countSensitive: false`) — 슬라이더 옆에 숫자를 붙이면 "20개면 20배" 로 읽힌다.
              문구는 못 불러왔으면 **아예 생략**한다. 틀린 숫자를 보여주느니 안 보여준다.
            */}
            {costs.data?.chargesCoins && (
              <p className="text-text-quaternary text-xs leading-relaxed">
                시작하면 약{' '}
                <span className="font-mono tabular-nums text-text-tertiary font-semibold">
                  {costs.data.estimatedCoins}
                </span>
                코인이 예약되고, 실제로는 쓴 만큼만 차감돼요.
              </p>
            )}
            <AiQuotaChip feature="interview_prep_session" />
          </div>

          <button
            type="button"
            onClick={start}
            disabled={capReached || generating || quotaBlocked}
            title={quotaReason ?? undefined}
            className="w-full min-h-[44px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* 버튼 로딩은 하우스 패턴대로 **텍스트 변경**만 (스피너 없음) */}
            {generating ? '만들고 있어요…' : `✨ ${count}개 생성 시작`}
          </button>
        </div>
      )}
    </Modal>
  )
}
