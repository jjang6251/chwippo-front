import { useEffect } from 'react'

export interface ConfirmModalProps {
  open: boolean
  emoji: string
  title: string
  desc: string
  confirmLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
  pending?: boolean
}

export function ConfirmModal({
  open,
  emoji,
  title,
  desc,
  confirmLabel = '삭제',
  danger = true,
  onCancel,
  onConfirm,
  pending = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal confirm-modal">
        <div className="body">
          <div className="em">{emoji}</div>
          <div className="title">{title}</div>
          <div className="desc whitespace-pre-line">{desc}</div>
        </div>
        <div className="foot">
          <button type="button" className="cancel" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={`save${danger ? ' danger' : ''}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
