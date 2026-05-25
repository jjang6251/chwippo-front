import { useEffect } from 'react'
import type { Activity } from '@/types/activity'
import { CL_LABEL, TYPE_KO, TYPE_TO_CL } from '../constants'
import { isActivityOngoing } from '../utils'

interface Props {
  open: boolean
  activities: Activity[]
  prompt: string
  cat: string
  onClose: () => void
  onPickActivity: (activityId: string) => void
}

export function ReflectionPickerModal({
  open,
  activities,
  prompt,
  cat,
  onClose,
  onPickActivity,
}: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  // 진행 중 (ongoing) 활동만 — 완료·보관 제외
  const acts = activities.filter(isActivityOngoing)
  const catLabel = CL_LABEL[cat] ?? ''
  const catEmoji = catLabel.split(' ')[0] || '✶'

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="head">
          <div
            className="ic-box"
            style={{
              background: 'rgb(var(--accent)/0.14)',
              color: 'rgb(var(--accent))',
            }}
          >
            {catEmoji}
          </div>
          <div style={{ flex: 1 }}>
            <div className="t">{prompt}</div>
            <div className="s">{catLabel}</div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="sect">
            <div className="l">어느 활동의 회고를 작성할까요?</div>
            <div className="hlp">
              이 prompt 는 자소서 카테고리 매핑이 일치하는 활동(⭐)에서 더
              효과적이에요
            </div>
            <div className="picker-list">
              {acts.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'rgb(var(--text-tertiary))',
                    fontSize: 12.5,
                  }}
                >
                  진행 중인 활동이 없어요.
                  <br />
                  활동을 시작하면 이번주 회고를 작성할 수 있어요.
                </div>
              ) : (
                acts.map((a) => {
                  const isMatch = a.type
                    ? TYPE_TO_CL[a.type].includes(cat)
                    : false
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onPickActivity(a.id)}
                    >
                      <span
                        className={`type-badge ${a.type ?? 'other'} badge`}
                      >
                        {TYPE_KO[a.type ?? 'other']}
                      </span>
                      <span className="lead">
                        <div className="n">
                          {a.name}
                          {isMatch ? ' ⭐' : ''}
                        </div>
                        <div className="m">
                          {a.role ?? ''}
                          {a.org ? ` · ${a.org}` : ''}
                        </div>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
