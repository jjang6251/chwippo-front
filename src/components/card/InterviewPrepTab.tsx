import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic } from 'lucide-react'
import {
  useInterviewPrepQuestions,
  useInterviewPrepSessions,
  useRemoveInterviewPrepSession,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import type {
  InterviewPrepQuestion,
  InterviewPrepSession,
} from '@/types/interviewPrep'
import { INTERVIEW_TYPE_LABEL } from '@/types/interviewPrep'
import { NewInterviewSessionModal } from './NewInterviewSessionModal'
import { Modal } from '@/components/common/Modal'

/** 트리 전체에서 **내가 직접 적은** 질문 수 — 꼬리 자리에 적은 것도 함께 센다 */
function countUserQuestions(nodes: InterviewPrepQuestion[]): number {
  return nodes.reduce(
    (sum, n) =>
      sum + (n.source === 'user' ? 1 : 0) + countUserQuestions(n.children),
    0,
  )
}

/**
 * F6 PR 2 Phase 4 — 면접 준비 탭 (BoardDetail tab content).
 *
 * **흐름**:
 * - 세션 목록 (createdAt DESC) — 없으면 빈 상태 + 첫 세션 만들기 CTA
 * - 세션 카드 클릭 → /interviews/:sessionId (InterviewSessionPage)
 * - 새 세션 → NewInterviewSessionModal (자소서·로그 선택)
 */
export function InterviewPrepTab({
  applicationId,
  active,
  onNeedCoverletter,
}: {
  applicationId: string
  active: boolean
  /**
   * v2 — 자소서 0건이라 세션을 만들 수 없을 때 자소서 탭으로 보낸다.
   *
   * 🔴 여기서 `navigate('/board/:id?tab=coverletter')` 를 쓰면 **동작하지 않는다** —
   * 같은 라우트라 BoardDetail 이 리마운트되지 않고, 탭 초기값을 읽는 `useState`
   * 이니셜라이저가 다시 돌지 않는다. 부모가 직접 상태를 바꿔야 한다.
   */
  onNeedCoverletter: () => void
}) {
  const { data: items, isLoading } = useInterviewPrepSessions(
    applicationId,
    active,
  )
  const { mutate: removeSession } = useRemoveInterviewPrepSession(applicationId)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<InterviewPrepSession | null>(
    null,
  )

  /**
   * 🔴 **확인 모달이 열릴 때만 조회한다.** 탭에 세션이 5개 있으면 목록을 그리는 것만으로
   * 질문 트리 5벌을 받아 오는 셈이라, 지우지도 않을 데이터를 매번 끌고 온다.
   * 지울 세션 하나가 정해진 뒤에 그 세션만 본다.
   */
  const { data: pendingQuestions = [] } = useInterviewPrepQuestions(
    pendingDelete?.id ?? '',
    !!pendingDelete,
  )
  const userQuestionCount = countUserQuestions(pendingQuestions)

  const confirmDelete = () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    removeSession(id, {
      onSuccess: () => toast.show('면접 세션을 삭제했어요.'),
      onError: () => toast.error('삭제에 실패했습니다.'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 bg-surface-2 border border-line rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  const list = items ?? []

  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-2/40 rounded-xl px-6 py-10 text-center">
          <div className="mb-2"><Mic size={24} strokeWidth={1.75} aria-hidden="true" className="inline-block" /></div>
          <p className="text-text-secondary text-sm font-medium mb-1">
            면접 준비 세션을 만들어 보세요
          </p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-5">
            자소서·활동 로그를 골라 AI 에게 예상 질문 + 모범 답안을
            <br />
            한 번에 받아볼 수 있어요.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors"
          >
            첫 세션 만들기
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <p className="text-text-tertiary text-xs">
              총 {list.length}개 세션
            </p>
            <button
              onClick={() => setCreating(true)}
              className="text-brand hover:text-brand-hover text-xs font-medium"
            >
              + 새 세션
            </button>
          </div>
          {list.map((s) => (
            <div
              key={s.id}
              className="border border-line bg-surface-2 rounded-xl flex items-center justify-between gap-2 px-4 py-3 hover:bg-surface-3 transition-colors"
            >
              <Link
                to={`/interviews/${s.id}`}
                className="flex items-center gap-2 min-w-0 flex-1"
              >
                <span className="text-text-primary text-sm font-medium truncate">
                  {s.round}
                </span>
                {s.interviewType && (
                  <span className="text-text-quaternary text-[10px] bg-surface-3 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {INTERVIEW_TYPE_LABEL[s.interviewType]}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-text-faint text-[10px]">
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <button
                  onClick={() => setPendingDelete(s)}
                  className="text-text-faint hover:text-danger text-xs px-1"
                  aria-label="세션 삭제"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {creating && (
        <NewInterviewSessionModal
          applicationId={applicationId}
          onClose={() => setCreating(false)}
          onCreated={(sessionId) => {
            setCreating(false)
            toast.show('면접 세션이 생성됐어요.')
            navigate(`/interviews/${sessionId}`)
          }}
          onNeedCoverletter={() => {
            setCreating(false)
            onNeedCoverletter()
          }}
        />
      )}

      {pendingDelete && (
        <Modal
          open
          onClose={() => setPendingDelete(null)}
          title="면접 세션 삭제"
        >
          <p className="text-text-secondary text-sm mb-4 leading-relaxed">
            <strong className="text-text-primary">{pendingDelete.round}</strong>
            {' '}세션을 삭제하시겠어요?
            <br />
            <span className="text-text-quaternary text-xs">
              생성된 질문·내 메모도 함께 사라집니다.
            </span>
            {/*
              🔴 **직접 적은 질문은 따로 말한다** (질문 은행 D2b). AI 질문은 다시 만들면
              되지만 내가 모은 기출은 어디에도 없다 — 면접 다녀와 복기한 것들이다.

              🔴 **로드를 기다리지 않는다.** 질문 목록은 모달이 열릴 때 처음 조회하는데,
              그 응답을 기다리느라 [삭제] 를 막으면 멀쩡한 세션을 지우려던 사람이 붙잡힌다.
              도착하면 한 줄이 더해질 뿐이고, 그 전에도 위 문구가 이미 경고하고 있다.
            */}
            {userQuestionCount > 0 && (
              <>
                <br />
                <span className="text-warning text-xs">
                  직접 추가한 질문 {userQuestionCount}개도 함께 삭제돼요.
                </span>
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingDelete(null)}
              className="px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
            >
              취소
            </button>
            <button
              onClick={confirmDelete}
              className="px-3 py-1.5 text-xs bg-danger/15 text-danger hover:bg-danger/25 rounded-md font-medium"
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
