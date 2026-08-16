import { useState } from 'react'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'
import type { Application } from '@/types/application'

/**
 * A9 — 탈락 카드 상세의 "이번 지원에서 얻은 것" 표시·입력·수정.
 * 탈락 순간 스킵했어도 나중에 남길 수 있게 (성장 페이지 누적 소스).
 */
export function FailedTakeawayBox({ application }: { application: Application }) {
  const { mutate: update, isPending } = useUpdateApplication(application.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const { ref: draftRef, autoResize } = useAutoResize(draft, { min: 72, max: 240 })

  if (application.status !== 'FAILED') return null

  const takeaway = application.failedTakeaway ?? null

  const startEdit = () => {
    setDraft(takeaway ?? '')
    setEditing(true)
  }

  const save = () => {
    update(
      { failedTakeaway: draft.trim() },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success(
            draft.trim() ? '기록했어요. 성장 페이지에 쌓여요.' : '기록을 지웠어요.',
          )
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <div className="bg-card border border-line rounded-lg px-3.5 py-3 mb-4">
      <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-1.5">
        이번 지원에서 얻은 것
      </p>
      {editing ? (
        <>
          <textarea
            ref={draftRef}
            autoFocus
            aria-label="탈락 회고"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              autoResize()
            }}
            maxLength={500}
            placeholder="예: 프로젝트 회고 질문에 수치로 답하기"
            className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60 resize-none mb-0.5"
          />
          <p className="text-right text-[10px] font-mono text-text-quaternary mb-1.5">
            {draft.length}/500
          </p>
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="text-[11px] font-medium text-text-quaternary hover:text-text-secondary px-2.5 py-1.5 rounded-md transition-colors"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={isPending}
              className="text-[11px] font-medium text-bg bg-brand hover:bg-accent px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </>
      ) : takeaway ? (
        <button
          onClick={startEdit}
          className="w-full text-left text-sm text-text-secondary leading-relaxed hover:text-text-primary transition-colors"
          title="눌러서 수정"
        >
          {takeaway}
        </button>
      ) : (
        <button
          onClick={startEdit}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          + 한 줄 남기기 — 성장 페이지에 쌓여요
        </button>
      )}
    </div>
  )
}
