import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic } from 'lucide-react'
import {
  useInterviewPrepSessions,
  useRemoveInterviewPrepSession,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import type { InterviewPrepSession } from '@/types/interviewPrep'
import { INTERVIEW_TYPE_LABEL } from '@/types/interviewPrep'
import { NewInterviewSessionModal } from './NewInterviewSessionModal'
import { Modal } from '@/components/common/Modal'

/**
 * F6 PR 2 Phase 4 — 면접 준비 탭 (BoardDetail tab content).
 *
 * **흐름**:
 * - 세션 목록 (createdAt DESC) — 없으면 빈 상태 + 첫 세션 만들기 CTA
 * - 세션 카드 클릭 → InterviewSessionDetail (인라인 펼침 또는 전체 화면 modal)
 * - 새 세션 → NewInterviewSessionModal (자소서·로그 선택)
 */
export function InterviewPrepTab({
  applicationId,
  active,
}: {
  applicationId: string
  active: boolean
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
