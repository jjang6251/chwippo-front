import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { isAxiosError } from 'axios'
import { useActivities, useActivityTimeline, useQuickCreateLog, useRemoveLog } from '@/hooks/useActivities'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import { useCalendarEvents } from '@/hooks/useCalendar'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { toast } from '@/stores/toastStore'
import type { TimelineLogItem } from '@/types/activity'
import { QuickCapture } from './QuickCapture'
import { ScheduleQuestionCard } from './ScheduleQuestionCard'
import { loadDismissedStepIds, pickScheduleQuestion } from './questionCard'
import { getISOWeekMonday, weeklyRotatingPrompt } from '../utils'
import { ActivityFormModal } from '../modals/ActivityFormModal'
import { LogTagEditor } from './LogTagEditor'
import {
  CAT_KO,
  CL_COLOR,
  CL_LABEL,
  COMP_COLOR,
  COMP_KO,
  MOOD_CHIPS,
  fmtQuant,
  tagColorStyle,
} from '../constants'

/**
 * activity-redesign — 새 활동 기록 기본 화면.
 *
 * 3층 구조의 1·2층: ① 일정 질문 카드(있는 날만) ② 퀵캡처(항상) ③ 날짜 타임라인.
 * 항목 "자세히 쓰기" → 기존 NotePage (3층). 활동 관리·활동별 보기는 /activity/manage.
 * 원칙: 기록 최소 단위 한 줄 · 빈 페이지 대신 질문 · 기록 직후 보상 노출.
 */

function dateHeading(date: string, today: string, yesterday: string): string {
  if (date === today) return `오늘 · ${dayjs(date).format('M월 D일 (dd)')}`
  if (date === yesterday) return `어제 · ${dayjs(date).format('M월 D일 (dd)')}`
  return dayjs(date).format('M월 D일 (dd)')
}

