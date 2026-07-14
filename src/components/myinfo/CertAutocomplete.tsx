import { useId, useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useCertAutocomplete } from '@/hooks/useSchoolAutocomplete'
import { INPUT_BASE_SM } from '@/utils/inputStyles'
import type { CertSuggestion } from '@/api/schools'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (cert: CertSuggestion) => void
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
}

/**
 * 자격증 자동완성 — 정적 카탈로그 ~235개.
 * dropdown 항목 = name + category chip + issuer subtitle.
 * onSelect → issuer/hasNumber/validYears 등 metadata 전파 (Certs modal 에서 자동 채움).
 */
export function CertAutocomplete({ value, onChange, onSelect, placeholder, disabled, inputClassName }: Props) {
  const isDemo = useDemoMode()
  const inputId = useId()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const { data: items = [], isLoading } = useCertAutocomplete(open ? value : '', open)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function pick(c: CertSuggestion) {
    onChange(c.name)
    onSelect?.(c)
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
        placeholder={placeholder ?? '자격증명 입력...'}
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
          className="absolute left-0 right-0 top-[calc(100%+6px)] bg-surface border border-line-strong rounded-lg shadow-lg max-h-[320px] overflow-y-auto z-20 p-1"
        >
          {isLoading && items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">검색 중...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-text-tertiary">
              {isDemo
                ? '둘러보기에선 자동완성이 꺼져 있어요 — 가입하면 자격증 정보가 자동완성돼요'
                : value.trim() ? '검색 결과가 없어요 · 직접 입력해도 돼요' : '자격증명을 입력해주세요'}
            </div>
          ) : (
            <>
              {items.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  id={`${listId}-item-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => { e.preventDefault(); pick(c) }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    i === activeIdx ? 'bg-brand/[0.10]' : 'hover:bg-card-hover'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-text-primary truncate">{c.name}</span>
                      <CategoryChip category={c.category} />
                    </div>
                    <div className="text-[10px] text-text-tertiary truncate mt-0.5">
                      {c.issuer}
                      {c.validYears && <span className="text-warning ml-1.5">· 유효 {c.validYears}년</span>}
                    </div>
                  </div>
                  {i === activeIdx && (
                    <span className="font-mono text-[10px] text-text-quaternary mt-0.5" aria-hidden="true">↵</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORY_COLOR: Record<string, string> = {
  'IT': 'bg-info/15 text-info',
  '회계·세무': 'bg-success/15 text-success',
  '금융·투자': 'bg-warning/15 text-warning',
  '사무': 'bg-brand/15 text-brand',
  '공기업 준비': 'bg-violet/15 text-violet',
  '기술·엔지니어링': 'bg-danger/15 text-danger',
  '요리·서비스': 'bg-accent/15 text-accent',
  '안전·응급': 'bg-danger/15 text-danger',
  '국가전문': 'bg-brand/15 text-brand',
  '교육': 'bg-info/15 text-info',
  '기타': 'bg-card-strong text-text-tertiary',
}

function CategoryChip({ category }: { category: string }) {
  const cls = CATEGORY_COLOR[category] ?? 'bg-card-strong text-text-tertiary'
  return (
    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-[1px] rounded ${cls}`}>
      {category}
    </span>
  )
}
