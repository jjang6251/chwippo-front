import { useState } from 'react'
import {
  useCoverletters,
  useCreateCoverletter,
  useRemoveCoverletter,
  useUpdateCoverletter,
} from '@/hooks/useApplicationCoverletters'
import { CoverLetterCard } from '@/components/card/CoverLetterCard'
import { Modal } from '@/components/common/Modal'
import { toast } from '@/stores/toastStore'
import type { ApplicationCoverletter, UpdateCoverletterDto } from '@/types/coverletter'

const COMMON_QUESTIONS = [
  { label: '지원 동기', question: '해당 직무에 지원하게 된 동기를 작성해 주세요.', category: '지원동기' },
  { label: '성장 과정·가치관', question: '본인의 성장 과정과 가치관을 작성해 주세요.', category: '성장과정·가치관' },
  { label: '입사 후 포부', question: '입사 후 이루고 싶은 목표와 포부를 작성해 주세요.', category: '입사후포부' },
  { label: '직무 역량·핵심 경험', question: '지원 직무와 관련된 본인의 핵심 역량과 경험을 작성해 주세요.', category: '직무역량·핵심경험' },
]

export function CoverLetterTab({ applicationId, active }: { applicationId: string; active: boolean }) {
  const { data: items, isLoading } = useCoverletters(applicationId, active)
  const { mutate: create, isPending: creating } = useCreateCoverletter(applicationId)
  const { mutate: update } = useUpdateCoverletter(applicationId)
  const { mutate: remove } = useRemoveCoverletter(applicationId)
  const [pendingDelete, setPendingDelete] = useState<ApplicationCoverletter | null>(null)

  const handleUpdate = (clId: string, dto: UpdateCoverletterDto) =>
    update({ clId, dto }, { onSuccess: () => toast.show('저장됐어요.'), onError: () => toast.error('저장에 실패했습니다.') })

  const handleAdd = (question = '', category?: string) =>
    create({ question, category }, { onError: () => toast.error('추가에 실패했습니다.') })

  const confirmDelete = () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    remove(id, { onSuccess: () => toast.show('문항을 삭제했어요.'), onError: () => toast.error('삭제에 실패했습니다.') })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => <div key={i} className="h-48 bg-surface-2 border border-line rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const list = items ?? []

  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-2/40 rounded-xl px-6 py-10 text-center">
          <div className="text-2xl mb-2">📝</div>
          <p className="text-text-secondary text-sm font-medium mb-1">자소서 문항을 모아보세요</p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-5">
            이 회사 자소서 문항과 답변을 한곳에 정리하고,<br />
            다른 카드나 내정보 소재에서 답변을 가져올 수 있어요.
          </p>
          <button
            onClick={() => handleAdd()}
            disabled={creating}
            className="px-4 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
          >
            + 첫 문항 추가하기
          </button>
        </div>
      ) : (
        <div className="border border-line bg-surface-2 rounded-xl divide-y divide-line overflow-hidden">
          {list.map((cl) => (
            <CoverLetterCard
              key={cl.id}
              cl={cl}
              applicationId={applicationId}
              onUpdate={handleUpdate}
              onRequestRemove={setPendingDelete}
            />
          ))}
        </div>
      )}

      {/* 추가 영역 */}
      <div className="border border-line bg-surface-2 rounded-xl p-4">
        <button
          data-tour="add-question-btn"
          onClick={() => handleAdd()}
          disabled={creating}
          className="w-full py-2.5 text-xs font-medium text-text-secondary border border-dashed border-line rounded-lg
            hover:border-brand/40 hover:text-text-primary transition-colors disabled:opacity-40"
        >
          + 문항 추가
        </button>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-[11px] text-text-quaternary self-center mr-0.5">자주 쓰는 문항:</span>
          {COMMON_QUESTIONS.map((q) => (
            <button
              key={q.label}
              onClick={() => handleAdd(q.question, q.category)}
              disabled={creating}
              className="text-[11px] text-text-tertiary bg-surface-3 border border-line hover:border-brand/40 hover:text-text-secondary
                px-2 py-1 rounded-full transition-colors disabled:opacity-40"
            >
              + {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* 삭제 확인 */}
      <Modal open={pendingDelete !== null} onClose={() => setPendingDelete(null)} title="문항을 삭제할까요?">
        <p className="text-text-tertiary text-xs leading-relaxed mb-5">
          이 문항과 작성한 답변이 삭제됩니다. 되돌릴 수 없어요.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPendingDelete(null)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors">취소</button>
          <button onClick={confirmDelete} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger/80 hover:bg-danger rounded-lg transition-colors">삭제</button>
        </div>
      </Modal>
    </div>
  )
}