export function ActivityTimelinePage() {
  const isMobile = useIsMobile()
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  const timeline = useActivityTimeline()
  const items = useMemo(
    () => timeline.data?.pages.flatMap((p) => p.items) ?? [],
    [timeline.data],
  )

  const { data: streakData } = useDashboardStreak()
  const streak = streakData?.streak.current ?? 0
  // 이번 주(월~일) 잔디 — 365 heatmap에서 절단
  const weekDays = useMemo(() => {
    const monday = dayjs().startOf('day').subtract((dayjs().day() + 6) % 7, 'day')
    return Array.from({ length: 7 }, (_, i) => {
      const d = monday.add(i, 'day').format('YYYY-MM-DD')
      const hit = streakData?.heatmap.find((h) => h.date === d)
      return { date: d, count: hit?.count ?? 0, isFuture: d > today }
    })
  }, [streakData, today])
  const weekCount = weekDays.filter((d) => d.count > 0).length

  // 일정 질문 — 이번 달 + (월초 경계) 지난달 이벤트
  const now = dayjs()
  const prev = now.subtract(1, 'month')
  const { data: eventsThis = [] } = useCalendarEvents(now.year(), now.month() + 1)
  const { data: eventsPrev = [] } = useCalendarEvents(prev.year(), prev.month() + 1)
  const [questionGone, setQuestionGone] = useState(false)
  const question = useMemo(() => {
    if (questionGone) return null
    const answered = new Set(
      items.filter((i) => i.relatedStepId).map((i) => i.relatedStepId as string),
    )
    return pickScheduleQuestion({
      events: [...eventsPrev, ...eventsThis],
      today,
      yesterday,
      answeredStepIds: answered,
      dismissedStepIds: loadDismissedStepIds(),
    })
  }, [eventsPrev, eventsThis, items, today, yesterday, questionGone])

  // 순환 질문 폴백 — 일정 질문 없는 날, 주 1회 (뭘 쓸지 모름 해소 — 일정 없는 유저용)
  const weekStart = getISOWeekMonday()
  const [weeklyGone, setWeeklyGone] = useState(
    () => localStorage.getItem(`chwippo:weekly-prompt:${getISOWeekMonday()}`) !== null,
  )
  const weeklyPrompt = useMemo(() => {
    if (question || weeklyGone || items.length === 0) return null
    const logsForPrompt = items.map((i) => ({ cl: i.cl }) as never)
    return weeklyRotatingPrompt(weekStart, logsForPrompt)
  }, [question, weeklyGone, items, weekStart])
  const dismissWeekly = () => {
    localStorage.setItem(`chwippo:weekly-prompt:${weekStart}`, '1')
    setWeeklyGone(true)
  }

  // 날짜 그룹
  const groups = useMemo(() => {
    const map = new Map<string, TimelineLogItem[]>()
    for (const item of items) {
      const list = map.get(item.occurredAt)
      if (list) list.push(item)
      else map.set(item.occurredAt, [item])
    }
    return [...map.entries()]
  }, [items])

  const { data: activities = [] } = useActivities()
  const realActivities = activities.filter((a) => !a.isInbox && !a.archivedAt)
  const isEmpty = !timeline.isLoading && items.length === 0

  const mainColumn = (
    <div>
      {question && (
        <ScheduleQuestionCard question={question} onDone={() => setQuestionGone(true)} />
      )}

      {weeklyPrompt && (
        <WeeklyPromptCard
          prompt={weeklyPrompt.prompt}
          cat={weeklyPrompt.cat}
          onDone={dismissWeekly}
        />
      )}

      {isEmpty ? (
        <EmptyFirstQuestion weekCount={weekCount} />
      ) : (
        <>
          <QuickCapture weekCount={weekCount} />

          {timeline.isLoading && <TimelineSkeleton />}

          {timeline.isError && (
            <div className="bg-surface-2 border border-line rounded-xl p-5 text-sm text-text-tertiary">
              기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </div>
          )}

          {groups.map(([date, logs]) => (
            <section key={date} className="mb-5">
              <p className="text-[11px] font-medium text-text-quaternary mb-2">
                {dateHeading(date, today, yesterday)}
              </p>
              <div className="space-y-2">
                {logs.map((log) => (
                  <TimelineRow key={log.id} log={log} />
                ))}
              </div>
            </section>
          ))}

          {timeline.hasNextPage && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => timeline.fetchNextPage()}
                disabled={timeline.isFetchingNextPage}
                className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50 py-2 px-4"
              >
                {timeline.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      {/* 헤더 */}
      <header className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight">활동 기록</h1>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="text-[11px] font-mono text-warning font-semibold">
                {streak === 1 ? '🌱 첫 기록!' : `🔥 ${streak}일째`}
              </span>
            )}
            <Link
              to="/activity/manage"
              className="text-[11px] text-text-tertiary hover:text-text-primary border border-line rounded-md px-2 py-1 transition-colors"
            >
              내 활동 →
            </Link>
          </div>
        </div>
        {/* 주간 잔디 (모바일 헤더 · 데스크탑은 사이드) */}
        {isMobile && (
          <div className="flex items-center gap-1.5">
            {weekDays.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={`flex-1 h-5 rounded ${
                  d.count > 0
                    ? 'bg-brand/70'
                    : d.isFuture
                      ? 'bg-surface-3 opacity-40'
                      : d.date === today
                        ? 'bg-surface-3 ring-1 ring-brand/60'
                        : 'bg-surface-3'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {isMobile ? (
        mainColumn
      ) : (
        <div className="grid grid-cols-[1fr_320px] gap-8">
          {mainColumn}
          <aside className="space-y-3 h-fit sticky top-6">
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-text-primary">이번 주</p>
                {streak > 0 && (
                  <span className="text-[11px] font-mono text-warning font-semibold">
                    {streak === 1 ? '🌱 첫 기록!' : `🔥 ${streak}일째`}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {weekDays.map((d, i) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span
                      title={d.date}
                      className={`w-full h-7 rounded ${
                        d.count > 0
                          ? 'bg-brand/70'
                          : d.isFuture
                            ? 'bg-surface-3 opacity-40'
                            : d.date === today
                              ? 'bg-surface-3 ring-1 ring-brand/60'
                              : 'bg-surface-3'
                      }`}
                    />
                    <span className="text-[9px] text-text-quaternary">
                      {['월', '화', '수', '목', '금', '토', '일'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-4">
              <p className="text-xs font-bold text-text-primary mb-2">내 활동</p>
              {realActivities.length === 0 ? (
                <p className="text-[11px] text-text-quaternary">아직 없어요 — 기록만 해도 돼요</p>
              ) : (
                <div className="space-y-1.5 text-[11px]">
                  {realActivities.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex justify-between text-text-tertiary">
                      <span className="truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                to="/activity/manage"
                className="block mt-3 text-[11px] text-text-quaternary hover:text-text-secondary"
              >
                관리 →
              </Link>
            </div>

            <Link
              to="/activity/insights"
              className="block bg-surface border border-line rounded-2xl p-4 text-[11px] text-text-quaternary hover:text-text-secondary transition-colors"
            >
              인사이트 (강점·자소서 소재) →
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}

/** 타임라인 항목 — 탭하면 노트 상세 (3층 구조) · hover 삭제 (확인 후 hard delete, 참조 시 409 안내)
 *  하단에 자동 태그 칩 상시 표시 + [태그] 로 그 자리에서 간단 보정. rest 는 링크 없음 */
function TimelineRow({ log }: { log: TimelineLogItem }) {
  const isRest = log.cat === 'rest'
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const { mutate: removeLog, isPending: removing } = useRemoveLog('')

  // 확인 모달 ESC 닫기
  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  // 소속 뱃지: 📅 스텝 · 활동
  const badges: Array<{ key: string; node: string; tone: string }> = []
  if (log.companyName && log.stepName)
    badges.push({
      key: 'step',
      node: `📅 ${log.companyName} ${log.stepName}`,
      tone: 'bg-info/10 text-info border-info/20',
    })
  if (!log.activityIsInbox)
    badges.push({
      key: 'act',
      node: log.activityName,
      tone: 'bg-brand/10 text-brand border-brand/20',
    })

  // 자동 태그 칩: 행동분류 · 역량 · 자소서 소재 · 감정 · 정량 · 키워드
  // 역량·자소서 소재는 인사이트 차트와 동일 색 (COMP_COLOR·CL_COLOR — 같은 태그 = 같은 색)
  const tags: Array<{
    key: string
    node: string
    tone: string
    style?: React.CSSProperties
  }> = []
  const mutedTone = 'bg-surface-3 text-text-quaternary border-line'
  if (!isRest) {
    if (log.cat && CAT_KO[log.cat])
      tags.push({
        key: 'cat',
        node: CAT_KO[log.cat],
        tone: 'bg-warning/10 text-warning border-warning/25',
      })
    for (const c of log.comps ?? [])
      tags.push({
        key: `comp-${c}`,
        node: COMP_KO[c] ?? c,
        tone: '',
        style: COMP_COLOR[c] ? tagColorStyle(COMP_COLOR[c]) : undefined,
      })
    for (const tag of log.cl ?? [])
      tags.push({
        key: `cl-${tag}`,
        node: `✨ ${CL_LABEL[tag] ?? tag}`,
        tone: CL_COLOR[tag] ? '' : 'bg-violet/10 text-violet border-violet/20',
        style: CL_COLOR[tag] ? tagColorStyle(CL_COLOR[tag]) : undefined,
      })
    if (log.mood) {
      const m = MOOD_CHIPS.find(([v]) => v === log.mood)
      if (m) tags.push({ key: 'mood', node: `${m[1]} ${m[2]}`, tone: mutedTone })
    }
    if (log.quant)
      tags.push({
        key: 'quant',
        node: `📊 ${fmtQuant(log.quant)}`,
        tone: 'bg-success/10 text-success border-success/25',
      })
    for (const k of log.keywords ?? [])
      tags.push({ key: `kw-${k}`, node: `#${k}`, tone: mutedTone })
  }

  const handleDelete = () => {
    removeLog(log.id, {
      onSuccess: () => {
        toast.success('🗑 기록이 삭제되었어요')
        setConfirmOpen(false)
      },
      onError: (err) => {
        setConfirmOpen(false)
        if (isAxiosError(err) && err.response?.status === 409) {
          const msg = (err.response.data as { message?: string } | undefined)
            ?.message
          toast.error(msg ?? '자소서·면접이 참조 중인 기록이에요.')
        } else {
          toast.error('삭제에 실패했습니다.')
        }
      },
    })
  }

  const rowClass = `block bg-surface-2 border border-line rounded-xl px-3.5 py-3 transition-colors ${isRest ? 'opacity-70' : 'hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'}`
  const rowInner = (
    <>
      <p className="text-[13px] text-text-secondary leading-relaxed pr-6">
        {isRest && <span aria-hidden>🌿 </span>}
        {log.content}
      </p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {badges.map((b) => (
          <span
            key={b.key}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${b.tone}`}
          >
            {b.node}
          </span>
        ))}
        {tags.map((t) => (
          <span
            key={t.key}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${t.tone}`}
            style={t.style}
          >
            {t.node}
          </span>
        ))}
        {!isRest && (
          <button
            aria-label="태그 수정"
            aria-expanded={editingTags}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditingTags((v) => !v)
            }}
            className="text-[10px] px-1.5 py-0.5 rounded-full text-text-quaternary border border-dashed border-line hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {tags.length > 0 ? '태그 ✎' : '+ 태그'}
          </button>
        )}
        {log.hasNote && <span className="text-[10px] text-text-tertiary">📝 노트</span>}
        {!isRest && (
          <span className="text-[10px] text-text-quaternary ml-auto">자세히 쓰기 →</span>
        )}
      </div>
    </>
  )

  return (
    <div className="relative group/row">
    {isRest ? (
      <div className={rowClass}>{rowInner}</div>
    ) : (
      <Link to={`/activity/${log.activityId}/logs/${log.id}/note`} className={rowClass}>
        {rowInner}
      </Link>
    )}

    {/* 인라인 태그 편집 — 기록 상세 안 열고 칩만 보정 (저장 시 invalidate 로 타임라인 갱신) */}
    {editingTags && (
      <LogTagEditor
        logId={log.id}
        cat={log.cat}
        comps={log.comps ?? []}
        cl={log.cl ?? []}
        mood={log.mood}
        keywords={log.keywords ?? []}
        quant={log.quant}
        onClose={() => setEditingTags(false)}
      />
    )}

    {/* hover(데스크탑)·상시(모바일 터치 고려 opacity 60) 삭제 */}
    <button
      aria-label="기록 삭제"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setConfirmOpen(true)
      }}
      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary opacity-40 lg:opacity-0 lg:group-hover/row:opacity-100 hover:text-danger hover:bg-danger/8 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:opacity-100"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l6 6M9 3L3 9" /></svg>
    </button>

    {confirmOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={() => setConfirmOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="기록 삭제 확인"
          className="bg-surface border border-line rounded-xl p-6 w-full max-w-xs shadow-2xl animate-fadeInUp"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-text-primary font-semibold text-sm mb-1">기록을 삭제할까요?</h3>
          <p className="text-text-tertiary text-xs mb-5 line-clamp-2">"{log.content}"</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={removing}
              className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger/80 hover:bg-danger rounded-lg transition-colors disabled:opacity-50"
            >
              {removing ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}

/** 빈 상태 — 첫 질문 + 예시 칩 (N2 시즌 전 온보딩의 입구) */
function EmptyFirstQuestion({ weekCount }: { weekCount: number }) {
  const [content, setContent] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const { mutate: quickCreate, isPending } = useQuickCreateLog()

  const EXAMPLES = ['코테 스터디 문제 풀이', '전공 인강 2강 수강', '사이드 프로젝트 개발']

  const handleSave = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    quickCreate(
      { content: trimmed },
      {
        onSuccess: () => toast.success('첫 기록이에요! 여기부터 쌓여요 🌱'),
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <section className="bg-surface-2 border border-brand/25 rounded-2xl p-5">
      <p className="text-sm font-semibold text-text-primary mb-1">
        요즘 뭐 준비하고 있어요?
      </p>
      <p className="text-[11px] text-text-quaternary leading-relaxed mb-3.5">
        스터디·인강·프로젝트 뭐든 좋아요. 아직 지원 전이어도 지금 쌓는 기록이
        시즌 때 자소서 재료가 돼요.
      </p>
      <div className="flex gap-2 mb-2.5">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave()
          }}
          maxLength={200}
          placeholder="한 줄이면 충분해요"
          aria-label="첫 활동 기록"
          className="flex-1 min-w-0 bg-input border border-line rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60"
        />
        <button
          onClick={handleSave}
          disabled={isPending || !content.trim()}
          className="shrink-0 px-4 rounded-xl bg-brand hover:bg-accent text-sm font-medium text-text-primary transition-colors disabled:opacity-40"
        >
          기록
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setContent(ex)}
            className="text-[11px] px-2 py-1 rounded-full bg-surface-3 text-text-tertiary border border-line hover:text-text-secondary hover:border-brand/40 transition-colors"
          >
            {ex}
          </button>
        ))}
        <button
          onClick={() =>
            quickCreate(
              { isRest: true },
              {
                onSuccess: () => toast.success('오늘은 쉬어가는 날로 기록했어요 🌿'),
                onError: () => toast.error('저장에 실패했습니다.'),
              },
            )
          }
          disabled={isPending}
          className="ml-auto text-[11px] px-2 py-1 rounded-full text-text-quaternary hover:text-text-secondary border border-dashed border-line transition-colors disabled:opacity-40"
        >
          🌿 오늘은 쉬어가요
        </button>
      </div>
      {weekCount === 0 && (
        <p className="text-[10px] text-text-quaternary mt-3">
          쉬는 날도 괜찮아요 — 기록은 습관이 아니라 저금이에요.
        </p>
      )}
      <p className="text-[11px] text-text-quaternary mt-3 pt-3 border-t border-line">
        동아리·인턴·스터디처럼 이어지는 활동은{' '}
        <button
          onClick={() => setCreateOpen(true)}
          className="text-brand hover:underline underline-offset-2"
        >
          + 활동 만들기
        </button>
        로 묶어서 관리할 수 있어요.
      </p>
      <ActivityFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  )
}

