import { useEffect, useRef } from 'react'
import type { CoverletterTag } from '@/types/activity'
import { CL_LABEL } from '../constants'

interface Props {
  open: boolean
  anchorEl: HTMLElement | null
  selected: CoverletterTag[]
  /** + 추가 → 새 카테고리 클릭. 이미 선택된 건 click 안 됨. */
  onAdd: (cat: CoverletterTag) => void
  onClose: () => void
}

const ORDER: CoverletterTag[] = [
  'job_competency',
  'collaboration',
  'challenge',
  'background',
  'personality',
  'own_strength',
]

export function ClPopover({
  open,
  anchorEl,
  selected,
  onAdd,
  onClose,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null)

  // 외부 클릭으로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target)) return
      if (anchorEl?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, anchorEl, onClose])

  // 위치 계산 — anchor 아래쪽, 화면 밖 나가면 보정
  useEffect(() => {
    if (!open || !anchorEl || !popRef.current) return
    const r = anchorEl.getBoundingClientRect()
    const pop = popRef.current
    pop.style.left = `${r.left}px`
    pop.style.top = `${r.bottom + 4}px`
    requestAnimationFrame(() => {
      const popRect = pop.getBoundingClientRect()
      if (popRect.right > window.innerWidth - 8) {
        pop.style.left = `${window.innerWidth - popRect.width - 8}px`
      }
      if (popRect.bottom > window.innerHeight - 8) {
        pop.style.top = `${r.top - popRect.height - 4}px`
      }
    })
  }, [open, anchorEl])

  if (!open) return null

  const used = new Set(selected)

  return (
    <div
      ref={popRef}
      className="cl-popover open"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cp-head">자소서 카테고리 추가</div>
      <div>
        {ORDER.map((key) => {
          const disabled = used.has(key)
          return (
            <div
              key={key}
              className={`cp-item${disabled ? ' disabled' : ''}`}
              onClick={() => {
                if (disabled) return
                onAdd(key)
              }}
            >
              {CL_LABEL[key]}
            </div>
          )
        })}
      </div>
    </div>
  )
}
