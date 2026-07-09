import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useActivities, useQuickCreateLog } from '@/hooks/useActivities'
import { ActivityFormModal } from '../modals/ActivityFormModal'
import { toast } from '@/stores/toastStore'
import type { ActivityLog } from '@/types/activity'

/**
 * activity-redesign — 한 줄 퀵캡처 (항상 있는 기본 입구).
 * - 활동 선택은 선택사항 칩 (미선택 → 백엔드가 기본함으로)
 * - 날짜 토글 [오늘|어제] — 몰아 쓰는 습관 대응 (occurredAt)
 * - 🌿 쉬어가기 = isRest (같은 날 멱등 — 서버 보장)
 * - 저장 직후 보상 라인: 인사이트 링크 + 6초 후 자동 소멸
 */
interface QuickCaptureProps {
  /** 이번 주 기록 일수 (보상 라인 "이번 주 N일째") */
  weekCount: number
}

const REWARD_VISIBLE_MS = 6000

export function QuickCapture({ weekCount }: QuickCaptureProps) {
  const [content, setContent] = useState('')
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const [lastSaved, setLastSaved] = useState<ActivityLog | null>(null)
  // 활동 생성 발견성 — "동아리·인턴은 어디서?" (기록 입구 안에서 바로 생성)
  const [createOpen, setCreateOpen] = useState(false)
  const { data: activities = [] } = useActivities()
  const { mutate: quickCreate, isPending } = useQuickCreateLog()

  // 보상 라인 자동 소멸
  useEffect(() => {
    if (!lastSaved) return
    const id = setTimeout(() => setLastSaved(null), REWARD_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [lastSaved])

  const chips = activities
    .filter((a) => !a.isInbox && !a.archivedAt)
    .slice(0, 4)

  const handleSave = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    quickCreate(
      {
        content: trimmed,
        activityId: selectedActivityId ?? undefined,
        occurredAt:
          day === 'yesterday'
            ? dayjs().subtract(1, 'day').format('YYYY-MM-DD')
            : undefined,
      },
      {
        onSuccess: (log) => {
          setContent('')
          setSelectedActivityId(null)
          setDay('today')
          setLastSaved(log)
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleRest = () => {
    quickCreate(
      { isRest: true },
      {
        onSuccess: () => toast.success('오늘은 쉬어가는 날로 기록했어요 🌿'),
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <section className="mb-6">
      <div className="bg-surface-2 border border-line rounded-2xl p-3.5">
        <div className="flex gap-2 mb-2.5">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave()
            }}
            maxLength={200}
            placeholder={day === 'today' ? '오늘 뭐 했어요? 한 줄이면 충분해요' : '어제 뭐 했어요?'}
            aria-label="활동 한 줄 기록"
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
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 날짜 토글 — 몰아 기록 대응 */}
          <div className="flex rounded-full border border-line overflow-hidden mr-0.5">
            {(['today', 'yesterday'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`text-[11px] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                  day === d
                    ? 'bg-brand/12 text-brand font-medium'
                    : 'text-text-quaternary hover:text-text-secondary'
                }`}
              >
                {d === 'today' ? '오늘' : '어제'}
              </button>
            ))}
          </div>
          {chips.map((a) => {
            const active = selectedActivityId === a.id
            return (
              <button
                key={a.id}
                onClick={() => setSelectedActivityId(active ? null : a.id)}
                aria-pressed={active}
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                  active
                    ? 'bg-brand/12 text-brand border-brand/30 font-medium'
                    : 'bg-surface-3 text-text-tertiary border-line hover:text-text-secondary'
                }`}
              >
                {a.name}
              </button>
            )
          })}
          <button
            onClick={() => setCreateOpen(true)}
            className="text-[11px] px-2 py-1 rounded-full text-text-tertiary border border-dashed border-line hover:text-text-secondary hover:border-brand/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            title="동아리·인턴·스터디처럼 이어지는 활동을 만들어 기록을 묶을 수 있어요"
          >
            + 새 활동
          </button>
          <button
            onClick={handleRest}
            disabled={isPending}
            className="ml-auto text-[11px] px-2 py-1 rounded-full text-text-quaternary hover:text-text-secondary border border-dashed border-line transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            title="쉬는 것도 기록이에요 — 잔디가 끊기지 않아요"
          >
            🌿 오늘은 쉬어가요
          </button>
        </div>
      </div>

      {/* 저장 직후 보상 — 어디에 쌓였는지 (6초 후 자동 소멸). 태그 표시·수정은 타임라인 항목에서 */}
      {lastSaved && lastSaved.cat !== 'rest' && (
        <Link
          to="/activity/insights"
          className="mt-2 flex items-center gap-2 bg-success/8 border border-success/20 rounded-lg px-3 py-2 hover:bg-success/12 transition-colors"
        >
          <span className="text-xs" aria-hidden>✓</span>
          <p className="text-[11px] text-text-secondary flex-1">
            기록 완료
            {(lastSaved.cl?.length ?? 0) > 0 && (
              <> — <span className="text-success">✨ 자소서 소재로 저장</span></>
            )}
            {weekCount > 0 && <> · 이번 주 {weekCount}일째</>}
          </p>
          <span className="text-[10px] text-text-quaternary shrink-0">인사이트에 쌓여요 →</span>
        </Link>
      )}
      <ActivityFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  )
}
