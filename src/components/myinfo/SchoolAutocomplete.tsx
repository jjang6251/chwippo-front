import { useId, useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useSchoolAutocomplete } from '@/hooks/useSchoolAutocomplete'
import { INPUT_BASE_SM } from '@/utils/inputStyles'
import type { SchoolKind, SchoolSuggestion } from '@/api/schools'

/**
 * 학교명 자동완성 input + dropdown.
 *
 * - kind=null 시 자동완성 미호출 (학교 단계 미선택), 사용자는 free 입력만 가능
 * - kind 있으면 debounce 250ms 후 GET /schools/autocomplete
 * - dropdown 항목 = 학교명 + 지역 (동명 학교 구분용)
 * - 자유 입력 (검색 결과 X) 도 그대로 onChange (dropdown 미표시)
 */
interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (school: SchoolSuggestion) => void
  /** null 이면 자동완성 비활성 (사용자 typing 만) */
  kind: SchoolKind | null
  placeholder?: string
  disabled?: boolean
  /** override input className (INPUT_BASE_SM 대신) */
  inputClassName?: string
}

export function SchoolAutocomplete({ value, onChange, onSelect, kind, placeholder, disabled, inputClassName }: Props) {
  const inputId = useId()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const { data: items = [], isLoading } = useSchoolAutocomplete(open ? value : '', kind, open)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function pick(s: SchoolSuggestion) {
    onChange(s.name)
    onSelect?.(s)
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!kind) return
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

  const showDropdown = open && kind !== null

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActiveIdx(-1)
          if (!open && kind) setOpen(true)
        }}
        onFocus={(e) => {
          if (kind) setOpen(true)
          // 모바일: dropdown clip 회피 — input 을 스크롤 뷰 안으로
          setTimeout(() => e.currentTarget?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100)
        }}
        onKeyDown={handleKey}
        maxLength={100}
        placeholder={placeholder ?? (kind ? '학교명 입력...' : '학교 단계를 먼저 선택하세요')}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listId}-item-${activeIdx}` : undefined}
        className={inputClassName ?? INPUT_BASE_SM}
      />
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] bg-surface border border-line-strong rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-20 p-1"
        >
          {isLoading && items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">검색 중...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">
              {value.trim() ? '검색 결과가 없어요 · 직접 입력해도 돼요' : '학교명을 입력해주세요'}
            </div>
          ) : (
            <>
              {items.map((s, i) => (
                <Item
                  key={`${s.name}-${s.region}-${i}`}
                  id={`${listId}-item-${i}`}
                  school={s}
                  active={i === activeIdx}
                  onPick={() => pick(s)}
                  onHover={() => setActiveIdx(i)}
                />
              ))}
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line text-[10px] text-text-quaternary font-mono">
                <Kbd>↑</Kbd><Kbd>↓</Kbd><span>선택</span>
                <Kbd>↵</Kbd><span>추가</span>
                <Kbd>esc</Kbd><span>닫기</span>
                <span className="ml-auto">자유 입력도 OK</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  id: string
  school: SchoolSuggestion
  active: boolean
  onPick: () => void
  onHover: () => void
}

function Item({ id, school, active, onPick, onHover }: ItemProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => { e.preventDefault(); onPick() }}
      onMouseEnter={onHover}
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
        active ? 'bg-brand/[0.10]' : 'hover:bg-card-hover'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-text-primary truncate">
          {school.name}
          {school.meta && (
            <span className="ml-1.5 text-[10px] font-mono text-text-quaternary">{school.meta}</span>
          )}
        </div>
        <div className="text-[10px] text-text-tertiary truncate">
          {school.region}
          {school.address && <span className="text-text-quaternary"> · {school.address}</span>}
        </div>
      </div>
      {active && (
        <span className="font-mono text-[10px] text-text-quaternary" aria-hidden="true">↵</span>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-surface-3 border border-line rounded px-1 py-0.5 text-[9px] text-text-secondary">
      {children}
    </kbd>
  )
}
