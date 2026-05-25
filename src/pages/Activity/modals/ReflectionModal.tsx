import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/stores/toastStore'
import {
  useCreateReflection,
  useReflections,
  useUpdateReflection,
} from '@/hooks/useActivities'
import type { Activity, ActivityLog } from '@/types/activity'
import { CL_LABEL, REFLECTION_PROMPTS, TYPE_TO_CL } from '../constants'
import { getISOWeekMonday, toLocalDateString } from '../utils'

const PROMPT_CHIPS = [
  { cl: 'job_competency', label: '💼 직무역량' },
  { cl: 'collaboration', label: '🤝 협업·갈등' },
  { cl: 'challenge', label: '🚀 도전·실패' },
  { cl: 'background', label: '🌱 성장·가치관' },
  { cl: 'personality', label: '✨ 성격·인성' },
  { cl: 'own_strength', label: '💎 나만의 강점' },
] as const

interface Props {
  open: boolean
  activity: Activity | null
  /** picker 에서 들어왔으면 미리 채울 prompt 텍스트 */
  prefillPrompt?: string | null
  /** 이번주 logs (회상 도우미 표시용) — 부모가 전달 */
  weekLogs?: ActivityLog[]
  /**
   * 대상 주 — 기본값은 오늘 기준 월요일 (이번주).
   * History modal 에서 과거 회고 편집 시 해당 주 weekStart 를 전달.
   */
  weekStart?: string
  onClose: () => void
}

