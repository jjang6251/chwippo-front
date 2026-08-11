import { useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Lightbulb, Target } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { CompanyResearchCard } from '@/components/card/CompanyResearchCard'
import { JobTitleField } from '@/components/common/JobTitleField'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { useActivities, useActivityLogs } from '@/hooks/useActivities'
import { useApplication } from '@/hooks/useApplications'
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
  /**
   * 이미 생성된 질문 수. **0보다 크면 면접 차수·종류를 잠근다.**
   *
   * 🔴 자료(자소서·로그·공고)와 달리 차수·종류는 세션의 **정체성**이다. 바꾸면 기존 질문이
   * "다른 면접용" 이 돼 헤더(임원·인성)와 내용(기술 질문)이 어긋난다. 자료는 바꿔도 질문이
   * 덜 정확해질 뿐 유효하지만, 이건 아니다.
   * 다른 차수는 **새 세션**으로 만드는 게 맞는 동선이다 (세션은 카드 하위에 여러 개 붙는다).
   */
  questionCount: number
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
 * **저장 후 사용자가 "✨ AI 질문 생성" 으로 새 자료 기반 질문 추가** (지우지 않고 더한다).
 * 백엔드 PATCH /interview-prep-sessions/:id 가 coverletterIds·extraLogIds 변경 처리 (아직 미지원).
 * → Phase 4 단계 5 추가 : 백엔드 UpdateSessionDto 에 coverletterIds·extraLogIds 도 받게 확장 필요.
 */
