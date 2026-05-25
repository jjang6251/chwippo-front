import { useEffect } from 'react'
import type { Activity } from '@/types/activity'
import { TYPE_KO } from '../constants'
import { isActivityOngoing } from '../utils'

interface Props {
  open: boolean
  activities: Activity[]
  /** quicklog 의 입력 내용 (헤더에 미리보기) — 빈 문자열이면 명시 선택 모드 */
  content: string
  onPick: (activityId: string) => void
  onClose: () => void
}

export function ActivityPickerModal({
  open,
  activities,
  content,
  onPick,
  onClose,
}: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const acts = activities.filter(isActivityOngoing)

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="head">
          <div className="ic-box">✶</div>
          <div style={{ flex: 1 }}>
            <div className="t">어떤 활동에 추가할까요?</div>
            <div className="s">
              {content ? `"${content}" — 어떤 활동에?` : '활동을 선택하세요'}
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="body">
          <div className="picker-list">
            {acts.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'rgb(var(--text-tertiary))',
                  fontSize: 12.5,
                }}
              >
                진행 중인 활동이 없어요.
                <br />
                활동을 먼저 만들어 주세요.
              </div>
            ) : (
              acts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a.id)}
                >
                  <span className={`type-badge ${a.type ?? 'other'} badge`}>
                    {TYPE_KO[a.type ?? 'other']}
                  </span>
                  <span className="lead">
                    <div className="n">{a.name}</div>
                    <div className="m">
                      {a.role ?? ''}
                      {a.org ? ` · ${a.org}` : ''}
                    </div>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
