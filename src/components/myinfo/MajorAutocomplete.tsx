import { useId, useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useMajorAutocomplete } from '@/hooks/useSchoolAutocomplete'
import { INPUT_BASE_SM } from '@/utils/inputStyles'

/**
 * 전공 자동완성 input + dropdown.
 * - 학과 표준 list ~266 개. 없으면 사용자 typing 그대로 (free input fallback)
 */
interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
}

export function MajorAutocomplete({ value, onChange, placeholder, disabled, inputClassName }: Props) {
  const inputId = useId()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const { data: items = [], isLoading } = useMajorAutocomplete(open ? value : '', open)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function pick(m: string) {
    onChange(m)
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1 >= items.length ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault()
        pick(items[activeIdx])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActiveIdx(-1)
          if (!open) setOpen(true)
        }}
        onFocus={(e) => {
          setOpen(true)
          setTimeout(() => e.currentTarget?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100)
        }}
        onKeyDown={handleKey}
        maxLength={100}
        placeholder={placeholder ?? '전공 입력...'}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listId}-item-${activeIdx}` : undefined}
        className={inputClassName ?? INPUT_BASE_SM}
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] bg-surface border border-line-strong rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-20 p-1"
        >
          {isLoading && items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">검색 중...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">
              {value.trim() ? '검색 결과가 없어요 · 직접 입력해도 돼요' : '전공을 입력해주세요'}
            </div>
          ) : (
            <>
              {items.map((m, i) => (
                <div
                  key={`${m}-${i}`}
                  id={`${listId}-item-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => { e.preventDefault(); pick(m) }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-[13px] transition-colors ${
                    i === activeIdx ? 'bg-brand/[0.10] text-text-primary' : 'text-text-primary hover:bg-card-hover'
                  }`}
                >
                  {m}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
