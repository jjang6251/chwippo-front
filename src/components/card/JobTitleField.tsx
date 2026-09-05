import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  JOB_SERIES,
  classifyJob,
  suggestJobs,
  type JobMatch,
  type JobSuggestion,
} from '@/utils/jobRole'

/**
 * 「지원 직무」 입력 — **2겹 UI** (`plans/job-role-first.md` 묶음 2).
 *
 * ```
 * "간호" 타이핑 → ① 사전 드롭다운 (간호사·간호조무사…)  ← 타이핑을 줄인다
 *              → ② 계열 판정 행 [의료·보건·복지 ✓]      ← 무엇으로 읽혔는지 보여준다
 * ```
 *
 * ## 왜 두 겹인가
 *
 * 예전엔 21개 직군 칩을 스크롤해서 고르게 했다. 칩 목록은 **원리적으로 전 직군을 못 덮고**
 * (간호사·지상직·9급이 들어갈 칸이 없다), 프리셋 자동 선택이 데이터를 오염시켰다.
 * 이제 **사용자가 적은 원문이 1급 정보**고, 계열은 거기서 파생한다 — 파생에 실패해도
 * 원문은 그대로 저장된다.
 *
 * ## 계약
 *
 * - `onChange(value, source)` — `source` 는 **관측용**이다. 드롭다운을 탭했으면 `'suggestion'`,
 *   손으로 쳤으면 `'typed'`. 「확정」과 「수용」을 통계에서 가르는 값이라 뭉개지 않는다.
 * - `onSeriesChange(seriesId, manual)` — 자동 추론이면 `manual=false`, 사용자가 고르면 `true`.
 *   🔴 **수동 선택은 사용자가 「자동으로」로 풀기 전까지 추론을 이긴다.** 사람이 한 번 고른 걸
 *   타이핑 한 글자마다 되돌리면 고른 의미가 없다.
 * - `fallbackSeriesLabel` — 🔴 **표시 전용 힌트**다. 이 값으로는 `onSeriesChange` 를 부르지
 *   않는다 (빌려온 값이 저장으로 승격되면 그게 예전 프리셋 오염과 같은 사고다).
 */
interface JobTitleFieldProps {
  value: string
  onChange: (value: string, source: 'typed' | 'suggestion') => void
  /** 현재 확정된 계열 id (부모 소유) — 14계열 그리드의 선택 강조에 쓴다 */
  seriesId: string | null
  onSeriesChange: (seriesId: string | null, manual: boolean) => void
  /** 빈 입력일 때만 보이는 추정 힌트 — 🔴 저장되지 않는다 */
  fallbackSeriesLabel?: string
  /**
   * 🔴 **`seriesId` 가 이미 저장된 사용자 값이라는 선언.** 기본 `false` = 현행 그대로.
   *
   * 카드 모달들에서 `seriesId` 는 **작성 중인 카드의 임시 상태**다 — 직무를 지우면 계열도
   * 같이 지워지는 게 맞다(안 그러면 직무 없는 카드에 「의료·보건·복지」가 저장되고,
   * `resolveJobText` 가 그 라벨을 직무로 읽어 AI 가 계열 이름으로 자소서를 쓴다).
   *
   * 내 정보의 희망 직무 칸은 반대다 — 거기 `seriesId` 는 **온보딩에서 사람이 고른 값**이라,
   * 직무 칸을 비우거나 사전이 못 알아듣는 말을 쳤다고 해서 지워지면 그건 데이터 손실이다.
   * 「이 칸 비움」과 「계열 취소」는 다른 말이다.
   *
   * 그래서 켜면 두 가지가 바뀐다:
   * 1. **판정이 없을 때(`null`) 부모에 알리지 않는다** — 빈 판정으로 저장값을 덮지 않는다
   * 2. 판정이 없으면 계열 행에 **`seriesId` 의 실제 라벨**을 칩으로 그린다
   *    (`fallbackSeriesLabel` 의 「(추정)」과 다르다 — 저건 빌려온 값, 이건 본인 값)
   *
   * 즉 이 모드에서 부모가 받는 계열은 **언제나 실제 계열**이고 `null` 이 오지 않는다.
   */
  seriesIsSaved?: boolean
  autoFocus?: boolean
  id?: string
  /**
   * 입력 껍데기. 🔴 기본값 `'box'` = **현행 그대로** (라벨 「지원 직무」 + 채움 박스).
   *
   * `'underline'` 은 카드 추가·지원 시작 모달의 A안 결 — 캡션 라벨 「직무」 + 밑줄 + 17px.
   * `'field'` 는 내 정보 창고의 공용 `Field` 톤(h-12 · rounded-xl) — 같은 카드의 다른 칸과
   * 높이가 어긋나면 어느 쪽이 「정상」인지 사용자가 매번 다시 읽는다.
   * 드롭다운·계열 판정 행·helper 는 세 variant 가 **완전히 같다** (모양만 바뀐다).
   */
  variant?: 'box' | 'underline' | 'field'
  /**
   * 계열 판정 행(② 겹)을 숨긴다. 기본 `false` = **현행 그대로**.
   *
   * 🔴 온보딩 전용이다 — 거기엔 **14계열 그리드가 이미 화면에 있고** 타이핑하면 그
   * 그리드의 선택이 실시간으로 옮겨간다. 그 상태에서 입력창 밑에 또 「의료·보건·복지 ✓
   * · 다르게 고르기」가 뜨면 **같은 정보가 두 군데**에 있고, 「다르게 고르기」를 누르면
   * 계열 pill 이 **두 벌**(내부 14 + 그리드 14) 깔린다.
   *
   * 판정 자체는 그대로 돈다 — `onSeriesChange` 는 변함없이 부모에 간다. 화면에서만 뺀다.
   *
   * 🔴 아래 helper(「자소서·면접 AI 가 이 직무 기준으로…」)도 **같이** 빠진다. 가입 직후엔
   * 자소서·면접에 도달한 사람이 없어 그 문장이 설명이 아니라 소음이고, 바로 밑에
   * 보상 카드가 붙는 자리라 한 줄이 통째로 낭비된다.
   */
  hideSeriesRow?: boolean
  /**
   * 라벨 문구 덮어쓰기 (기본 = variant 별 기본값). 온보딩의 「직무 (선택)」처럼 맥락이 다를 때만.
   * 노드를 받는 건 필수 표시(`지원 직무 *`)처럼 라벨 안에 색이 들어가는 자리 때문이다.
   */
  labelText?: React.ReactNode
  /** placeholder 덮어쓰기 (기본 = variant 별 기본값) */
  placeholder?: string
  /**
   * 입력이 포커스를 잃을 때. 🔴 **필드 단위 자동 저장을 쓰는 화면 전용**이다
   * (내 정보 › 희망 직무). 모달들은 제출 버튼이 저장 지점이라 안 쓴다.
   *
   * 추천 목록 클릭은 `onMouseDown` 에서 preventDefault 하므로 여기로 새지 않는다 —
   * 고르는 도중에 저장이 먼저 터지지 않는다.
   */
  onBlur?: () => void
}

