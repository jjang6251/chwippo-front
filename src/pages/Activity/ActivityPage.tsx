import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from '@/stores/toastStore'
import {
  useActivities,
  useArchiveActivity,
  useArchiveLog,
  useRemoveActivity,
  useRemoveLog,
} from '@/hooks/useActivities'
import type { Activity, CoverletterTag } from '@/types/activity'
import { activityApi } from '@/api/activity'
import { ActivityCard } from './ActivityCard'
import { ActivityFormModal } from './modals/ActivityFormModal'
import { BulkLogModal } from './modals/BulkLogModal'
import { ActivitySummaryModal } from './modals/ActivitySummaryModal'
import { ClPopover } from './modals/ClPopover'
import { ConfirmModal } from './modals/ConfirmModal'
import { LogDetailModal } from './modals/LogDetailModal'
import { ReflectionHistoryModal } from './modals/ReflectionHistoryModal'
import { ReflectionModal } from './modals/ReflectionModal'
import { ReflectionPickerModal } from './modals/ReflectionPickerModal'
import { TYPE_KO } from './constants'
import {
  getISOWeekMonday,
  isThisWeek,
  todayLocal,
  weeklyRotatingPrompt,
} from './utils'
import './activity-mock.css'

type ViewMode = 'ongoing' | 'completed' | 'all' | 'archived'
type SortMode = 'recent' | 'start' | 'name'

