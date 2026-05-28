import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { useActivities, useActivityLogs } from '@/hooks/useActivities'
import { toast } from '@/stores/toastStore'
import type {
  InterviewPrepSession,
  InterviewType,
  UpdateSessionDto,
} from '@/types/interviewPrep'
import {
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'

interface Props {
  session: InterviewPrepSession
  onClose: () => void
  onSave: (dto: UpdateSessionDto, refs: {
    coverletterIds: string[]
    extraLogIds: string[]
  }) => void
  isSaving: boolean
}

const TYPE_OPTIONS: Array<{ value: InterviewType; label: string }> = (
  Object.entries(INTERVIEW_TYPE_LABEL) as Array<[InterviewType, string]>
).map(([value, label]) => ({ value, label }))

/**
 * F6 PR 2 Phase 4 — 면접 세션 참고 자료·강화 자료 사후 편집.
 *
 * **저장 후 사용자가 "다시 생성" 으로 트리 재생성** — 새 자료 기반 새 질문.
 * 백엔드 PATCH /interview-prep-sessions/:id 가 coverletterIds·extraLogIds 변경 처리 (아직 미지원).
 * → Phase 4 단계 5 추가 : 백엔드 UpdateSessionDto 에 coverletterIds·extraLogIds 도 받게 확장 필요.
 */
export function EditInterviewSessionModal({
  session,
  onClose,
  onSave,
  isSaving,
}: Props) {
  const [interviewType, setInterviewType] = useState<InterviewType | ''>(
    session.interviewType ?? '',
  )
  const [jobDescription, setJobDescription] = useState(
    session.jobDescription ?? '',
  )
  const [emphasisPoints, setEmphasisPoints] = useState(
    session.emphasisPoints ?? '',
  )
  const [selectedClIds, setSelectedClIds] = useState<Set<string>>(
    new Set(session.coverletterIds),
  )
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(
    new Set(session.extraLogIds),
  )

  const { data: coverletters } = useCoverletters(session.applicationId, true)
  const { data: activities } = useActivities()

  const toggleId = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const handleSubmit = () => {
    onSave(
      {
        interviewType: interviewType || null,
        jobDescription: jobDescription.trim() || null,
        emphasisPoints: emphasisPoints.trim() || null,
      },
      {
        coverletterIds: Array.from(selectedClIds),
        extraLogIds: Array.from(selectedLogIds),
      },
    )
  }

  const clList = coverletters ?? []
  const actList = activities ?? []

  return (
    <Modal open onClose={onClose} title="면접 세션 편집" width="max-w-2xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-text-tertiary text-xs leading-relaxed bg-info/5 border border-info/20 rounded-lg p-3">
          💡 자료를 바꾸고 저장한 뒤 <strong>"↻ 다시 생성"</strong> 을 누르면 새
          자료 기반으로 질문이 재생성돼요. (기존 질문·내 메모는 사라집니다)
        </p>

        {/* 면접 종류 */}
        <section>
          <label className="block text-sm text-text-secondary font-medium mb-2">
            면접 종류
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setInterviewType(
                    interviewType === opt.value ? '' : opt.value,
                  )
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  interviewType === opt.value
                    ? INTERVIEW_TYPE_STYLE[opt.value]
                    : 'bg-surface border-line text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 모집 요강 + 강조 */}
        <section className="space-y-3">
          <h3 className="text-sm text-text-secondary font-medium">
            🎯 AI 강화 자료
          </h3>
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">
              모집 요강 / 우대사항
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              maxLength={8000}
              rows={5}
              placeholder="공고에서 복사·붙여넣기"
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-brand/45 outline-none resize-none leading-relaxed"
            />
            <p className="text-text-faint text-[11px] mt-1 text-right">
              {jobDescription.length} / 8000
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">
              강조하고 싶은 강점·경험
            </label>
            <textarea
              value={emphasisPoints}
              onChange={(e) => setEmphasisPoints(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="면접관에게 꼭 어필하고 싶은 본인 강점"
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-brand/45 outline-none resize-none leading-relaxed"
            />
            <p className="text-text-faint text-[11px] mt-1 text-right">
              {emphasisPoints.length} / 2000
            </p>
          </div>
        </section>

        {/* 자소서 */}
        <section>
          <label className="block text-sm text-text-secondary font-medium mb-2">
            📄 자소서 문항{' '}
            <span className="text-text-faint text-xs font-normal">
              ({selectedClIds.size}개 선택)
            </span>
          </label>
          {clList.length === 0 ? (
            <p className="text-text-faint text-sm">자소서 문항이 없어요.</p>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1 border border-line rounded-lg p-2 bg-surface">
              {clList.map((cl) => (
                <label
                  key={cl.id}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={selectedClIds.has(cl.id)}
                    onChange={() =>
                      setSelectedClIds((s) => toggleId(s, cl.id))
                    }
                    className="accent-brand"
                  />
                  <span className="truncate">
                    {cl.category && (
                      <span className="text-text-faint mr-1">
                        [{cl.category}]
                      </span>
                    )}
                    {cl.question}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* 활동 로그 */}
        <section>
          <label className="block text-sm text-text-secondary font-medium mb-2">
            📂 추가 활동 로그{' '}
            <span className="text-text-faint text-xs font-normal">
              ({selectedLogIds.size}개 선택 · 활동 헤더 체크 = 전체)
            </span>
          </label>
          {actList.length === 0 ? (
            <p className="text-text-faint text-sm">활동이 없어요.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1 border border-line rounded-lg p-2 bg-surface">
              {actList.map((act) => (
                <LogPicker
                  key={act.id}
                  activityId={act.id}
                  activityName={act.name}
                  selectedLogIds={selectedLogIds}
                  onChangeSelected={setSelectedLogIds}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-line">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm text-text-tertiary hover:text-text-primary"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-1.5 text-sm bg-brand hover:bg-brand-hover text-white rounded-md font-medium disabled:opacity-50"
        >
          {isSaving ? '저장 중…' : '저장'}
        </button>
      </div>
    </Modal>
  )
}

function LogPicker({
  activityId,
  activityName,
  selectedLogIds,
  onChangeSelected,
}: {
  activityId: string
  activityName: string
  selectedLogIds: Set<string>
  onChangeSelected: (next: Set<string>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [forceFetch, setForceFetch] = useState(false)
  const { data: logs } = useActivityLogs(
    expanded || forceFetch ? activityId : undefined,
  )
  const checkboxRef = useRef<HTMLInputElement>(null)

  const allLogs = logs ?? []
  const selectedInThis = allLogs.filter((l) => selectedLogIds.has(l.id))
  const selectAll =
    allLogs.length > 0 && selectedInThis.length === allLogs.length
  const partial = selectedInThis.length > 0 && !selectAll

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partial
  }, [partial])

  const handleHeaderToggle = () => {
    if (!logs) {
      setForceFetch(true)
      return
    }
    const next = new Set(selectedLogIds)
    if (selectAll) allLogs.forEach((l) => next.delete(l.id))
    else allLogs.forEach((l) => next.add(l.id))
    onChangeSelected(next)
  }

  useEffect(() => {
    if (forceFetch && logs && logs.length > 0) {
      const next = new Set(selectedLogIds)
      logs.forEach((l) => next.add(l.id))
      onChangeSelected(next)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForceFetch(false)
      setExpanded(true)
    } else if (forceFetch && logs && logs.length === 0) {
      setForceFetch(false)
      setExpanded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceFetch, logs])

  const toggleLog = (logId: string) => {
    const next = new Set(selectedLogIds)
    if (next.has(logId)) next.delete(logId)
    else next.add(logId)
    onChangeSelected(next)
  }

  // suppress unused
  void toast
  return (
    <div>
      <div className="flex items-center gap-2 py-1">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={selectAll}
          onChange={handleHeaderToggle}
          className="accent-brand"
          aria-label={`${activityName} 전체 선택`}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between text-sm text-text-secondary hover:text-text-primary text-left min-w-0"
        >
          <span className="truncate">
            <span className="text-text-faint mr-1">{expanded ? '▾' : '▸'}</span>
            {activityName}
          </span>
          {selectedInThis.length > 0 && (
            <span className="text-brand text-[11px] shrink-0 ml-2">
              {selectedInThis.length}
              {allLogs.length > 0 && `/${allLogs.length}`}
            </span>
          )}
        </button>
      </div>
      {expanded && (
        <div className="pl-6 space-y-1 mt-1">
          {allLogs.length === 0 ? (
            <p className="text-text-faint text-xs">기록 없음</p>
          ) : (
            allLogs.map((log) => (
              <label
                key={log.id}
                className="flex items-start gap-2 text-xs text-text-tertiary hover:text-text-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLogIds.has(log.id)}
                  onChange={() => toggleLog(log.id)}
                  className="accent-brand mt-0.5"
                />
                <span className="line-clamp-2">
                  <span className="text-text-faint mr-1">
                    [{log.occurredAt}]
                  </span>
                  {log.content}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
