import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApplication, useUpdateApplication, useUpdateCurrentStep, useUpdateSteps } from '@/hooks/useApplications'
import { StepBar } from '@/components/card/StepBar'
import { DdayBadge } from '@/components/card/DdayBadge'
import { SetResultModal } from '@/components/card/SetResultModal'
import { Modal } from '@/components/common/Modal'
import { toast } from '@/stores/toastStore'
import { calcDday } from '@/utils/dday'
import type { ApplicationStep } from '@/types/application'

export function BoardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: app, isLoading } = useApplication(id!)
  const { mutate: update } = useUpdateApplication(id!)
  const { mutate: updateStep } = useUpdateCurrentStep()
  const { mutate: updateSteps, isPending: isSavingSteps } = useUpdateSteps(id!)

  const [editing, setEditing] = useState<Record<string, string>>({})
  const [showResultModal, setShowResultModal] = useState(false)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [editSteps, setEditSteps] = useState<Array<{ name: string; tempId: string }>>([])

  if (isLoading) return <DetailSkeleton />
  if (!app) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-tertiary text-sm">
      카드를 찾을 수 없어요.
    </div>
  )

  const sortedSteps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const needsResult = app.status === 'IN_PROGRESS' && app.deadline && calcDday(app.deadline) < 0

  const handleInlineEdit = (field: string, value: string) => {
    setEditing((prev) => ({ ...prev, [field]: value }))
  }

  const handleInlineSave = (field: string) => {
    if (editing[field] === undefined) return
    update(
      { [field]: editing[field] || undefined },
      {
        onSuccess: () => {
          setEditing((prev) => { const n = { ...prev }; delete n[field]; return n })
          toast.show('저장됐어요.')
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleStepClick = (index: number) => {
    const isLastStep = index === sortedSteps.length - 1
    if (isLastStep) {
      if (confirm(`"${sortedSteps[index].name}"을(를) 완료하면 최종 합격으로 처리됩니다.`)) {
        updateStep({ id: app.id, stepIndex: index })
      }
    } else {
      updateStep({ id: app.id, stepIndex: index })
    }
  }

  const openStepEditor = () => {
    setEditSteps(sortedSteps.map((s) => ({ name: s.name, tempId: s.id })))
    setShowStepEditor(true)
  }

  const handleSaveSteps = () => {
    const valid = editSteps.filter((s) => s.name.trim())
    if (valid.length === 0) return
    updateSteps(
      { steps: valid.map((s, i) => ({ orderIndex: i, name: s.name.trim() })) },
      {
        onSuccess: () => { setShowStepEditor(false); toast.show('스텝이 저장됐어요.') },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate('/board')}
        className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-xs mb-6 transition-colors group"
      >
        <svg className="group-hover:-translate-x-0.5 transition-transform" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        지원 현황 보드
      </button>

      {/* 카드 헤더 */}
      <div className={`
        border rounded-2xl p-6 mb-4
        ${app.status === 'PASSED' ? 'border-success/25 bg-success/5' : 'border-white/8 bg-surface-2'}
      `}>
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-none
            ${app.status === 'PASSED' ? 'bg-success/15 text-success' : 'bg-brand/15 text-brand'}`}>
            {app.companyName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            {/* 회사명 인라인 편집 */}
            <input
              value={editing.companyName ?? app.companyName}
              onChange={(e) => handleInlineEdit('companyName', e.target.value)}
              onBlur={() => handleInlineSave('companyName')}
              onKeyDown={(e) => e.key === 'Enter' && handleInlineSave('companyName')}
              className="w-full bg-transparent text-text-primary text-lg font-bold focus:outline-none border-b border-transparent focus:border-brand/40 transition-colors pb-0.5"
            />
            {/* 직무명 */}
            <input
              value={editing.jobTitle ?? (app.jobTitle ?? '')}
              onChange={(e) => handleInlineEdit('jobTitle', e.target.value)}
              onBlur={() => handleInlineSave('jobTitle')}
              onKeyDown={(e) => e.key === 'Enter' && handleInlineSave('jobTitle')}
              placeholder="직무명 입력"
              className="w-full bg-transparent text-text-tertiary text-sm focus:outline-none border-b border-transparent focus:border-brand/40 transition-colors mt-1 pb-0.5 placeholder:text-text-quaternary"
            />
          </div>

          <div className="flex items-center gap-2 flex-none">
            {app.status === 'PASSED' && (
              <span className="text-xs text-success font-medium bg-success/10 px-2 py-1 rounded-full border border-success/20">🎉 최종 합격</span>
            )}
            {app.deadline && app.status !== 'PASSED' && (
              <DdayBadge deadline={app.deadline} />
            )}
          </div>
        </div>

        {/* 마감일 + 채용공고 URL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-text-quaternary mb-1">서류 마감일</label>
            <input
              type="date"
              value={editing.deadline ?? (app.deadline ?? '')}
              onChange={(e) => handleInlineEdit('deadline', e.target.value)}
              onBlur={() => handleInlineSave('deadline')}
              className="w-full bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-quaternary mb-1">채용공고 URL</label>
            <div className="flex gap-1.5">
              <input
                value={editing.jobUrl ?? (app.jobUrl ?? '')}
                onChange={(e) => handleInlineEdit('jobUrl', e.target.value)}
                onBlur={() => handleInlineSave('jobUrl')}
                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave('jobUrl')}
                placeholder="https://"
                className="flex-1 min-w-0 bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/40 transition-all"
              />
              {app.jobUrl && (
                <a href={app.jobUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-none px-2 py-2 bg-surface-3 border border-white/8 rounded-lg text-text-quaternary hover:text-text-secondary text-xs transition-colors">
                  ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 스텝바 */}
      {app.status !== 'PLANNED' && sortedSteps.length > 0 && (
        <div className="border border-white/8 bg-surface-2 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary text-sm font-semibold">진행 상황</h2>
            {app.status !== 'PASSED' && (
              <button
                onClick={openStepEditor}
                className="text-xs text-text-tertiary hover:text-text-secondary border border-white/8 hover:border-white/15 px-2.5 py-1.5 rounded-lg transition-all"
              >
                스텝 편집
              </button>
            )}
          </div>
          <StepBar
            steps={app.steps}
            currentStepIndex={app.currentStepIndex}
            onStepClick={app.status !== 'PASSED' && app.status !== 'FAILED' ? handleStepClick : undefined}
            size="md"
          />
        </div>
      )}

      {/* 결과 처리 버튼 */}
      {needsResult && (
        <div className="border border-warning/25 bg-warning/5 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-warning text-xs font-medium">⚠️ 마감일이 지났어요</p>
            <p className="text-text-tertiary text-xs mt-0.5">최종 결과를 입력해주세요.</p>
          </div>
          <button
            onClick={() => setShowResultModal(true)}
            className="text-xs font-medium text-white bg-brand hover:bg-accent px-3 py-2 rounded-lg transition-colors"
          >
            결과 입력
          </button>
        </div>
      )}

      {/* 메모 */}
      <div className="border border-white/8 bg-surface-2 rounded-2xl p-5">
        <h2 className="text-text-primary text-sm font-semibold mb-3">메모</h2>
        <textarea
          value={editing.memo ?? (app.memo ?? '')}
          onChange={(e) => handleInlineEdit('memo', e.target.value)}
          onBlur={() => handleInlineSave('memo')}
          placeholder="면접관 3명, 복장 자유, 기술 면접 위주..."
          maxLength={500}
          rows={4}
          className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 resize-none transition-all"
        />
        <p className="text-right text-[10px] text-text-quaternary mt-1">
          {(editing.memo ?? app.memo ?? '').length}/500
        </p>
      </div>

      {/* 결과 모달 */}
      <SetResultModal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        applicationId={app.id}
        companyName={app.companyName}
      />

      {/* 스텝 편집 모달 */}
      <Modal open={showStepEditor} onClose={() => setShowStepEditor(false)} title="스텝 편집" width="w-96">
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-4">
          {editSteps.map((step, i) => (
            <div key={step.tempId} className="flex items-center gap-2">
              <span className="text-text-quaternary text-xs w-4 text-center">{i + 1}</span>
              <input
                value={step.name}
                onChange={(e) => setEditSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s))}
                className="flex-1 bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all"
              />
              <button
                onClick={() => setEditSteps((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-text-quaternary hover:text-danger transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setEditSteps((prev) => [...prev, { name: '', tempId: crypto.randomUUID() }])}
          className="w-full py-2 text-xs text-text-tertiary border border-dashed border-white/15 rounded-lg hover:border-white/25 hover:text-text-secondary transition-all mb-4"
        >
          + 스텝 추가
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowStepEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={handleSaveSteps} disabled={isSavingSteps} className="flex-1 py-2.5 text-xs font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40">
            {isSavingSteps ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-3 bg-white/6 rounded w-24 mb-6" />
      <div className="border border-white/8 bg-surface-2 rounded-2xl p-6 mb-4">
        <div className="flex gap-4 mb-5">
          <div className="w-12 h-12 bg-white/6 rounded-xl" />
          <div className="flex-1">
            <div className="h-5 bg-white/8 rounded w-32 mb-2" />
            <div className="h-3 bg-white/5 rounded w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-9 bg-white/5 rounded-lg" />
          <div className="h-9 bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
