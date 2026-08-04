import { useId, useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useCompanyAutocomplete } from '@/hooks/useCompanyAutocomplete'
import { getFaviconUrl } from '@/utils/companyLogo'
import { getAvatarColor } from '@/utils/tags'
import type { AutocompleteCompany } from '@/types/company'

/**
 * W2 — 회사명 자동완성 input + dropdown.
 *
 * 동작:
 *   - 입력 → debounce 250ms 후 GET /companies/autocomplete
 *   - dropdown = DART + 사용자 누적 통합 (source 별 섹션 라벨)
 *   - 키보드 ↑↓ 선택, enter 추가, esc 닫기
 *   - 자유 입력 (검색 결과 X) 도 그대로 onChange/onSelect (사용자 직접 입력 OK)
 *   - 빈 input + signup 직군 = boost 추천 5개
 *
 * ARIA: role=combobox + aria-expanded + aria-controls + aria-activedescendant
 */
interface Props {
  value: string
  onChange: (value: string) => void
  /** dropdown 에서 항목 선택 시 호출 (자유 입력 시엔 onChange 만) — domain·industry 활용 */
  onSelect?: (company: AutocompleteCompany) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
}

export function CompanyAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = '회사명 입력... (예: 네이버, 토스)',
  autoFocus,
  disabled,
}: Props) {
  const inputId = useId()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const { data: items = [], isLoading } = useCompanyAutocomplete(open ? value : '')

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function pick(company: AutocompleteCompany) {
    onChange(company.name)
    onSelect?.(company)
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown') {
        setOpen(true)
        e.preventDefault()
      }
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
        // 자유 입력 — input 그대로 (onChange 이미 호출됨). dropdown 만 닫기
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  // section 분리 (DART vs user_added). signup boost 가 있는 dart 항목은 별도 "추천" 섹션
  const recommended = items.filter((c) => c.source === 'dart' && (c.boost ?? 0) > 0)
  const dart = items.filter((c) => c.source === 'dart' && (c.boost ?? 0) === 0)
  const userAdded = items.filter((c) => c.source === 'user_added')

  let runningIdx = -1

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActiveIdx(-1) // 새 입력 시 키보드 선택 초기화
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        maxLength={100}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listId}-item-${activeIdx}` : undefined}
        className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      />

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] bg-surface border border-line-strong rounded-lg shadow-lg max-h-[380px] overflow-y-auto z-20 p-1"
        >
          {isLoading && items.length === 0 ? (
            <Skeleton />
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-tertiary">
              {value.trim()
                ? '검색 결과가 없어요 · 그대로 직접 추가하셔도 돼요'
                : '회사명을 입력해주세요'}
            </div>
          ) : (
            <>
              {recommended.length > 0 && (
                <>
                  <SectionLabel>맞춤 추천 — 직군 기반</SectionLabel>
                  {recommended.map((c) => {
                    runningIdx++
                    const i = runningIdx
                    return (
                      <Item
                        key={`r-${c.name}`}
                        id={`${listId}-item-${i}`}
                        company={c}
                        active={i === activeIdx}
                        onPick={() => pick(c)}
                        onHover={() => setActiveIdx(i)}
                      />
                    )
                  })}
                </>
              )}
              {dart.length > 0 && (
                <>
                  {/* "DART 상장사" 라벨 X — 평범한 검색 결과는 무라벨 (clean) */}
                  {dart.map((c) => {
                    runningIdx++
                    const i = runningIdx
                    return (
                      <Item
                        key={`d-${c.name}`}
                        id={`${listId}-item-${i}`}
                        company={c}
                        active={i === activeIdx}
                        onPick={() => pick(c)}
                        onHover={() => setActiveIdx(i)}
                      />
                    )
                  })}
                </>
              )}
              {userAdded.length > 0 && (
                <>
                  <SectionLabel>다른 사용자가 추가</SectionLabel>
                  {userAdded.map((c) => {
                    runningIdx++
                    const i = runningIdx
                    return (
                      <Item
                        key={`u-${c.name}`}
                        id={`${listId}-item-${i}`}
                        company={c}
                        active={i === activeIdx}
                        onPick={() => pick(c)}
                        onHover={() => setActiveIdx(i)}
                      />
                    )
                  })}
                </>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-line text-[10px] text-text-quaternary font-mono">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span>선택</span>
                <Kbd>↵</Kbd>
                <span>추가</span>
                <Kbd>esc</Kbd>
                <span>닫기</span>
                <span className="ml-auto">자유 입력도 OK</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] text-text-quaternary font-mono uppercase tracking-wider">
      {children}
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

function Skeleton() {
  return (
    <div className="px-1 py-2 space-y-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-card animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-card rounded animate-pulse" style={{ width: '60%' }} />
            <div className="h-2 bg-card rounded animate-pulse" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

interface ItemProps {
  id: string
  company: AutocompleteCompany
  active: boolean
  onPick: () => void
  onHover: () => void
}

function Item({ id, company, active, onPick, onHover }: ItemProps) {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const faviconUrl = !faviconFailed ? getFaviconUrl(company.domain) : null
  const avatarColor = getAvatarColor(company.name)
  const initial = company.name.slice(0, 1)

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        e.preventDefault() // input blur 방지
        onPick()
      }}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
        active ? 'bg-brand/[0.10]' : 'hover:bg-card-hover'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[13px] flex-shrink-0 overflow-hidden ${
          faviconUrl ? 'bg-surface-3' : avatarColor
        }`}
      >
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="w-full h-full object-contain"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-text-primary truncate">
          {company.name}
          {company.market && (
            <span className="ml-1.5 text-[10px] font-mono text-text-quaternary">
              {company.market}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
          {company.industry && (
            <span className="px-1.5 py-0.5 rounded-full bg-card border border-line">
              {company.industry}
            </span>
          )}
          {/*
            출처 신뢰도. DART 목록에 없는 회사는 사용자들이 직접 친 이름이라
            오타가 그대로 추천에 남는다 (2026-07-28 `로쏘(성심당` 실사례).
            한 명만 넣은 이름은 **검증된 적 없다**는 걸 드러내 사용자가 스스로 거르게 한다.
            accent(coral) 은 합격·pinned 전용이라 여기서 쓰지 않는다 — 오히려 의도와 반대
            신호(가장 눈에 띄는 색 = 가장 덜 검증된 항목)였다.
          */}
          {company.source === 'user_added' &&
            (company.userCount === 1 ? (
              <span className="text-text-quaternary whitespace-nowrap">한 명만 추가했어요</span>
            ) : company.userCount ? (
              <span className="text-text-tertiary whitespace-nowrap">
                <span className="font-mono">{company.userCount}</span>명이 추가
              </span>
            ) : null)}
        </div>
      </div>
      {active && (
        <span className="font-mono text-[10px] text-text-quaternary" aria-hidden="true">
          ↵
        </span>
      )}
    </div>
  )
}
