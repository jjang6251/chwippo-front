import { useEffect, useRef, useState } from 'react'
import { toast } from '@/stores/toastStore'
import { useUpdateActivity } from '@/hooks/useActivities'
import type { Activity } from '@/types/activity'

/**
 * 활동 총괄 회고 모달 — 베타 피드백 (2026-06-23).
 *
 * **목적**: 이미 끝난 활동을 한꺼번에 wrap up 하는 큰 문단.
 * 매주 회고 / 한줄 log 와 별도. 한 활동 = 한 summary.
 *
 * **AI 통합**: 활동 선택 시 자소서 prompt 에 통째 inject.
 */
interface Props {
  open: boolean
  activity: Activity | null
  onClose: () => void
}

const MAX_LEN = 5000

export function ActivitySummaryModal({ open, activity, onClose }: Props) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const update = useUpdateActivity(activity?.id ?? '')

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(500, Math.max(200, el.scrollHeight))}px`
  }

  useEffect(() => {
    if (!open || !activity) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync
    setContent(activity.summaryReflection ?? '')
    requestAnimationFrame(autoResize)
  }, [open, activity])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open || !activity) return null

  async function handleSave() {
    if (!activity) return
    const trimmed = content.trim()
    try {
      await update.mutateAsync({
        summaryReflection: trimmed === '' ? null : trimmed,
      })
      toast.success('활동 총괄 회고가 저장되었어요')
      onClose()
    } catch {
      toast.error('저장에 실패했어요')
    }
  }

  const isEdit = !!activity.summaryReflection
  const len = content.trim().length

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="head">
          <div
            className="ic-box"
            style={{
              background: 'rgb(var(--brand)/0.14)',
              color: 'rgb(var(--brand))',
            }}
          >
            📖
          </div>
          <div style={{ flex: 1 }}>
            <div className="t">
              {activity.name} — 활동 총괄 회고 {isEdit && '(수정)'}
            </div>
            <div className="s">
              끝난 활동 wrap up · 자소서·면접 AI 에 통째로 활용
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="sect">
            <div
              className="l"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span>
                통째 회고 <span className="req">필수</span>
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color:
                    len >= 500
                      ? 'rgb(var(--success))'
                      : len > MAX_LEN
                        ? 'rgb(var(--danger))'
                        : 'rgb(var(--text-quaternary))',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {len} / {MAX_LEN}자 (권장 500+)
              </span>
            </div>
            <div className="hlp">
              이미 끝난 활동을 시간순·STAR 없이 자유롭게 wrap up 하세요. 자소서
              작성 시 이 활동을 선택하면 AI 가 통째로 참고해요.
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              maxLength={MAX_LEN}
              onChange={(e) => {
                setContent(e.target.value)
                autoResize()
              }}
              placeholder={`예: 인턴 6개월 동안 어떤 일을 했고, 가장 인상 깊었던 순간은? 가장 어려웠던 갈등은? 무엇을 배웠고, 다음에는 어떻게 다르게 할 것인가? 정량 결과·키워드도 자유롭게 섞어주세요.`}
              style={{
                minHeight: 200,
                maxHeight: 500,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
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
            disabled={update.isPending || len > MAX_LEN}
          >
            {update.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