/** 순환 질문 카드 — 일정 질문 없는 날의 폴백 (부족한 자소서 카테고리 우선, 주 1회) */
function WeeklyPromptCard({
  prompt,
  cat,
  onDone,
}: {
  prompt: string
  cat: string
  onDone: () => void
}) {
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const { mutate: quickCreate, isPending } = useQuickCreateLog()

  const handleSave = () => {
    const trimmed = answer.trim()
    if (!trimmed) return
    quickCreate(
      { content: trimmed },
      {
        onSuccess: () => {
          toast.success('기록했어요. 성장 페이지에 쌓여요.')
          onDone()
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <section className="mb-2.5">
      <div className="bg-surface-2 border border-line rounded-2xl p-4">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-violet/10 text-violet border border-violet/25 font-medium mb-1.5">
          이번 주 질문 · {CL_LABEL[cat] ?? cat}
        </span>
        <p className="text-[14px] font-semibold text-text-primary leading-snug mb-1">{prompt}</p>
        <p className="text-[11px] text-text-quaternary mb-3">사소한 것도 자소서 소재가 돼요</p>
        {answering ? (
          <>
            <textarea
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={200}
              rows={2}
              aria-label="이번 주 질문 답변"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60 resize-none mb-2.5"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAnswering(false)}
                className="px-3 py-2 text-xs text-text-quaternary hover:text-text-secondary transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !answer.trim()}
                className="flex-1 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
              >
                남기기
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setAnswering(true)}
              className="flex-1 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
            >
              답하기
            </button>
            <button
              onClick={onDone}
              className="px-3 py-2 text-xs text-text-quaternary hover:text-text-secondary transition-colors"
            >
              이번 주는 넘기기
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 bg-surface-2 border border-line rounded-xl animate-pulse" />
      ))}
    </div>
  )
}
