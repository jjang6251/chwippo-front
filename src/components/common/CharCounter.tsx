/**
 * 글자수 카운터 — **최소·최대를 동시에** 보여주는 한 줄.
 *
 * 실측 근거: 리크루터·LG 지원서가 「0글자 입력 (최소 400 – 최대 800)」로 두 경계를 같이
 * 보여준다(`autofill-census-2026-09.md` 「입력 UX 관찰」 #9). 우리 자소서 카드는 최대만
 * 보여주고 있어서, 최소 글자수가 있는 문항에서 「얼마나 더 써야 하나」를 알 수 없었다.
 *
 * 색 규칙은 `CoverletterQuestionCard` 와 **같다** — 초과 = danger(굵게) · 최대의 90% 이상 =
 * warning · 그 외 = quaternary. 화면마다 다른 색으로 경고하면 학습이 안 된다.
 *
 * `current` 는 **`countChars(text).total` 로 세서** 넘긴다 — `String.length` 는 이모지를
 * 2로 세서 카드와 숫자가 어긋난다.
 */
import { charCounterText, charCounterTone } from '@/utils/charCount'

interface Props {
  /** 현재 글자 수 — `countChars(value).total` */
  current: number
  /** 최대 글자 수 (없으면 상한 없음) */
  max?: number
  /** 최소 글자 수 (있으면 최대와 함께 괄호로 표시) */
  min?: number
  className?: string
}

const TONE_CLASS = {
  danger: 'text-danger font-semibold',
  warning: 'text-warning',
  normal: 'text-text-quaternary',
} as const

export function CharCounter({ current, max, min, className = '' }: Props) {
  const tone = charCounterTone(current, max)
  return (
    <p aria-live="polite" className={`text-xs font-mono tabular-nums text-right ${TONE_CLASS[tone]} ${className}`}>
      {charCounterText(current, max, min)}
    </p>
  )
}