/** 사전 드롭다운 최대 개수 — 넘기면 고르는 게 일이 된다 */
const SUGGEST_LIMIT = 8

/** 계열을 못 찾았다는 안내는 **두 글자부터** — 한 글자에 매번 실패를 알리면 잔소리가 된다 */
const NO_MATCH_MIN_LENGTH = 2

/** 껍데기 두 벌 — `CompanyAutocomplete` 와 같은 규격이라야 모달에서 두 칸이 한 몸으로 보인다 */
const SHELL = {
  box: {
    label: 'block text-xs text-text-tertiary mb-1.5',
    labelText: '지원 직무',
    input:
      'w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base lg:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all',
    placeholder: '예: 퍼포먼스 마케터 / 간호사 / 재무회계',
  },
  underline: {
    label: 'block text-[11px] font-semibold text-text-quaternary tracking-wide mb-0.5',
    labelText: '직무',
    input:
      'w-full bg-transparent border-0 border-b-[1.5px] border-line-strong rounded-none px-0.5 py-2.5 text-[17px] lg:text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand transition-colors',
    // 짧은 라벨은 무엇을 적는 칸인지 덜 말해 준다 — 예시로 폭을 넓게 잡아 준다
    // (사무직만 떠올리게 하는 예시는 쓰지 않는다)
    placeholder: '예: 간호사, 백엔드 개발자, 텔러',
  },
  field: {
    label: 'block text-sm text-text-secondary mb-2 font-medium',
    labelText: '희망 직무',
    input:
      'w-full bg-input border border-line rounded-xl px-4 h-12 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all',
    placeholder: '예: 간호사, 백엔드 개발자, 텔러',
  },
} as const

