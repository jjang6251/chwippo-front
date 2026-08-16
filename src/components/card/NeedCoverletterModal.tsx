import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Modal } from '@/components/common/Modal'

/**
 * 자소서가 없어 면접 AI 가 막혔을 때의 **공통 안내 모달.**
 *
 * 🔴 **토스트가 아니라 모달인 이유.** 여기서 사용자에게 필요한 건 "실패했어요" 가 아니라
 * **자소서를 쓰러 가는 길**이다. 토스트는 몇 초 뒤 사라지면서 그 길까지 같이 가져간다.
 * `GenerateQuestionsModal` 의 인라인 안내가 같은 판단으로 먼저 만들어졌고, 이 모달은
 * 그 안내를 **모달 밖에서 일어나는 3경로**(답변·꼬리질문·↻ 교체)가 쓰게 꺼낸 것이다.
 *
 * 🔴 **부모가 조건부로 마운트한다** (`{reason !== null && <NeedCoverletterModal open … />}`).
 * `open` 을 받아 항상 떠 있으면 자소서와 무관한 카드까지 `useNavigate` 를 부르게 되는데,
 * 이 카드는 라우터 없이 렌더되는 자리(테스트·랜딩 프리뷰)가 있다.
 */
interface Props {
  open: boolean
  onClose: () => void
  /** 자소서를 쓰러 갈 지원 카드 */
  applicationId: string
  /**
   * 서버가 준 차단 사유. **있으면 그대로 쓴다** — 자소서 게이트 문구는 서버가 들고 있고,
   * 프론트가 고쳐 쓰면 두 곳이 갈라진다. 우리가 더하는 건 **다음 행동**뿐이다.
   */
  reason?: string
}

const FALLBACK_REASON =
  'AI 질문·답변은 자소서를 재료로 만들어요. 자소서를 먼저 등록해 주세요.'

export function NeedCoverletterModal({
  open,
  onClose,
  applicationId,
  reason,
}: Props) {
  /*
    데모 프리픽스를 붙이지 않는다 — 데모 어댑터가 AI 경로를 먼저 차단해서 이 모달이
    `/demo/*` 안에서 뜨지 않는다. 같은 CTA 를 그리는 `GenerateQuestionsModal` 과 같은 선택.
  */
  const navigate = useNavigate()

  return (
    <Modal open={open} onClose={onClose} title="자소서가 필요해요">
      <div className="space-y-4">
        <p className="bg-info/10 border border-info/25 text-text-secondary text-xs rounded-lg p-3 leading-relaxed">
          {reason?.trim() ? reason : FALLBACK_REASON}
        </p>
        {/*
          막다른 길로 두지 않는다 — 자소서가 없어도 **지금 당장** 할 수 있는 일이 있다.
          질문 직접 추가·내 답변 메모는 AI 와 무관해서 이 차단의 영향을 받지 않는다.
        */}
        <p className="text-text-quaternary text-xs leading-relaxed">
          직접 질문 추가와 내 답변 메모는 자소서 없이도 계속 쓸 수 있어요.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate(`/board/${applicationId}/coverletter`)}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand hover:bg-accent text-bg text-sm font-semibold px-5 py-2.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <FileText size={14} strokeWidth={2} aria-hidden="true" />
            자소서 쓰러 가기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] text-text-tertiary hover:text-text-primary text-sm font-medium px-5 py-2.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  )
}
