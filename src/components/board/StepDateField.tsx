import { useState } from 'react'
import { Calendar, Pencil } from 'lucide-react'
import { useStepScheduleSave } from '@/hooks/useStepScheduleSave'
import { formatStepSchedule, toDateTimeLocalValue } from '@/utils/datetime'

interface Props {
  appId: string
  stepId: string
  /** aria-label 에만 쓴다 — 「1차 면접 일정 수정」 처럼 무엇의 날짜인지 읽히게 */
  stepName: string
  scheduledDate: string | null
  /** 스텝 유형 색 (`STEP_TYPE_CONFIG[type].colorCls`) — 달력 아이콘에만 쓴다 */
  iconColorCls?: string
  /**
   * 좁고 조용한 자리용 (면접 넛지 모달 헤더). 그 자리는 원래 **11px D-day 한 줄**이라
   * 기본 크기(34px 칩)를 넣으면 제목·아바타와 무게가 안 맞아 얹은 티가 난다.
   * 글자·여백만 줄이고 **히트는 44px 그대로** 유지한다.
   */
  dense?: boolean
  /**
   * 값이 실제로 저장됐다 — 호출부가 그 사실을 따로 기록해야 할 때만 준다
   * (공고 결과 시트: 「AI 값을 고쳤다」를 `posting_meta.editedFields` 에 남긴다).
   */
  onSaved?: () => void
  /**
   * 빈 칸에 쓸 글자 — 기본은 「날짜 설정하기」.
   *
   * 공고에서 온 스텝은 날짜 대신 **공고가 한 말**(「9월 예정」)을 들고 있다. 그 말을 지우고
   * 「날짜 설정하기」로 덮으면 공고가 알려 준 정보가 화면에서 사라진다.
   */
  emptyLabel?: string
}

/**
 * 스텝 일정 — **그 자리에서 고치는 칸**. 카드 상세 현재 스텝 카드와 면접 넛지 모달이 함께 쓴다.
 *
 * ## 왜 「칸」처럼 생겼나
 *
 * 처음엔 날짜를 그냥 텍스트로 뒀는데 **만든 사람조차 어디서 고치는지 못 찾았다**
 * (CEO 2026-08-25). 테두리로 칸을 만들고 ✎ 를 붙여야 hover 가 없는 터치에서도
 * 컨트롤로 읽힌다. 빈 상태는 **점선** — 채워 넣으라는 신호다(샘플 카드 dashed 와 같은 문법).
 *
 * ## 크기
 *
 * **보이는 칸은 작게 · 히트는 44px 이상**. 44px 짜리 알약도 만들어 봤는데 12px 글자를 담은
 * 통이 옆 평문(12px 한 줄)과 무게가 2배라 얹은 티가 났다 — 보이는 크기 대신 히트만 늘린다.
 * 기본 28px(+11px씩) · dense 24px(+12px씩).
 * ⚠️ 확장 폭은 **실제 클릭으로** 재야 한다 — `elementFromPoint` 는 의사요소를 다르게
 * 다뤄 「붙었다」로 보이고, 5px 로는 실효 40px 에 그쳤다(실측).
 *
 * ## 🔴 `type="date"` 를 쓰지 말 것
 *
 * 카드 상세 헤더에 있던 날짜 입력이 날짜 전용이라 저장할 때마다 시각을 `T00:00:00` 으로
 * 덮어썼고, 그 탓에 **임박(2시간 전) 알림에서 이탈**하고 캘린더 시간도 사라졌다
 * (ADR-049 가 없앤 결함). 쓰기는 `useStepScheduleSave` 한 곳만 지난다.
 */
export function StepDateField({ appId, stepId, stepName, scheduledDate, iconColorCls = 'text-text-tertiary', dense, onSaved, emptyLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const save = useStepScheduleSave(appId, stepId)

  const { dateLabel, timeLabel } = formatStepSchedule(scheduledDate)

  const open = () => {
    setDraft(toDateTimeLocalValue(scheduledDate))
    setEditing(true)
  }

  /** 히트 영역 확장 — 보이는 칸 위아래로 넓혀 44px 을 만든다 (위 주석 참조) */
  const hit = dense
    ? "relative before:absolute before:content-[''] before:inset-x-0 before:-inset-y-[12px]"
    : "relative before:absolute before:content-[''] before:inset-x-0 before:-inset-y-[11px]"
  /** 보이는 크기 — dense 는 그 자리(11px D-day)와 무게를 맞춘다 */
  const box = dense ? 'min-h-[24px] px-1.5 text-[11px]' : 'min-h-[28px] px-2'
  const ico = dense ? 11 : 13
  const pen = dense ? 11 : 12

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${box} bg-card-strong border border-brand/60 ring-1 ring-brand/20 rounded-lg`}>
        <Calendar size={ico} strokeWidth={1.75} className={`${iconColorCls} shrink-0`} aria-hidden="true" />
        {/* 🔴 `datetime-local` — `date` 로 바꾸면 시각이 자정으로 덮여 임박 알림에서 이탈한다 */}
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); save(e.target.value); onSaved?.() }}
          onBlur={() => setEditing(false)}
          autoFocus
          aria-label="일정 날짜 및 시간"
          /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 */
          className={`bg-transparent text-base ${dense ? "sm:text-[11px]" : "sm:text-sm"} text-text-primary focus:outline-none min-w-0 w-[168px]`}
        />
      </span>
    )
  }

  if (dateLabel) {
    return (
      <button
        onClick={open}
        aria-label={`${stepName} 일정 수정 — ${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`}
        className={`${hit} ${box} inline-flex items-center gap-1 bg-card-strong border border-line-strong rounded-lg hover:border-brand/50 hover:bg-surface-3 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors`}
      >
        <Calendar size={ico} strokeWidth={1.75} className={`${iconColorCls} shrink-0`} aria-hidden="true" /> {dateLabel}
        {timeLabel && <b className="ml-0.5 font-mono text-brand">{timeLabel}</b>}
        <Pencil size={pen} strokeWidth={1.75} className="ml-1.5 text-text-tertiary shrink-0" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      onClick={open}
      aria-label={`${stepName} 날짜 설정하기`}
      className={`${hit} ${box} inline-flex items-center gap-1 bg-card-strong border border-dashed border-line-strong rounded-lg text-text-tertiary hover:text-text-secondary hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors`}
    >
      <Calendar size={ico} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
      {emptyLabel ?? '날짜 설정하기'}
      <Pencil size={pen} strokeWidth={2} className="ml-1.5 text-text-quaternary shrink-0" aria-hidden="true" />
    </button>
  )
}