export function ActivityPage() {
  const [view, setView] = useState<ViewMode>('ongoing')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortMode>('recent')

  const navigate = useNavigate()
  const qcRef = useQueryClient()
  const { data: activities = [], isLoading } = useActivities(true)
  const archive = useArchiveActivity()
  const removeActivity = useRemoveActivity()

  // Activity form modal (add + edit)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Log detail modal (create + edit)
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [logModalActivityId, setLogModalActivityId] = useState<string>('')
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  // Reflection modal + picker + history
  const [reflModal, setReflModal] = useState<{
    activityId: string
    prefillPrompt: string | null
    weekStart?: string
  } | null>(null)
  const [reflPickerOpen, setReflPickerOpen] = useState(false)
  const [reflHistoryActivityId, setReflHistoryActivityId] = useState<
    string | null
  >(null)
  // Bulk log modal
  const [bulkActivityId, setBulkActivityId] = useState<string | null>(null)
  const [summaryActivityId, setSummaryActivityId] = useState<string | null>(null)
  // Cl popover
  const [clPopover, setClPopover] = useState<{
    logId: string
    anchor: HTMLElement
  } | null>(null)
  // Confirm modal (activity delete + log delete + 409 archive swap)
  const [confirmState, setConfirmState] = useState<
    | { mode: 'delete'; activityId: string }
    | { mode: 'archive-swap'; activityId: string; reason: string }
    | { mode: 'delete-log'; logId: string; activityId: string }
    | { mode: 'archive-log-swap'; logId: string; activityId: string; reason: string }
    | null
  >(null)

  const editing = editingId
    ? activities.find((a) => a.id === editingId) ?? null
    : null

  const editingLog = editingLogId
    ? activities
        .flatMap((a) => a.logs ?? [])
        .find((l) => l.id === editingLogId) ?? null
    : null

  const removeLog = useRemoveLog(
    confirmState?.mode === 'delete-log' ||
      confirmState?.mode === 'archive-log-swap'
      ? confirmState.activityId
      : '',
  )
  const archiveLog = useArchiveLog(
    confirmState?.mode === 'archive-log-swap' ? confirmState.activityId : '',
  )

  const today = todayLocal()
  // activity-redesign — 기본함(inbox)은 관리 서랍 목록에서 제외 (미분류 기록은 타임라인에서)
  const visibleActivities = activities.filter((a) => !a.isInbox)
  const ongoing = visibleActivities.filter(
    (a) => !a.archivedAt && (!a.endedAt || a.endedAt >= today),
  )
  const completed = visibleActivities.filter(
    (a) => !a.archivedAt && a.endedAt && a.endedAt < today,
  )
  const archived = visibleActivities.filter((a) => !!a.archivedAt)

  // 이번주 로그 개수
  const allLogs = activities.flatMap((a) => a.logs ?? [])
  const weekLogs = allLogs.filter((l) => isThisWeek(l.occurredAt))
  // 이번주 회전 prompt — 사용자 cl 분포 기반 부족한 카테고리 우선
  const weekRotPrompt = useMemo(
    () => weeklyRotatingPrompt(getISOWeekMonday(), allLogs),
    [allLogs],
  )

  const filtered = useMemo<Activity[]>(() => {
    let acts: Activity[]
    if (view === 'ongoing') acts = ongoing
    else if (view === 'completed') acts = completed
    else if (view === 'archived') acts = archived
    else acts = [...ongoing, ...completed]

    if (filterType !== 'all') {
      acts = acts.filter((a) => (a.type ?? 'other') === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      acts = acts.filter((a) => {
        const slug = a.type ?? 'other'
        const haystack = [a.name, a.org, a.role, TYPE_KO[slug]]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }
    if (sortBy === 'recent') {
      const recentMap: Record<string, string> = {}
      allLogs.forEach((l) => {
        if (!recentMap[l.activityId] || l.occurredAt > recentMap[l.activityId]) {
          recentMap[l.activityId] = l.occurredAt
        }
      })
      acts = [...acts].sort((a, b) =>
        (recentMap[b.id] ?? '').localeCompare(recentMap[a.id] ?? ''),
      )
    } else if (sortBy === 'start') {
      acts = [...acts].sort((a, b) =>
        (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
      )
    } else if (sortBy === 'name') {
      acts = [...acts].sort((a, b) => a.name.localeCompare(b.name))
    }
    return acts
  }, [activities, view, filterType, searchQuery, sortBy])

  function handleArchive(activityId: string) {
    const target = activities.find((a) => a.id === activityId)
    if (!target) return
    archive.mutate(
      { id: activityId, unarchive: !!target.archivedAt },
      {
        onSuccess: () =>
          toast.success(
            target.archivedAt
              ? `↩ "${target.name}" 복원됨`
              : `📦 "${target.name}" 보관함으로`,
          ),
        onError: () => toast.error('작업 중 오류가 발생했어요'),
      },
    )
  }

  function handleEdit(activityId: string) {
    setEditingId(activityId)
    setFormOpen(true)
  }

  function handleDeleteRequest(activityId: string) {
    setConfirmState({ mode: 'delete', activityId })
  }

  function handleConfirmDelete() {
    if (!confirmState) return
    const id = confirmState.activityId
    const target = activities.find((a) => a.id === id)
    if (!target) return
    removeActivity.mutate(id, {
      onSuccess: () => {
        toast.success(`🗑 "${target.name}" 삭제됨`)
        setConfirmState(null)
      },
      onError: (err) => {
        if (isAxiosError(err) && err.response?.status === 409) {
          const msg =
            (err.response.data as { message?: string } | undefined)?.message ??
            '자소서·면접이 참조 중이에요. 보관함으로 옮기시겠어요?'
          setConfirmState({
            mode: 'archive-swap',
            activityId: id,
            reason: msg,
          })
        } else {
          toast.error('삭제 중 오류가 발생했어요')
          setConfirmState(null)
        }
      },
    })
  }

  function handleArchiveSwap() {
    if (confirmState?.mode !== 'archive-swap') return
    const id = confirmState.activityId
    const target = activities.find((a) => a.id === id)
    if (!target) return
    archive.mutate(
      { id, unarchive: false },
      {
        onSuccess: () => {
          toast.success(`📦 "${target.name}" 보관함으로 이동했어요`)
          setConfirmState(null)
        },
        onError: () => toast.error('이동 중 오류가 발생했어요'),
      },
    )
  }

  function handleAddLog(activityId: string) {
    setLogModalActivityId(activityId)
    setEditingLogId(null)
    setLogModalOpen(true)
  }

  function handleOpenLog(logId: string, activityId: string) {
    // Phase C: 노트 풀스크린 페이지로. 메타 자세히 수정은 NotePage 안 "자세히 수정" 버튼.
    navigate(`/activity/${activityId}/logs/${logId}/note`)
  }

  function handleDeleteLogRequest(logId: string, activityId: string) {
    setConfirmState({ mode: 'delete-log', logId, activityId })
  }

  function handleConfirmDeleteLog() {
    if (confirmState?.mode !== 'delete-log') return
    const { logId, activityId } = confirmState
    removeLog.mutate(logId, {
      onSuccess: () => {
        toast.success('🗑 기록이 삭제되었어요')
        setConfirmState(null)
      },
      onError: (err) => {
        if (isAxiosError(err) && err.response?.status === 409) {
          const msg =
            (err.response.data as { message?: string } | undefined)?.message ??
            '자소서·면접이 참조 중이에요. 기록을 보관할까요?'
          setConfirmState({
            mode: 'archive-log-swap',
            logId,
            activityId,
            reason: msg,
          })
        } else {
          toast.error('삭제 중 오류가 발생했어요')
          setConfirmState(null)
        }
      },
    })
  }

  function handleBulkAdd(activityId: string) {
    setBulkActivityId(activityId)
  }

  function handleSummaryReflect(activityId: string) {
    setSummaryActivityId(activityId)
  }

  function handleOpenClPopover(logId: string, anchor: HTMLElement) {
    setClPopover({ logId, anchor })
  }

  async function updateLogCl(logId: string, nextCl: CoverletterTag[]) {
    try {
      await activityApi.updateLog(logId, { cl: nextCl })
      await qcRef.invalidateQueries({
        queryKey: ['activities'],
        refetchType: 'all',
      })
    } catch {
      toast.error('자소서 매핑 저장 중 오류가 발생했어요')
    }
  }

  async function handleAddCl(cat: CoverletterTag) {
    if (!clPopover) return
    const log = activities
      .flatMap((a) => a.logs ?? [])
      .find((l) => l.id === clPopover.logId)
    if (!log) {
      setClPopover(null)
      return
    }
    const nextCl = [...(log.cl ?? []), cat]
    setClPopover(null)
    await updateLogCl(log.id, nextCl)
  }

  async function handleRemoveCl(logId: string, cat: CoverletterTag) {
    const log = activities.flatMap((a) => a.logs ?? []).find((l) => l.id === logId)
    if (!log) return
    const nextCl = (log.cl ?? []).filter((c) => c !== cat)
    await updateLogCl(log.id, nextCl)
  }

  function handleArchiveLogSwap() {
    if (confirmState?.mode !== 'archive-log-swap') return
    const { logId } = confirmState
    archiveLog.mutate(
      { logId, unarchive: false },
      {
        onSuccess: () => {
          toast.success('📦 기록을 보관함으로 옮겼어요')
          setConfirmState(null)
        },
        onError: () => toast.error('이동 중 오류가 발생했어요'),
      },
    )
  }

  return (
    <div className="aj-content">
      <div id="page-activities">
        <header className="page-head">
          <div className="head-row">
            <h1>
              내 <span className="accent">활동</span>
            </h1>
            <Link to="/activity/insights" className="head-link">
              📊 내 데이터 →
            </Link>
          </div>
          <div className="sub">
            <Link to="/activity" className="hover:underline">← 활동 기록(타임라인)으로</Link>
            {' · '}활동 만들기·수정·총괄 회고는 여기서 관리해요.
          </div>
        </header>

<div className="activities-cards-area">
          {/* 이번주 회고 진입 (축약) — 기록 입구는 타임라인 퀵캡처로 일원화 (2026-07-08) */}
          {weekLogs.length > 0 && (
            <div className="week-summary" style={{ marginBottom: 18 }}>
              <div className="ic">✍</div>
              <div className="meta">
                <div className="lbl">이번주 회고</div>
                <div className="title">{weekRotPrompt.prompt}</div>
              </div>
              <button
                type="button"
                className="cta"
                onClick={() => setReflPickerOpen(true)}
              >
                회고 남기기
              </button>
            </div>
          )}

          <div className="view-toolbar">
            <div className="view-tabs" role="tablist">
              <button
                type="button"
                aria-pressed={view === 'ongoing'}
                onClick={() => setView('ongoing')}
              >
                진행 중 <span className="num">{ongoing.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={view === 'completed'}
                onClick={() => setView('completed')}
              >
                완료 <span className="num">{completed.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={view === 'all'}
                onClick={() => setView('all')}
              >
                전체
              </button>
              <button
                type="button"
                aria-pressed={view === 'archived'}
                onClick={() => setView('archived')}
              >
                📦 보관 <span className="num">{archived.length}</span>
              </button>
            </div>
            <div className="search-box">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="활동 검색 — 이름·회사·키워드"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">모든 분류</option>
              {(Object.keys(TYPE_KO) as Array<keyof typeof TYPE_KO>).map((k) => (
                <option key={k} value={k}>
                  {TYPE_KO[k]}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
            >
              <option value="recent">최근 기록순</option>
              <option value="start">시작일 최근순</option>
              <option value="name">이름순</option>
            </select>
            <button
              type="button"
              className="new-act-cta"
              onClick={() => {
                setEditingId(null)
                setFormOpen(true)
              }}
            >
              + 새 활동
            </button>
          </div>

          <div className="cards" id="cards-container">
            {isLoading ? (
              <div className="aj-empty-state col-span-full py-10 px-[18px] text-center text-text-tertiary text-[13px]">
                활동을 불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className="aj-empty-state col-span-full py-8 px-[18px] text-center text-text-tertiary text-[13px]">
                {searchQuery || filterType !== 'all' ? (
                  <>
                    검색·필터 조건에 맞는 활동이 없어요
                    <br />
                    <button
                      type="button"
                      className="mt-2.5 appearance-none bg-transparent border border-line-strong text-text-secondary px-3.5 py-1.5 rounded-lg text-[11.5px] cursor-pointer font-[inherit]"
                      onClick={() => {
                        setSearchQuery('')
                        setFilterType('all')
                      }}
                    >
                      필터 초기화
                    </button>
                  </>
                ) : view === 'archived' ? (
                  '보관함이 비어있어요'
                ) : view === 'completed' ? (
                  '완료된 활동이 없어요'
                ) : (
                  <>
                    아직 등록된 활동이 없어요
                    <br />
                    <button
                      type="button"
                      className="mt-2.5 appearance-none bg-transparent border border-line-strong text-text-secondary px-3.5 py-1.5 rounded-lg text-[11.5px] cursor-pointer font-[inherit]"
                      onClick={() => {
                        setEditingId(null)
                        setFormOpen(true)
                      }}
                    >
                      + 첫 활동 등록
                    </button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((act) => (
                <ActivityCard
                  key={act.id}
                  act={act}
                  logs={act.logs ?? []}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                  onDelete={handleDeleteRequest}
                  onAddLog={handleAddLog}
                  onBulkAddLog={handleBulkAdd}
                  onSummaryReflect={handleSummaryReflect}
                  onOpenLog={(logId) => handleOpenLog(logId, act.id)}
                  onDeleteLog={(logId) => handleDeleteLogRequest(logId, act.id)}
                  onOpenClPopover={handleOpenClPopover}
                  onRemoveCl={handleRemoveCl}
                  onReflect={(activityId) =>
                    setReflModal({ activityId, prefillPrompt: null })
                  }
                  onReflHistory={(activityId) =>
                    setReflHistoryActivityId(activityId)
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      <ActivityFormModal
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditingId(null)
        }}
        onRequestDelete={() => {
          if (editing) {
            setFormOpen(false)
            setConfirmState({ mode: 'delete', activityId: editing.id })
          }
        }}
      />

      <ConfirmModal
        open={confirmState?.mode === 'delete'}
        emoji="🗑"
        title="활동을 삭제할까요?"
        desc={
          confirmState?.mode === 'delete'
            ? `${
                activities.find((a) => a.id === confirmState.activityId)?.name ??
                '이 활동'
              }과 관련된 모든 기록·회고가 함께 삭제됩니다.\n복구할 수 없어요.`
            : ''
        }
        confirmLabel="삭제"
        danger
        pending={removeActivity.isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        open={confirmState?.mode === 'archive-swap'}
        emoji="📦"
        title="삭제할 수 없어요"
        desc={
          confirmState?.mode === 'archive-swap'
            ? `${confirmState.reason}\n\n보관함으로 이동하시겠어요?`
            : ''
        }
        confirmLabel="보관함으로 이동"
        danger={false}
        pending={archive.isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleArchiveSwap}
      />

      <LogDetailModal
        open={logModalOpen}
        activityId={logModalActivityId}
        editing={editingLog}
        onClose={() => {
          setLogModalOpen(false)
          setEditingLogId(null)
        }}
        onRequestDelete={() => {
          if (editingLog) {
            setLogModalOpen(false)
            setConfirmState({
              mode: 'delete-log',
              logId: editingLog.id,
              activityId: editingLog.activityId,
            })
          }
        }}
      />

      <ConfirmModal
        open={confirmState?.mode === 'delete-log'}
        emoji="🗑"
        title="이 기록을 삭제할까요?"
        desc={(() => {
          if (confirmState?.mode !== 'delete-log') return ''
          const log = activities
            .flatMap((a) => a.logs ?? [])
            .find((l) => l.id === confirmState.logId)
          const preview =
            log?.content && log.content.length > 30
              ? log.content.slice(0, 30) + '…'
              : (log?.content ?? '')
          return `"${preview}"\n복구할 수 없습니다.`
        })()}
        confirmLabel="삭제"
        danger
        pending={removeLog.isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmDeleteLog}
      />

      <ConfirmModal
        open={confirmState?.mode === 'archive-log-swap'}
        emoji="📦"
        title="삭제할 수 없어요"
        desc={
          confirmState?.mode === 'archive-log-swap'
            ? `${confirmState.reason}\n\n기록을 보관함으로 옮길까요?`
            : ''
        }
        confirmLabel="보관함으로 이동"
        danger={false}
        pending={archiveLog.isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleArchiveLogSwap}
      />

      <ReflectionPickerModal
        open={reflPickerOpen}
        activities={activities}
        prompt={weekRotPrompt.prompt}
        cat={weekRotPrompt.cat}
        onClose={() => setReflPickerOpen(false)}
        onPickActivity={(activityId) => {
          setReflPickerOpen(false)
          setReflModal({ activityId, prefillPrompt: weekRotPrompt.prompt })
        }}
      />

      <ReflectionModal
        open={!!reflModal}
        activity={
          reflModal
            ? activities.find((a) => a.id === reflModal.activityId) ?? null
            : null
        }
        prefillPrompt={reflModal?.prefillPrompt ?? null}
        weekStart={reflModal?.weekStart}
        weekLogs={weekLogs}
        onClose={() => setReflModal(null)}
      />

      <BulkLogModal
        open={!!bulkActivityId}
        activity={
          bulkActivityId
            ? activities.find((a) => a.id === bulkActivityId) ?? null
            : null
        }
        onClose={() => setBulkActivityId(null)}
      />

      <ActivitySummaryModal
        open={!!summaryActivityId}
        activity={
          summaryActivityId
            ? activities.find((a) => a.id === summaryActivityId) ?? null
            : null
        }
        onClose={() => setSummaryActivityId(null)}
      />

      <ClPopover
        open={!!clPopover}
        anchorEl={clPopover?.anchor ?? null}
        selected={
          clPopover
            ? activities
                .flatMap((a) => a.logs ?? [])
                .find((l) => l.id === clPopover.logId)?.cl ?? []
            : []
        }
        onAdd={handleAddCl}
        onClose={() => setClPopover(null)}
      />

      <ReflectionHistoryModal
        open={!!reflHistoryActivityId}
        activity={
          reflHistoryActivityId
            ? activities.find((a) => a.id === reflHistoryActivityId) ?? null
            : null
        }
        onClose={() => setReflHistoryActivityId(null)}
        onEditReflection={(refl) => {
          // 과거 회고 편집 진입
          setReflHistoryActivityId(null)
          setReflModal({
            activityId: refl.activityId,
            prefillPrompt: null,
            weekStart: refl.weekStart ?? undefined,
          })
        }}
      />
    </div>
  )
}