export function ReflectionModal({
  open,
  activity,
  prefillPrompt,
  weekLogs = [],
  weekStart: weekStartProp,
  onClose,
}: Props) {
  const weekStart = weekStartProp ?? getISOWeekMonday()
  const isThisWeek = weekStart === getISOWeekMonday()
  const { data: refls = [] } = useReflections(activity?.id)
  const existing = useMemo(
    () =>
      refls.find(
        (r) =>
          r.activityId === activity?.id && r.weekStart === weekStart,
      ),
    [refls, activity?.id, weekStart],
  )

  const create = useCreateReflection(activity?.id ?? '')
  const update = useUpdateReflection(activity?.id ?? '')

  const [content, setContent] = useState('')
  const [growth, setGrowth] = useState('')
  const [challenge, setChallenge] = useState('')
  const [next, setNext] = useState('')
  const [activeChip, setActiveChip] = useState<string | null>(null)

  // 모달 open 시 초기화
  useEffect(() => {
    if (!open || !activity) return
    let initialContent = existing?.content ?? ''
    if (prefillPrompt && !initialContent.includes(prefillPrompt)) {
      initialContent = initialContent
        ? `${initialContent}\n\n${prefillPrompt}\n`
        : `${prefillPrompt}\n\n`
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync: 모달 open / activity 전환 시 form 다중 필드 초기화
    setContent(initialContent)
    setGrowth((existing?.growth ?? []).join(', '))
    setChallenge((existing?.challenges ?? []).join(', '))
    setNext((existing?.nextActions ?? []).join(', '))
    setActiveChip(null)
  }, [open, activity, existing, prefillPrompt])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open || !activity) return null

  const defaultCats = activity.type ? TYPE_TO_CL[activity.type] : []

  // 회상 도우미 — 이번주 logs 요약 + 지난주 액션 reminder
  const actLogsThisWeek = weekLogs.filter((l) => l.activityId === activity.id)
  const quantInWeek = actLogsThisWeek.filter((l) => l.quant)
  const compsInWeek = new Set<string>()
  actLogsThisWeek.forEach((l) =>
    (l.comps ?? []).forEach((c) => compsInWeek.add(c)),
  )
  const prevDate = new Date(weekStart)
  prevDate.setDate(prevDate.getDate() - 7)
  const prevWeekStart = toLocalDateString(prevDate)
  const prevRefl = refls.find(
    (r) => r.activityId === activity.id && r.weekStart === prevWeekStart,
  )
  const prevActions = (prevRefl?.nextActions ?? []).filter(Boolean)

  function handlePromptClick(cl: string) {
    const pool = REFLECTION_PROMPTS[cl] ?? []
    if (pool.length === 0) return
    // eslint-disable-next-line react-hooks/purity -- click 핸들러 안 — 사용자 액션 결과의 의도된 무작위 선택 (render 중 아님)
    const prompt = pool[Math.floor(Math.random() * pool.length)]
    setContent((c) => {
      const existing = c.trim()
      return existing ? `${existing}\n\n${prompt}\n` : `${prompt}\n\n`
    })
    setActiveChip(cl)
  }

  async function handleSave() {
    if (!activity) return
    const trimmed = content.trim()
    if (!trimmed) {
      toast.error('회고 내용을 입력해 주세요')
      return
    }
    const dto = {
      content: trimmed,
      weekStart,
      growth: growth
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      challenges: challenge
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      nextActions: next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    try {
      if (existing) {
        await update.mutateAsync({ refId: existing.id, dto })
        toast.success('회고가 저장되었어요')
      } else {
        await create.mutateAsync(dto)
        toast.success('회고가 추가되었어요')
      }
      onClose()
    } catch {
      toast.error('저장에 실패했어요')
    }
  }

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="head">
          <div
            className="ic-box"
            style={{
              background: 'rgb(var(--accent)/0.14)',
              color: 'rgb(var(--accent))',
            }}
          >
            ✶
          </div>
          <div style={{ flex: 1 }}>
            <div className="t">
              {activity.name} — {isThisWeek ? '이번주 회고' : '과거 회고 편집'}
            </div>
            <div className="s">{weekStart} 주</div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="refl-context">
            <div className="l">✦ 회상 도우미</div>
            <div className="ctx-row">
              <span className="ctx-label">이번주</span>
              {actLogsThisWeek.length > 0 ? (
                <span className="ctx-val">
                  log {actLogsThisWeek.length}개
                  {quantInWeek.length > 0 && ` · 📊 ${quantInWeek.length}개`}
                  {compsInWeek.size > 0 && ` · 역량 ${compsInWeek.size}축`}
                </span>
              ) : (
                <span className="ctx-empty">
                  아직 log가 없어요 — 회고 전에 1~2 줄 적어보세요
                </span>
              )}
            </div>
            <div className="ctx-row">
              <span className="ctx-label">지난주 액션</span>
              {prevActions.length > 0 ? (
                <span className="ctx-val action">
                  "{prevActions.join(' · ')}" — 했나요?
                </span>
              ) : (
                <span className="ctx-empty">
                  없음 (지난주 회고 없거나 액션 비어있음)
                </span>
              )}
            </div>
          </div>

          <div className="sect">
            <div className="l">
              어떤 측면을 회고할까요?{' '}
              <span className="opt">옵션 · 클릭 시 prompt 채움</span>
            </div>
            <div className="chip-select">
              {PROMPT_CHIPS.map(({ cl, label }) => {
                const isDefault = defaultCats.includes(cl)
                return (
                  <button
                    key={cl}
                    type="button"
                    className={activeChip === cl ? 'selected' : ''}
                    style={
                      isDefault
                        ? { borderColor: 'rgb(var(--brand) / 0.4)' }
                        : undefined
                    }
                    onClick={() => handlePromptClick(cl)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sect">
            <div className="l">
              한 문단 회고 <span className="req">필수</span>
            </div>
            <div className="hlp">
              자유롭게 써도 OK. 자소서·면접에서 풍부한 답변 소재로 자동 활용돼요.
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="이번주에 어떤 일이 있었고, 어떤 점이 가장 기억에 남았나요?"
              style={{ minHeight: 120 }}
            />
          </div>

          <div className="sect">
            <div className="l">
              성장 포인트 <span className="opt">옵션 · 쉼표로 구분</span>
            </div>
            <input
              type="text"
              value={growth}
              onChange={(e) => setGrowth(e.target.value)}
              placeholder="예: 갈등 풀어내기, 코드 품질 향상"
            />
          </div>

          <div className="sect">
            <div className="l">
              어려움 <span className="opt">옵션 · 쉼표로 구분</span>
            </div>
            <input
              type="text"
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="예: 일정 압박, 의사소통"
            />
          </div>

          <div className="sect">
            <div className="l">
              다음주 액션 <span className="opt">옵션 · 쉼표로 구분</span>
            </div>
            <input
              type="text"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="예: 1:1 미팅 하기, 코드리뷰 적극 참여"
            />
          </div>
        </div>
        <div className="foot">
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
  void CL_LABEL
}
