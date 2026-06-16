import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/stores/toastStore'
import {
  useCreateActivity,
  useUpdateActivity,
} from '@/hooks/useActivities'
import type {
  Activity,
  ActivityType,
  CreateActivityDto,
} from '@/types/activity'
import {
  NAME_PLACEHOLDERS,
  PAST_QUESTIONS,
  TYPE_GROUPS,
  TYPE_LABELS,
  suggestActivityType,
} from '../constants'
import { todayLocal } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  /** 편집 모드 — undefined 면 add 모드 */
  editing?: Activity | null
  /** 편집 모드의 "삭제" 버튼 클릭 콜백 (부모가 ConfirmModal 처리) */
  onRequestDelete?: () => void
}

type StartMode = 'now' | 'past'

interface PastAnswer {
  q: string
  a: string
}

export function ActivityFormModal({
  open,
  onClose,
  editing,
  onRequestDelete,
}: Props) {
  const isEdit = !!editing
  const [name, setName] = useState('')
  const [type, setType] = useState<ActivityType>('intern')
  const [org, setOrg] = useState('')
  const [role, setRole] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [outcome, setOutcome] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [mode, setMode] = useState<StartMode>('now')
  const [firstLog, setFirstLog] = useState('')
  const [pastAnswers, setPastAnswers] = useState<PastAnswer[]>([])

  const qc = useQueryClient()
  const create = useCreateActivity()
  const update = useUpdateActivity(editing?.id ?? '')

  const suggested = useMemo(() => suggestActivityType(name), [name])
  const typeCfg = TYPE_LABELS[type]

  // 모달 open / editing 변경 시 form 초기화 — 정당한 prop sync
  useEffect(() => {
    if (!open) return
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prop 변경(editing 전환) 시 form 다중 필드 일괄 초기화
      setName(editing.name)
      setType(editing.type ?? 'other')
      setOrg(editing.org ?? '')
      setRole(editing.role ?? '')
      setResultUrl(editing.resultUrl ?? '')
      setOutcome(editing.outcome ?? '')
      setStartedAt(editing.startedAt ?? '')
      setEndedAt(editing.endedAt ?? '')
      setMode('now')
      setFirstLog('')
      setPastAnswers([])
    } else {
      setName('')
      setType('intern')
      setOrg('')
      setRole('')
      setResultUrl('')
      setOutcome('')
      setStartedAt('')
      setEndedAt('')
      setMode('now')
      setFirstLog('')
      setPastAnswers([])
    }
  }, [open, editing])

  // type 변경 시 past 답변 시드 (개수 맞춤)
  useEffect(() => {
    if (mode !== 'past') return
    const qs = PAST_QUESTIONS[type] ?? PAST_QUESTIONS.other
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync: type/mode 변경 시 답변 폼 재시드
    setPastAnswers(qs.map((q) => ({ q, a: '' })))
  }, [type, mode])

  // body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('활동명을 입력해 주세요')
      return
    }

    const dto: CreateActivityDto = {
      name: trimmedName,
      type,
      org: typeCfg.showOrg && org.trim() ? org.trim() : undefined,
      role: typeCfg.showRole && role.trim() ? role.trim() : undefined,
      resultUrl:
        typeCfg.showResultUrl && resultUrl.trim() ? resultUrl.trim() : undefined,
      outcome:
        typeCfg.showOutcome && outcome.trim() ? outcome.trim() : undefined,
      startedAt: startedAt || undefined,
      endedAt: endedAt || undefined,
    }

    try {
      if (isEdit && editing) {
        await update.mutateAsync(dto)
        toast.success('활동이 수정되었어요')
      } else {
        const saved = await create.mutateAsync(dto)
        // 첫 기록 / past 답변 → log 들 순차 생성 (best-effort)
        const todayDate = todayLocal()
        const startDate = dto.startedAt ?? todayDate
        let createdLogCount = 0
        if (mode === 'now' && firstLog.trim()) {
          const ok = await createOneLog(saved.id, firstLog.trim(), todayDate)
          if (ok) createdLogCount += 1
        }
        if (mode === 'past') {
          const filled = pastAnswers.filter((p) => p.a.trim().length > 0)
          for (const p of filled) {
            const ok = await createOneLog(saved.id, p.a.trim(), startDate)
            if (ok) createdLogCount += 1
          }
        }
        // 추가 로그가 있었으면 카드 리스트 강제 refetch
        if (createdLogCount > 0) {
          qc.invalidateQueries({ queryKey: ['activities'], refetchType: 'all' })
        }
        if (mode === 'past' && createdLogCount > 0) {
          toast.success(`활동 추가됨 + 기록 ${createdLogCount}개 일괄 저장`)
        } else {
          toast.success('활동이 추가되었어요')
        }
      }
      onClose()
    } catch {
      toast.error(isEdit ? '수정에 실패했어요' : '저장에 실패했어요')
    }
  }

  /**
   * 동적 activityId 에 log 생성. useCreateLog 훅은 컴포넌트 마운트 시 activityId 가
   * 고정되므로 사용 불가 — raw API 직접 호출 + 마지막에 한 번 invalidate.
   */
  async function createOneLog(
    activityId: string,
    content: string,
    date: string,
  ): Promise<boolean> {
    const { activityApi } = await import('@/api/activity')
    try {
      await activityApi.createLog(activityId, {
        content,
        occurredAt: date,
      })
      return true
    } catch {
      return false
    }
  }

  return (
    <div
      className="overlay open"
      id="act-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="head">
          <div className="ic-box">+</div>
          <div style={{ flex: 1 }}>
            <div className="t">{isEdit ? '활동 편집' : '새 활동 시작'}</div>
            <div className="s">
              {isEdit
                ? '활동 정보를 수정해요'
                : '진행 중인 인턴·동아리·프로젝트를 등록하세요'}
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="sect">
            <div className="l">
              {typeCfg.name} <span className="req">필수</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={NAME_PLACEHOLDERS[type]}
            />
            <div className="hlp name-hint">
              💡 더 구체적으로 적으면 검색·자소서 매칭 정확도가 올라가요
            </div>
          </div>

          <div className="sect">
            <div className="l">
              분류 <span className="req">필수</span>
            </div>
            <div className="hlp">
              선택한 분류에 따라 폼·자소서 매핑이 자동 추천돼요.
            </div>
            <div className="type-grid">
              {TYPE_GROUPS.map((g) => (
                <div className="type-group" key={g.gl}>
                  <div className="gl">{g.gl}</div>
                  <div className="type-chip-row">
                    {g.types.map((t) => {
                      const selected = type === t.v
                      const isSuggested = !selected && suggested === t.v
                      return (
                        <button
                          key={t.v}
                          type="button"
                          className={`type-chip${
                            selected ? ' selected' : ''
                          }${isSuggested ? ' suggested' : ''}`}
                          onClick={() => setType(t.v)}
                        >
                          <span className="em">{t.em}</span>
                          <span>{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {suggested && suggested !== type && (
              <div className="type-suggest-hint show">
                ✦ 활동명에서 자동 추측 — 맞으면 클릭해 확인, 아니면 다른 분류를
                선택하세요
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <div className="sect">
              <div className="l">
                시작 <span className="opt">옵션</span>
              </div>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="sect">
              <div className="l">
                종료 <span className="opt">옵션</span>
              </div>
              <input
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
              <div className="hlp">비워두면 "진행 중"</div>
            </div>
          </div>

          {typeCfg.showOrg && (
            <div className="sect">
              <div className="l">
                {typeCfg.org} <span className="opt">옵션</span>
              </div>
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder={typeCfg.orgPh}
              />
            </div>
          )}

          {typeCfg.showRole && (
            <div className="sect">
              <div className="l">
                {typeCfg.role} <span className="opt">옵션</span>
              </div>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={typeCfg.rolePh}
              />
            </div>
          )}

          {typeCfg.showResultUrl && (
            <div className="sect">
              <div className="l">
                결과물 URL <span className="opt">옵션</span>
              </div>
              <div className="hlp">자소서·이력서·포트폴리오에서 그대로 인용돼요</div>
              <input
                type="text"
                value={resultUrl}
                onChange={(e) => setResultUrl(e.target.value)}
                placeholder="예: github.com/myproj · behance.net/yourwork · notion.so/포트폴리오"
              />
            </div>
          )}

          {typeCfg.showOutcome && (
            <div className="sect">
              <div className="l">
                {typeCfg.outcomeLabel ?? '결과 · 성과'}{' '}
                <span className="opt">옵션</span>
              </div>
              <input
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                maxLength={100}
                placeholder={typeCfg.outcomePh ?? '예: 우수상'}
              />
            </div>
          )}

          {!isEdit && (
            <>
              <div className="sect">
                <div className="l">언제 시작됐나요?</div>
                <div className="mode-toggle">
                  <button
                    type="button"
                    aria-pressed={mode === 'now'}
                    onClick={() => setMode('now')}
                  >
                    <span className="emoji">🌱</span>
                    <span className="lbl">지금부터 시작</span>
                    <span className="sub">매일 1줄씩 기록</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === 'past'}
                    onClick={() => setMode('past')}
                  >
                    <span className="emoji">📚</span>
                    <span className="lbl">이미 진행 중·완료</span>
                    <span className="sub">한 번에 정리</span>
                  </button>
                </div>
              </div>

              {mode === 'now' && (
                <div className="sect">
                  <div className="l">
                    ✶ 오늘의 첫 기록 <span className="opt">옵션</span>
                  </div>
                  <div className="hlp">
                    활동을 만들면서 첫 기록도 함께 남겨보세요. 비워두고 나중에
                    적어도 OK.
                  </div>
                  <textarea
                    value={firstLog}
                    onChange={(e) => setFirstLog(e.target.value)}
                    placeholder="예: 오리엔테이션 참가, 사수와 인사"
                    style={{ minHeight: 60 }}
                  />
                </div>
              )}

              {mode === 'past' && (
                <div className="sect">
                  <div className="l">
                    ✶ 지난 활동을 돌아보며 <span className="opt">옵션</span>
                  </div>
                  <div className="hlp">
                    한 줄로 답해주세요. <strong>3~5개만 채워도 충분</strong>해요.
                    답한 것은 각자 별도 기록으로 저장됩니다.
                  </div>
                  <div className="past-q-list">
                    {pastAnswers.map((p, idx) => (
                      <div
                        key={idx}
                        className={`past-q-item${p.a.trim() ? ' filled' : ''}`}
                      >
                        <div className="pq-q">
                          <span className="pq-num">{idx + 1}</span>
                          <span>{p.q}</span>
                        </div>
                        <input
                          type="text"
                          value={p.a}
                          onChange={(e) => {
                            const next = [...pastAnswers]
                            next[idx] = { ...next[idx], a: e.target.value }
                            setPastAnswers(next)
                          }}
                          placeholder="한 줄로 답해주세요 (비워두면 저장 안 됨)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="foot">
          {isEdit && (
            <button
              type="button"
              className="del"
              onClick={() => onRequestDelete?.()}
            >
              활동 삭제
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="cancel" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="save"
            onClick={handleSave}
            disabled={create.isPending || update.isPending}
          >
            {create.isPending || update.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
