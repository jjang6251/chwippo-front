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

  // 묶음 6 — ESC 취소. 공용 Modal 과 동일 조율 계약: 이미 처리된 ESC 는 양보하고,
  // 처리했으면 스스로 preventDefault (중첩 시 ESC 1번에 1개만 닫히게).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || pending) return
      e.preventDefault()
      onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pending, onCancel])

  if (!open) return null

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
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
