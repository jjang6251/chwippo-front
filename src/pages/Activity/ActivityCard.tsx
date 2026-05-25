import { useEffect, useRef, useState } from 'react'
import { toast } from '@/stores/toastStore'
import type { Activity, ActivityLog, CoverletterTag } from '@/types/activity'
import { CAT_KO, CL_KO, CL_LABEL, COMP_KO, MOOD_EM, TYPE_KO } from './constants'
import {
  extractNoteText,
  formatPeriod,
  formatWeekLabel,
  getISOWeekMonday,
  isActivityOngoing,
  isThisWeek,
  logDateLabel,
} from './utils'

interface Props {
  act: Activity
  logs: ActivityLog[]
  /** 카드 클릭 → 로그 상세 (Phase B) */
  onOpenLog?: (logId: string) => void
  /** + 기록 (단일 줄) — Phase B */
  onAddLog?: (activityId: string) => void
  /** + 기록 (여러 줄) — Phase B.4 */
  onBulkAddLog?: (activityId: string) => void
  /** cl 추가 popover 열기 — Phase B.4 */
  onOpenClPopover?: (logId: string, anchor: HTMLElement) => void
  /** cl 카테고리 제거 (✕ 클릭) — Phase B.4 */
  onRemoveCl?: (logId: string, cat: CoverletterTag) => void
  /** 편집 — Phase B */
  onEdit?: (activityId: string) => void
  /** 보관/복원 */
  onArchive?: (activityId: string) => void
  /** 삭제 */
  onDelete?: (activityId: string) => void
  /** 회고 prompt 클릭 → 회고 모달 (Phase B) */
  onReflect?: (activityId: string) => void
  /** 더보기 메뉴 '회고 (N개)' → 회고 히스토리 모달 */
  onReflHistory?: (activityId: string) => void
  /** 로그 단일 삭제 */
  onDeleteLog?: (logId: string) => void
}

