import { Mic } from 'lucide-react'
import { useState } from 'react'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { Modal } from '@/components/common/Modal'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import { useInterviewPrepSessions } from '@/hooks/useInterviewPrep'
import {
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'

/**
 * 면접 세션으로 건너가기 — **0/1/N 갈래를 한 곳에 모아 둔 버튼.**
 *
 * 🔴 **방향이 비대칭이다.** 면접 → 자소서는 1:1(세션은 한 회사에 속한다)이지만,
 * 무언가 → 면접은 **1:N** 이다 — 1차·2차·임원면접이 따로 있을 수 있다.
 *
 *   0개 → 만들기 모달 (버튼 문구도 **「만들기」**로 바뀐다 — 「준비하기」면 기존 게 있는 줄 안다)
 *   1개 → 바로 이동 (고를 게 없는데 물을 이유가 없다)
 *   N개 → 선택 목록 + 🔴 **「새로 만들기」** (목록만 두면 3차가 잡혔을 때 만들 길이 없다)
 *
 * `navigateOnly` 는 **이미 있는 세션으로 이동만** 한다 (모바일). 세션 생성은 AI 질문
 * 생성으로 이어져 코인이 드는 동작이라, 자소서 화면이 보기 전용인 곳에서는 만들지 않는다.
 * 만들 세션이 하나도 없으면 아예 렌더하지 않는다 — 눌러도 갈 곳이 없는 버튼은 두지 않는다.
 *
 * 🔴 **자소서 화면 전용이 아니다.** 준비 노트(스텝 페이지)에서도 같은 0/1/N 판단이
 * 필요해져 `pages/Coverletter/CoverletterDocPage` 에서 여기로 옮겼다. 페이지 모듈에
 * 두면 스텝 페이지가 자소서 페이지 전체(AI 채팅 패널까지)를 같은 청크로 끌고 온다.
 */
export function GoToInterviewButton({
  applicationId,
  navigateOnly = false,
  navState,
  label,
  disabled = false,
  title,
  onNeedCoverletter,
}: {
  applicationId: string
  navigateOnly?: boolean
  /** 세션으로 옮겨 갈 때 함께 넘길 router state (준비 노트 → 질문 브리지의 `bridgeText`) */
  navState?: unknown
  /**
   * 문구 고정. 지정하면 0/1/N 과 무관하게 이 문구를 쓴다 —
   * **고정이라 아래의 라벨 깜빡임 자체가 성립하지 않는다.**
   */
  label?: string
  /** 호출부 사정으로 잠글 때 (예: 준비 노트가 비어 있어 넘길 내용이 없음) */
  disabled?: boolean
  /** 기본 툴팁 대체. 조회 실패 툴팁은 항상 우선한다 (실패를 감추지 않는다) */
  title?: string
  /**
   * 자소서가 0건일 때 생성 모달의 「자소서 등록하러 가기」.
   * 기본은 **모달만 닫기** — 자소서 화면에서 열렸다면 닫는 순간 그 자리이기 때문이다.
   * 다른 화면에서 쓰면 자소서로 가는 길을 직접 넘겨야 한다.
   */
  onNeedCoverletter?: () => void
}) {
  const navigate = useDemoNavigate()
  /*
    🔴 **로딩 중을 「없음」으로 읽으면 안 된다** (2026-08-10 점검).
    조회 전엔 `[]` 이므로 세션이 있어도 「새로 만들기」가 열리고, 거기서 만들면
    **AI 질문 생성으로 코인이 나간다.** 라벨도 「만들기 ↔ 준비하기」로 깜빡였다.
    실패도 마찬가지 — 모르는 상태에서 중복을 만들 바엔 버튼을 잠근다.
  */
  const {
    data: sessions = [],
    isLoading: sessLoading,
    isError: sessError,
  } = useInterviewPrepSessions(applicationId)
  const sessUnknown = sessLoading || sessError
  const [picking, setPicking] = useState(false)
  const [creating, setCreating] = useState(false)

  const goSession = (sessionId: string) =>
    navigate(`/interviews/${sessionId}`, { state: navState })

  const go = () => {
    if (sessUnknown || disabled) return // 몇 개인지 모르는 채로 만들지 않는다
    if (sessions.length === 0) {
      if (navigateOnly) return
      return setCreating(true)
    }
    if (sessions.length === 1) return goSession(sessions[0].id)
    setPicking(true)
  }

  // 이동만 가능한데 갈 곳이 없으면 버튼 자체를 두지 않는다
  if (navigateOnly && (sessUnknown || sessions.length === 0)) return null

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={sessUnknown || disabled}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg shrink-0 min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 disabled:opacity-50 disabled:cursor-default px-3 py-2.5 rounded-lg transition-colors"
        title={
          sessError
            ? '면접 준비 목록을 불러오지 못했어요'
            : (title ?? '이 자소서를 바탕으로 면접 예상 질문을 준비해요')
        }
      >
        <Mic size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        {label ??
          (navigateOnly || sessUnknown || sessions.length > 0
            ? '면접 준비하기'
            : '면접 준비 만들기')}
      </button>

      {picking && (
        <Modal open onClose={() => setPicking(false)} title="어느 면접을 준비할까요?">
          <div className="space-y-1.5">
            {sessions.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => goSession(sess.id)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[44px] text-left border border-line bg-card hover:border-brand/40 rounded-lg px-3.5 py-3 flex items-center gap-2.5 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text-primary truncate">
                    {sess.round}
                  </span>
                  {/* 질문이 아직 없으면 그것도 정보다 — 어디를 골라야 할지 판단에 쓴다 */}
                  <span className="block text-[11px] text-text-quaternary mt-0.5">
                    {sess.generationStatus === 'completed'
                      ? '질문 준비됨'
                      : '아직 질문 없음'}
                  </span>
                </span>
                {sess.interviewType && (
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${INTERVIEW_TYPE_STYLE[sess.interviewType]}`}
                  >
                    {INTERVIEW_TYPE_LABEL[sess.interviewType]}
                  </span>
                )}
              </button>
            ))}
            {/* 🔴 3차가 잡히면 여기서 만든다 — 목록만 두면 새로 만들 길이 없다 */}
            <button
              type="button"
              onClick={() => {
                setPicking(false)
                setCreating(true)
              }}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[44px] text-xs font-medium text-text-tertiary hover:text-text-secondary border border-dashed border-line hover:border-line-strong rounded-lg py-3 transition-colors"
            >
              + 새 면접 준비 만들기
            </button>
          </div>
        </Modal>
      )}

      {creating && (
        <NewInterviewSessionModal
          applicationId={applicationId}
          onClose={() => setCreating(false)}
          onCreated={goSession}
          onNeedCoverletter={() => {
            setCreating(false)
            onNeedCoverletter?.()
          }}
        />
      )}
    </>
  )
}