export function EditInterviewSessionModal({
  session,
  questionCount,
  onClose,
  onSave,
  isSaving,
}: Props) {
  const [interviewType, setInterviewType] = useState<InterviewType | ''>(
    session.interviewType ?? '',
  )
  // 질문이 이미 있으면 차수·종류를 잠근다 (자료와 달리 세션의 정체성이라)
  const identityLocked = questionCount > 0
  const [round, setRound] = useState(session.round)
  // 공고 요건 접힘 — 정리 안 했으면 펼쳐서 CTA 가 바로 보이게
  /**
   * 공고 요건·회사 정보는 **접힌 채로 시작**한다 (2026-08-06).
   * 이 모달의 목적은 **자료를 고치는 것**인데, 둘 다 펼쳐져 있으면 읽을 내용이 화면을
   * 다 먹어서 정작 편집할 입력란(차수·메모·자소서)이 스크롤 아래로 밀린다.
   * 사이드바는 반대로 **읽는 곳**이라 펼침을 유지한다.
   */
  const [jpExpanded, setJpExpanded] = useState(false)
  // v2 — 프롬프트가 읽는데 입력 UI 가 없던 필드. 여기서 처음 편집 가능해진다
  const [sessionMemo, setSessionMemo] = useState(session.myMemo ?? '')
  const [emphasisPoints, setEmphasisPoints] = useState(
    session.emphasisPoints ?? '',
  )
  const [selectedClIds, setSelectedClIds] = useState<Set<string>>(
    new Set(session.coverletterIds),
  )
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(
    new Set(session.extraLogIds),
  )

  const { data: app } = useApplication(session.applicationId)
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
        // 잠겨 있으면 기존 값을 그대로 보낸다 (화면이 disabled 라 바뀔 일이 없지만
        // 상태가 어긋나 저장되는 경로를 아예 만들지 않는다)
        round: identityLocked ? session.round : round.trim() || session.round,
        interviewType: identityLocked
          ? session.interviewType
          : interviewType || null,
        emphasisPoints: emphasisPoints.trim() || null,
        myMemo: sessionMemo.trim() || null,
      },
      {
        coverletterIds: Array.from(selectedClIds),
        extraLogIds: Array.from(selectedLogIds),
      },
    )
  }

  const clList = coverletters ?? []
  // 기본함(미분류) 맨 위 고정 — 퀵캡처 기록도 면접 소재로 첨부 가능
  const actList = [...(activities ?? [])].sort(
    (a, b) => (b.isInbox ? 1 : 0) - (a.isInbox ? 1 : 0),
  )

  return (
    <Modal open onClose={onClose} title="세션 자료" width="max-w-2xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto overscroll-contain pr-1">
        <p className="text-text-tertiary text-xs leading-relaxed bg-info/5 border border-info/20 rounded-lg p-3">
          <span className="inline-flex items-center gap-1">
            <Lightbulb size={14} strokeWidth={1.75} aria-hidden="true" />
            자료를 바꾸고 저장한 뒤
          </span>{' '}
          {/*
            🔴 **"사라집니다" 를 지웠다** (질문 은행 D2b). 생성은 이제 기존 질문·답변을
            지우지 않고 **더한다**(ADR-074 뒤집기). 없어진 위험을 계속 경고하면 사용자는
            자료를 고치고도 생성을 못 누른다 — 답변이 날아갈까 봐.
          */}
          <strong>"✨ AI 질문 생성"</strong> 을 누르면 새 자료 기반 질문이
          더해져요. (기존 질문·내 메모는 그대로 남아요)
        </p>

        {/*
          지원 직무 — **질문 생성의 기준**이라 여기서도 보이고 고쳐져야 한다.
          차수·종류와 달리 잠그지 않는다: 이건 세션의 정체성이 아니라 카드의 속성이고,
          잘못 적힌 걸 발견했을 때 고칠 길을 막으면 세션을 새로 파는 수밖에 없다.
          (이미 만들어진 질문은 그대로다 — 다음 "✨ AI 질문 생성" 부터 반영된다)
        */}
        <section>
          <JobTitleField applicationId={session.applicationId} />
        </section>

        {/* 면접 차수 · 종류 — 질문이 생성됐으면 잠금 (세션의 정체성이라 자료와 다르게 다룬다) */}
        <section className="space-y-3">
          {identityLocked && (
            <p className="text-text-tertiary text-xs leading-relaxed bg-warning/8 border border-warning/25 rounded-lg p-3">
              질문이 이미 만들어져서 <strong>면접 차수·종류는 바꿀 수 없어요.</strong>{' '}
              지금 질문은 <strong>{session.round}</strong>
              {session.interviewType
                ? ` · ${INTERVIEW_TYPE_LABEL[session.interviewType]}`
                : ''}{' '}
              {/*
                🔴 **"다시 생성 후에 바꾸세요" 를 뺐다** (질문 은행 D2b). 그 안내는 재생성이
                질문을 **전부 지우던 시절**의 길이었다 — 0개가 되면 잠금이 풀렸으니까.
                생성이 additive 가 된 지금 아무리 눌러도 질문 수는 늘기만 해서 잠금이
                영원히 안 풀린다. 못 가는 길을 알려주면 사용자는 그 길에서 헤맨다.
              */}
              기준으로 만들어졌거든요. 다른 면접은 <strong>새 세션</strong>으로
              만들어 주세요.
            </p>
          )}

          <div>
            <label
              htmlFor="edit-round"
              className="block text-sm text-text-secondary font-medium mb-2"
            >
              면접 차수
            </label>
            <input
              id="edit-round"
              type="text"
              value={round}
              onChange={(e) => setRound(e.target.value)}
              disabled={identityLocked}
              maxLength={40}
              placeholder="예: 1차 면접 / 임원 면접"
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary font-medium mb-2">
              면접 종류
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={identityLocked}
                  onClick={() =>
                    setInterviewType(
                      interviewType === opt.value ? '' : opt.value,
                    )
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    interviewType === opt.value
                      ? INTERVIEW_TYPE_STYLE[opt.value]
                      : 'bg-surface border-line text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 공고 요건 + 강조 */}
        <section className="space-y-3">
          <h3 className="text-sm text-text-secondary font-medium inline-flex items-center gap-1.5">
            <Target size={15} strokeWidth={1.75} aria-hidden="true" />
            AI 강화 자료
          </h3>
          {/*
            v2 — 새 세션 모달과 같이 공고 요건 정리 UI 로 교체.
            🔴 여기 수동 textarea 를 남겨두면 **효과 없는 칸**이 된다 —
            프롬프트가 `session.jobDescription` 을 더 이상 읽지 않기 때문에
            사용자가 열심히 채워도 질문에 반영되지 않는다.
          */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">
              공고 요건{' '}
              <span className="text-text-faint">
                (있으면 직무 질문이 정확해져요)
              </span>
            </label>
            <JobPostingBanner
              variant="section"
              applicationId={session.applicationId}
              jobPosting={app?.jobPosting}
              jobPostingStatus={app?.jobPostingStatus}
              readOnly={false}
              expanded={jpExpanded}
              onToggle={() => setJpExpanded((v) => !v)}
            />
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
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
            />
            <p className="text-text-faint text-[11px] mt-1 text-right">
              {emphasisPoints.length} / 2000
            </p>
          </div>

          {/*
            v2 — 세션 메모. 🔴 **프롬프트가 읽고 있었는데 입력 UI 가 어디에도 없었다.**
            (`interview-context-builder` 의 `sessionMemo` — "# 면접 준비 메모" 로 주입)
            즉 값이 항상 비어 있는 죽은 경로였다. 여기서 처음 쓸 수 있게 한다.
          */}
          <div>
            <label
              htmlFor="edit-session-memo"
              className="block text-xs text-text-tertiary mb-1.5"
            >
              면접 준비 메모{' '}
              <span className="text-text-faint">(질문 생성에 함께 반영돼요)</span>
            </label>
            <textarea
              id="edit-session-memo"
              value={sessionMemo}
              onChange={(e) => setSessionMemo(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="이번 면접에서 신경 쓰이는 점·준비 방향 등&#10;예) 이직 사유를 어떻게 말할지 정리가 안 됐어요"
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
            />
            <p className="text-text-faint text-[11px] mt-1 text-right">
              {sessionMemo.length} / 5000
            </p>
          </div>
        </section>

        {/*
          v2 — 회사 조사 + 내가 알아본 정보.
          🔴 모바일에서는 사이드바가 없으므로 **이 모달이 자료의 유일한 창구**가 된다.
          사이드바에만 있고 여기 없으면 모바일 사용자는 회사 조사를 볼 방법이 없다.
        */}
        <section>
          <CompanyResearchCard
            sessionId={session.id}
            userNotes={session.userResearchNotes}
            defaultExpanded={false}
          />
        </section>

        {/* 자소서 */}
        <section>
          <label className="block text-sm text-text-secondary font-medium mb-2">
            <span className="inline-flex items-center gap-1">
              <FileText size={15} strokeWidth={1.75} aria-hidden="true" />
              자소서 문항
            </span>{' '}
            <span className="text-text-faint text-xs font-normal">
              ({selectedClIds.size}개 선택)
            </span>
          </label>
          {clList.length === 0 ? (
            <p className="text-text-faint text-sm">자소서 문항이 없어요.</p>
          ) : (
            <div className="max-h-32 overflow-y-auto overscroll-contain space-y-1 border border-line rounded-lg p-2 bg-surface">
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
            <span className="inline-flex items-center gap-1">
              <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" />
              추가 활동 로그
            </span>{' '}
            <span className="text-text-faint text-xs font-normal">
              ({selectedLogIds.size}개 선택 · 활동 헤더 체크 = 전체)
            </span>
          </label>
          {actList.length === 0 ? (
            <p className="text-text-faint text-sm">활동이 없어요.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto overscroll-contain space-y-1 border border-line rounded-lg p-2 bg-surface">
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

  // 쉬어가기(rest) 기록은 면접 소재가 아님
  const allLogs = (logs ?? []).filter((l) => l.cat !== 'rest')
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