export function ActivityCard({
  act,
  logs,
  onOpenLog,
  onAddLog,
  onBulkAddLog,
  onEdit,
  onArchive,
  onDelete,
  onReflect,
  onReflHistory,
  onDeleteLog,
  onOpenClPopover,
  onRemoveCl,
}: Props) {
  const ongoing = isActivityOngoing(act)
  const slug = act.type ?? 'other'
  const actLogs = [...logs].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )
  const thisWeekLogs = actLogs.filter((l) => isThisWeek(l.occurredAt))
  const displayLogs = actLogs.slice(0, 5)

  // 회고 placeholder (Phase B 에서 reflection 데이터 받아오기)
  const headerLabel = ongoing
    ? actLogs.length === 0
      ? '기록 · 0개'
      : `최근 기록 · ${Math.min(5, actLogs.length)}개 표시`
    : `주요 성과 · ${actLogs.length}개`
  const headerSub =
    ongoing && actLogs.length > 0
      ? `(이번주 ${thisWeekLogs.length}개 / 전체 ${actLogs.length}개)`
      : ''

  // 자소서 매핑 카운트 (mock: log.cl 배열 → 빈도 Top 2)
  const clCounts: Record<string, number> = {}
  actLogs.forEach((l) => {
    ;(l.cl ?? []).forEach((c) => {
      clCounts[c] = (clCounts[c] || 0) + 1
    })
  })
  const topCl = Object.entries(clCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!addMenuOpen && !moreMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setAddMenuOpen(false)
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addMenuOpen, moreMenuOpen])

  return (
    <article
      ref={rootRef}
      className={`card ${ongoing ? 'ongoing' : 'completed'}`}
      data-act-id={act.id}
    >
      <div className="card-head">
        <span className={`type-badge ${slug}`}>{TYPE_KO[slug]}</span>
        <span className="status-dot">{ongoing ? '진행 중' : '완료'}</span>
      </div>
      <h3 className="card-title">{act.name}</h3>
      <div className="card-meta">
        {act.org && (
          <>
            <span className="role">{act.org}</span>
            <span className="sep">·</span>
          </>
        )}
        <span className="date">{formatPeriod(act) || '기간 미정'}</span>
      </div>

      <div className="achievements">
        <div className="label">
          <span>
            {headerLabel}
            {headerSub && (
              <span className="font-medium text-text-quaternary"> {headerSub}</span>
            )}
          </span>
          <div className="label-actions">
            <div className="add-dropdown">
              <button
                className="add-mini"
                onClick={(e) => {
                  e.stopPropagation()
                  setMoreMenuOpen(false)
                  setAddMenuOpen((v) => !v)
                }}
                type="button"
              >
                + 기록 ▾
              </button>
              <div className={`add-menu${addMenuOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddMenuOpen(false)
                    if (onAddLog) onAddLog(act.id)
                    else toast.info('Phase B 에서 연결됩니다')
                  }}
                >
                  <span className="ic">✶</span>
                  <span>한 줄</span>
                  <span className="sub">빠른 기록</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddMenuOpen(false)
                    if (onBulkAddLog) onBulkAddLog(act.id)
                  }}
                >
                  <span className="ic">📚</span>
                  <span>여러 줄</span>
                  <span className="sub">한 번에 정리</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <ul>
          {displayLogs.length === 0 ? (
            ongoing ? (
              <div className="empty-cta">
                <span className="ic">✶</span>
                <span className="msg">
                  이 활동의 <em>첫 기록</em>을 남겨보세요
                </span>
                <button
                  className="cta-btn"
                  type="button"
                  onClick={() => {
                    if (onAddLog) onAddLog(act.id)
                    else toast.info('Phase B 에서 연결됩니다')
                  }}
                >
                  + 첫 기록 남기기
                </button>
              </div>
            ) : (
              <div className="empty-state">기록 없이 종료된 활동</div>
            )
          ) : (
            displayLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                onOpen={() => onOpenLog?.(log.id)}
                onDelete={() => onDeleteLog?.(log.id)}
                onOpenClPopover={onOpenClPopover}
                onRemoveCl={onRemoveCl}
              />
            ))
          )}
        </ul>
      </div>

      {ongoing && (() => {
        // 이번주 회고 (해당 활동) 있으면 미리보기 60자, 없으면 prompt
        const thisWeekStart = getISOWeekMonday()
        const refl = (act.reflections ?? []).find(
          (r) => r.weekStart === thisWeekStart,
        )
        const hasContent = !!refl?.content?.trim()
        const totalRefls = (act.reflections ?? []).length
        return (
          <>
            <div
              className={`reflection-week-label flex items-center gap-1.5 pt-1.5 px-1 text-[10.5px] text-text-quaternary tracking-wide ${
                onReflHistory ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (onReflHistory) onReflHistory(act.id)
              }}
              title={
                totalRefls > 0
                  ? `지난 회고 ${totalRefls}개 보기`
                  : '회고 히스토리'
              }
            >
              <span>{formatWeekLabel(thisWeekStart)} 회고</span>
              {totalRefls > 0 && <span className="opacity-70">· 지난 회고 →</span>}
            </div>
            <div
              className={`reflection${hasContent ? ' has-content' : ''}`}
              onClick={() => {
                if (onReflect) onReflect(act.id)
                else toast.info('Phase B 에서 연결됩니다')
              }}
            >
              <span className="text">
                {hasContent
                  ? refl!.content.length > 60
                    ? `${refl!.content.slice(0, 60)}…`
                    : refl!.content
                  : '✶ 이번주 회고를 남겨보세요 — 자소서 답변 소재가 됩니다'}
              </span>
              <span className="arr">→</span>
            </div>
          </>
        )
      })()}

      <div className="card-foot">
        {topCl.map(([cl, n], i) => (
          <span key={cl} className={`usage-chip${i === 1 ? ' coral' : ''}`}>
            <span className="arr">→</span> 자소서 "{CL_KO[cl]}" ({n}건)
          </span>
        ))}
        <div className="actions">
          <div className="more-wrap">
            <button
              className="more-btn"
              type="button"
              title="더보기"
              onClick={(e) => {
                e.stopPropagation()
                setAddMenuOpen(false)
                setMoreMenuOpen((v) => !v)
              }}
            >
              ⋯
            </button>
            <div className={`more-menu${moreMenuOpen ? ' open' : ''}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMoreMenuOpen(false)
                  if (onEdit) onEdit(act.id)
                  else toast.info('Phase B 에서 연결됩니다')
                }}
              >
                <span className="ic">✎</span> 편집
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMoreMenuOpen(false)
                  onArchive?.(act.id)
                }}
              >
                <span className="ic">{act.archivedAt ? '↩' : '📦'}</span>{' '}
                {act.archivedAt ? '복원' : '보관함으로'}
              </button>
              <button
                type="button"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation()
                  setMoreMenuOpen(false)
                  onDelete?.(act.id)
                }}
              >
                <span className="ic">🗑</span> 삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function LogRow({
  log,
  onOpen,
  onDelete,
  onOpenClPopover,
  onRemoveCl,
}: {
  log: ActivityLog
  onOpen: () => void
  onDelete: () => void
  onOpenClPopover?: (logId: string, anchor: HTMLElement) => void
  onRemoveCl?: (logId: string, cat: CoverletterTag) => void
}) {
  const cat = log.cat || 'other'
  const noteText = extractNoteText(log.note)
  const compChips = (log.comps ?? []).slice(0, 2)
  const moodEmoji = log.mood ? MOOD_EM[log.mood] : ''
  return (
    <li
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (
          t.closest('.row-del-btn') ||
          t.closest('.cl-badge-edit') ||
          t.closest('.cl-badge-add')
        )
          return
        onOpen()
      }}
      data-log-id={log.id}
    >
      <span className={`cat-dot ${cat}`} title={CAT_KO[cat] ?? cat} />
      <span className="row-body">
        <span className="row-text">{log.content}</span>
        {noteText ? (
          <span className="row-note-preview">
            {noteText.slice(0, 80)}
            {noteText.length > 80 ? '…' : ''}
          </span>
        ) : (
          <span className="row-note-hint">
            📝 자세히 적으면 자소서·면접 품질↑
          </span>
        )}
        <span className="row-tags">
          {log.quant && <QuantPill quant={log.quant} />}
          {compChips.map((c) => (
            <span key={c} className="comp-chip">
              {COMP_KO[c] || c}
            </span>
          ))}
          {/* cl 배지 — 자소서 매핑. 클릭하면 ✕ 로 제거 */}
          {(log.cl ?? []).map((c) => (
            <span key={c} className="cl-badge-edit">
              <span>{CL_LABEL[c] ?? c}</span>
              <button
                className="rm"
                type="button"
                title="제거"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveCl?.(log.id, c)
                }}
              >
                ✕
              </button>
            </span>
          ))}
          {/* + 추가 — popover 열기 (cl 6종 전부 들어있으면 숨김) */}
          {(log.cl?.length ?? 0) < 6 && (
            <button
              className="cl-badge-add"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenClPopover?.(log.id, e.currentTarget)
              }}
            >
              + 추가
            </button>
          )}
        </span>
      </span>
      {moodEmoji && <span className="mood-mini">{moodEmoji}</span>}
      <span className="time">{logDateLabel(log)}</span>
      <button
        className="row-del-btn"
        type="button"
        title="삭제"
        aria-label="이 기록 삭제"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        ✕
      </button>
    </li>
  )
}

function QuantPill({ quant }: { quant: NonNullable<ActivityLog['quant']> }) {
  if (quant.type === 'before-after') {
    return (
      <span className="quant-pill">
        {quant.before} → {quant.after}
        {quant.unit ? ` ${quant.unit}` : ''}
      </span>
    )
  }
  if (quant.type === 'count') {
    return (
      <span className="quant-pill">
        {quant.value}
        {quant.unit}
      </span>
    )
  }
  return <span className="quant-pill">{quant.raw}</span>
}