export function JobTitleField({
  value,
  onChange,
  seriesId,
  onSeriesChange,
  fallbackSeriesLabel,
  seriesIsSaved = false,
  autoFocus,
  id,
  variant = 'box',
  hideSeriesRow = false,
  labelText,
  placeholder,
  onBlur,
}: JobTitleFieldProps) {
  const reactId = useId()
  const inputId = id ?? `${reactId}-job-title`
  const listId = `${reactId}-job-list`
  const wrapRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [picking, setPicking] = useState(false)
  /** 사용자가 직접 고른 계열 — null 이면 추론을 따른다 */
  const [manualId, setManualId] = useState<string | null>(null)

  const trimmed = value.trim()
  const suggestions = useMemo(
    () => (trimmed.length > 0 ? suggestJobs(value, SUGGEST_LIMIT) : []),
    [value, trimmed],
  )
  const verdict = useMemo(() => classifyJob(value), [value])

  const inferredId = verdict.status === 'confident' ? verdict.series.id : null
  const effectiveId = manualId ?? inferredId

  /*
    파생 계열을 부모에 알린다 — 타이핑·추천 탭·수동 선택이 전부 여기 한 곳으로 모인다.
    호출부가 인라인 화살표를 넘겨도 루프가 안 나게 최신 콜백은 ref 로 들고 있는다
    (deps 에 콜백을 넣으면 렌더마다 effect 가 다시 돈다).
  */
  const notifyRef = useRef(onSeriesChange)
  useEffect(() => {
    notifyRef.current = onSeriesChange
  })
  /*
    🔴 `seriesIsSaved` 일 때는 **판정 없음(null)을 부모에 알리지 않는다.**

    이게 없으면 마운트 직후 effect 가 빈 입력의 판정(`null`)을 그대로 올려, 계열만 고른
    사용자가 빈 직무 칸을 한 번 스치기만 해도 저장된 계열이 지워졌다 (2026-08-28 재현 확인:
    `{ seriesId: null }` 이 실제로 나갔다). 판정이 없다는 건 「모르겠다」지 「지워라」가 아니다.

    기본값(`false`)에서는 `hold` 가 항상 false 라 deps 가 안 흔들리고 동작이 예전과 같다 —
    카드 모달은 직무를 지우면 계열도 같이 비워야 맞는 화면이라 그 계약을 그대로 둔다.
  */
  const holdSeries = seriesIsSaved && effectiveId === null
  useEffect(() => {
    if (holdSeries) return
    notifyRef.current(effectiveId, manualId !== null)
  }, [effectiveId, manualId, holdSeries])

  // 바깥 클릭 → 드롭다운 닫기 (CompanyAutocomplete 와 같은 패턴)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const showList = open && suggestions.length > 0

  function pick(s: JobSuggestion) {
    onChange(s.expr, 'suggestion')
    setOpen(false)
    setActiveIdx(-1)
  }

  // 🔴 부모 통보는 **위 effect 한 곳**만 한다 — 여기서 또 부르면 같은 값이 두 번 가고,
  //    나중에 한쪽만 고치면 「수동인데 manual=false」 같은 어긋남이 조용히 생긴다.
  function chooseSeries(nextId: string) {
    setManualId(nextId)
    setPicking(false)
  }

  function backToAuto() {
    setManualId(null)
    setPicking(false)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1 >= suggestions.length ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault()
        pick(suggestions[activeIdx])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  // 모호 후보는 **계열 기준**으로 접는다 — 같은 계열 두 줄은 고를 이유가 없다
  const candidates: JobMatch[] = []
  if (verdict.status === 'ambiguous') {
    for (const c of verdict.candidates) {
      if (!candidates.some((x) => x.series.id === c.series.id)) candidates.push(c)
    }
  }

  const manualSeries = manualId
    ? JOB_SERIES.find((s) => s.id === manualId)
    : undefined
  /*
    저장된 계열 — 판정이 없을 때 이 값이 칩으로 나간다 (`seriesIsSaved` 전용).
    🔴 `fallbackSeriesLabel` 과 다르다: 저건 다른 화면에서 **빌려온** 추정치라 「(추정)」을
    달고 저장도 안 되지만, 이건 **이 칸이 지금 들고 있는 본인 값**이라 그냥 계열이다.
    이게 없으면 계열만 고른 사용자는 자기 계열을 화면에서 볼 수도, 바꿀 수도 없다.
  */
  const savedSeriesLabel =
    seriesIsSaved && seriesId
      ? JOB_SERIES.find((s) => s.id === seriesId)?.label
      : undefined
  const decidedLabel =
    manualSeries?.label ??
    (verdict.status === 'confident' ? verdict.series.label : null) ??
    savedSeriesLabel ??
    null

  const shell = SHELL[variant]

  return (
    <div ref={wrapRef}>
      <label htmlFor={inputId} className={shell.label}>
        {labelText ?? shell.labelText}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value, 'typed')
            setActiveIdx(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={handleKey}
          maxLength={100}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder ?? shell.placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIdx >= 0 ? `${listId}-item-${activeIdx}` : undefined
          }
          /* 🔴 모바일 노출 입력은 16px 이상 — 미만이면 iOS 가 포커스 시 강제 확대한다 */
          className={shell.input}
        />

        {showList && (
          <div
            id={listId}
            role="listbox"
            aria-label="직무 추천"
            className="absolute left-0 right-0 top-[calc(100%+6px)] bg-surface border border-line-strong rounded-lg shadow-lg max-h-[320px] overflow-y-auto overscroll-contain z-20 p-1"
          >
            {suggestions.map((s, i) => (
              <div
                key={s.expr}
                id={`${listId}-item-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault() // input blur 방지
                  pick(s)
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex items-center justify-between gap-2 min-h-[44px] lg:min-h-[36px] px-3 rounded-md cursor-pointer transition-colors ${
                  i === activeIdx ? 'bg-brand/10' : 'hover:bg-card-hover'
                }`}
              >
                <span className="text-[13px] font-medium text-text-primary truncate min-w-0">
                  {s.expr}
                </span>
                <span className="text-[11px] text-text-quaternary shrink-0">
                  {s.series.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ② 계열 판정 행 — 무엇으로 읽혔는지 바로 아래에서 말해 준다 */}
      {!hideSeriesRow && (
      <div aria-live="polite" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {!picking && decidedLabel && (
          <>
            <SeriesChip label={decidedLabel} />
            <TextButton onClick={() => setPicking(true)}>다르게 고르기</TextButton>
          </>
        )}

        {!picking && !decidedLabel && candidates.length > 0 && (
          <>
            <span className="text-[11px] text-text-tertiary">어느 쪽에 가까워요?</span>
            {candidates.map((c) => (
              <SeriesPill
                key={c.series.id}
                label={c.series.label}
                selected={false}
                onClick={() => chooseSeries(c.series.id)}
              />
            ))}
            <TextButton onClick={() => setPicking(true)}>다른 계열</TextButton>
          </>
        )}

        {!picking && !decidedLabel && candidates.length === 0 && trimmed.length >= NO_MATCH_MIN_LENGTH && (
          <>
            <span className="text-[11px] text-text-quaternary">
              계열을 못 찾았어요 — 적은 그대로 저장돼요
            </span>
            <TextButton onClick={() => setPicking(true)}>직접 고르기</TextButton>
          </>
        )}

        {!picking && !decidedLabel && trimmed.length === 0 && fallbackSeriesLabel && (
          /* 🔴 표시만 — 빌려온 값이라 저장하지 않는다 */
          <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-line bg-card text-[11px] font-medium text-text-quaternary">
            온보딩 기준: {fallbackSeriesLabel} (추정)
          </span>
        )}
      </div>
      )}

      {!hideSeriesRow && picking && (
        /* 14계열 **한 화면** — 더보기·스크롤 없이 전부 보여준다 (고르는 데 두 번 누르게 하지 않는다) */
        <div className="mt-2 flex flex-wrap gap-1.5">
          {JOB_SERIES.map((s) => (
            <SeriesPill
              key={s.id}
              label={s.label}
              selected={s.id === seriesId}
              onClick={() => chooseSeries(s.id)}
            />
          ))}
          <TextButton onClick={backToAuto}>자동으로</TextButton>
        </div>
      )}

      {!hideSeriesRow && (
        /* faint(2.7~2.9:1)는 읽으라고 둔 문장엔 부족 — quaternary(≈5.2)로 (8/29 /uiux 실측) */
        <p className="text-text-quaternary text-[11px] mt-1.5">
          자소서·면접 AI 가 <span className="text-text-tertiary">이 직무 기준</span>으로 만들어요.
        </p>
      )}
    </div>
  )
}

function SeriesChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium text-brand bg-brand/15 border-brand/30">
      {label} <span aria-hidden="true">✓</span>
    </span>
  )
}

interface SeriesPillProps {
  label: string
  selected: boolean
  onClick: () => void
}

function SeriesPill({ label, selected, onClick }: SeriesPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      /*
        터치 타겟 44px 은 **모바일에서만** — 데스크탑까지 44 로 두면 pill 이 입력창(40px)보다 커서
        버튼이 입력을 압도한다 (2026-08-28 CEO 실기: 「디자인이 별로」의 원인). lg 에서는 입력창 결에 맞춘다.
      */
      className={`inline-flex items-center min-h-[44px] lg:min-h-[32px] px-3 lg:px-2.5 rounded-full border text-[13px] lg:text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
        selected
          ? 'text-brand bg-brand/15 border-brand/30 font-semibold'
          : 'bg-card border-line text-text-secondary hover:bg-card-hover hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      /* 보이는 글자는 작게 · 히트는 44px (StepDateField 와 같은 확장 패턴) */
      className="relative before:absolute before:content-[''] before:inset-x-0 before:-inset-y-[10px] py-1 text-[11px] leading-4 text-text-tertiary hover:text-text-primary underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface rounded"
    >
      {children}
    </button>
  )
}
