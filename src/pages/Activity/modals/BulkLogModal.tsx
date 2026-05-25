import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/stores/toastStore'
import { todayLocal, toLocalDateString } from '@/utils/datetime'
import type { Activity } from '@/types/activity'

interface Props {
  open: boolean
  activity: Activity | null
  onClose: () => void
}

type DateMode = 'today' | 'distribute'

export function BulkLogModal({ open, activity, onClose }: Props) {
  const [content, setContent] = useState('')
  const [dateMode, setDateMode] = useState<DateMode>('today')
  const [pending, setPending] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 open 시 폼 초기화 + body scroll lock (외부 DOM 동기화)
      setContent('')
      setDateMode('today')
      setPending(false)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open || !activity) return null

  /** 활동 기간 내 N개 날짜 균등 분산 */
  function distributeDates(n: number): string[] {
    const today = todayLocal()
    const start = activity!.startedAt ?? today
    const end = activity!.endedAt ?? today
    const startD = new Date(start)
    const endD = new Date(end)
    if (endD.getTime() < startD.getTime()) {
      // 시작 > 종료면 일단 today 로 묶기
      return Array(n).fill(today)
    }
    if (n === 1) return [end]
    const span = endD.getTime() - startD.getTime()
    return Array.from({ length: n }, (_, i) => {
      const t = startD.getTime() + Math.round((span * i) / (n - 1))
      return toLocalDateString(new Date(t))
    })
  }

  async function handleSave() {
    const lines = content
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      toast.error('한 줄 이상 입력해 주세요')
      return
    }
    setPending(true)
    const dates =
      dateMode === 'distribute'
        ? distributeDates(lines.length)
        : Array(lines.length).fill(todayLocal())

    let created = 0
    try {
      const { activityApi } = await import('@/api/activity')
      for (let i = 0; i < lines.length; i++) {
        try {
          await activityApi.createLog(activity!.id, {
            content: lines[i],
            occurredAt: dates[i],
          })
          created += 1
        } catch {
          // best-effort; 일부 실패는 사용자가 다시 시도
        }
      }
      if (created > 0) {
        qc.invalidateQueries({ queryKey: ['activities'], refetchType: 'all' })
      }
      if (created === lines.length) {
        toast.success(`기록 ${created}개 추가됨`)
      } else if (created > 0) {
        toast.error(`${created}/${lines.length}개만 저장 — 나머지 재시도`)
      } else {
        toast.error('저장에 실패했어요')
      }
      if (created > 0) onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="head">
          <div
            className="ic-box"
            style={{
              background: 'rgb(var(--accent)/0.14)',
              color: 'rgb(var(--accent))',
            }}
          >
            📚
          </div>
          <div style={{ flex: 1 }}>
            <div className="t">기록 한 번에 정리</div>
            <div className="s">{activity.name}</div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="sect">
            <div className="l">
              ✶ 한 줄에 하나씩 적어주세요 <span className="req">필수</span>
            </div>
            <div className="hlp">
              각 줄이 별도 기록으로 저장됩니다. 카테고리·정량 결과·날짜는
              나중에 기록을 클릭해서 보정하세요.
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`예:\n인턴 OT 참가, 사수 첫 미팅\n신규 캠페인 기획안 채택\nROAS 1.2 → 1.8 개선\n팀 워크샵 발표 담당`}
              style={{ minHeight: 160 }}
              autoFocus
            />
          </div>
          <div className="sect">
            <div className="l">
              📅 날짜 처리 <span className="opt">옵션</span>
            </div>
            <div className="mode-toggle">
              <button
                type="button"
                aria-pressed={dateMode === 'today'}
                onClick={() => setDateMode('today')}
              >
                <span className="emoji">📅</span>
                <span className="lbl">오늘 날짜로 묶기</span>
                <span className="sub">개별 보정은 나중에</span>
              </button>
              <button
                type="button"
                aria-pressed={dateMode === 'distribute'}
                onClick={() => setDateMode('distribute')}
              >
                <span className="emoji">📊</span>
                <span className="lbl">활동 기간 내 분산</span>
                <span className="sub">시작·종료 사이 균등</span>
              </button>
            </div>
            {dateMode === 'distribute' &&
              (!activity.startedAt || !activity.endedAt) && (
                <div className="hlp text-warning mt-1.5">
                  ⚠ 활동 기간(시작·종료) 이 비어있어요 — 오늘로 묶임
                </div>
              )}
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
            disabled={pending}
          >
            {pending ? '추가 중...' : '기록 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
