import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSignupAnswer } from '@/hooks/useSignupAnswer'
import { JOB_GROUPS, type JobCategory } from '@/utils/sampleData'
import { toast } from '@/stores/toastStore'

/**
 * W1 — signup 1 질문 페이지.
 * 21 직군 (20 + 기타) 5 그룹 카드 + 다중 선택 + Continue/Skip.
 * "기타" 선택 시 자유 입력 field expand.
 *
 * 라우트 = /signup/question (AuthGuard 안, onboardedAt null 시 LoginCallback 가 redirect).
 */

// 그룹별 토큰 색 → Tailwind class 매핑 (alpha modifier 사용)
const GROUP_TOKEN: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  brand: {
    border: 'border-brand',
    bg: 'bg-brand/[0.14]',
    text: 'text-brand',
    ring: 'ring-brand/30',
  },
  accent: {
    border: 'border-accent',
    bg: 'bg-accent/[0.14]',
    text: 'text-accent',
    ring: 'ring-accent/30',
  },
  info: {
    border: 'border-info',
    bg: 'bg-info/[0.14]',
    text: 'text-info',
    ring: 'ring-info/30',
  },
  violet: {
    border: 'border-violet',
    bg: 'bg-violet/[0.14]',
    text: 'text-violet',
    ring: 'ring-violet/30',
  },
  warning: {
    border: 'border-warning',
    bg: 'bg-warning/[0.14]',
    text: 'text-warning',
    ring: 'ring-warning/30',
  },
  'text-tertiary': {
    border: 'border-text-tertiary',
    bg: 'bg-text-tertiary/[0.14]',
    text: 'text-text-tertiary',
    ring: 'ring-text-tertiary/30',
  },
}

// 그룹별 SVG icon
function GroupIcon({ id }: { id: string }) {
  switch (id) {
    case 'A': // IT — 코드 꺾쇠
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 4 2 8 5 12" />
          <polyline points="11 4 14 8 11 12" />
        </svg>
      )
    case 'B': // 디자인 — 연필
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13 L13 3 M11 5 L13 3 L13 5" />
          <circle cx="4" cy="12" r="1.5" />
        </svg>
      )
    case 'C': // 마케팅 — 확성기
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5 L10 2 L10 14 L2 11 Z" />
          <path d="M13 6 Q15 8 13 10" />
        </svg>
      )
    case 'D': // 경영지원 — 서류
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="2" width="10" height="12" rx="1" />
          <line x1="5" y1="5" x2="11" y2="5" />
          <line x1="5" y1="8" x2="11" y2="8" />
          <line x1="5" y1="11" x2="9" y2="11" />
        </svg>
      )
    case 'E': // 산업 — 공장
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 14 L2 7 L6 7 L6 4 L10 4 L10 7 L14 7 L14 14 Z" />
          <line x1="5" y1="11" x2="5" y2="13" />
          <line x1="11" y1="11" x2="11" y2="13" />
        </svg>
      )
    default: // X 기타 — 물음표
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="5" x2="8" y2="9" />
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
        </svg>
      )
  }
}

export function SignupQuestion() {
  const navigate = useNavigate()
  const signupAnswer = useSignupAnswer()
  const [selected, setSelected] = useState<Set<JobCategory>>(new Set())
  const [otherText, setOtherText] = useState('')
  const otherInputRef = useRef<HTMLInputElement>(null)

  const includesOther = selected.has('기타')

  // "기타" 클릭 직후 input autofocus (effect 는 focus 만 — setState 분리)
  useEffect(() => {
    if (includesOther) {
      setTimeout(() => otherInputRef.current?.focus(), 100)
    }
  }, [includesOther])

  function toggle(cat: JobCategory) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
        // "기타" 해제 → 입력값 clear (effect 의존 X)
        if (cat === '기타') setOtherText('')
      } else {
        next.add(cat)
      }
      return next
    })
  }

  function handleContinue() {
    const jobCategories = Array.from(selected)
    signupAnswer.mutate(
      { jobCategories, otherText: otherText.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('환영해요! 샘플 카드를 준비했어요')
          navigate('/calendar', { replace: true })
        },
        onError: () => toast.error('저장에 실패했어요. 다시 시도해주세요.'),
      },
    )
  }

  function handleSkip() {
    signupAnswer.mutate(
      { jobCategories: [] },
      {
        onSuccess: () => navigate('/calendar', { replace: true }),
        onError: () => toast.error('저장에 실패했어요. 다시 시도해주세요.'),
      },
    )
  }

  const count = selected.size
  const disabled = signupAnswer.isPending

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background: `
          radial-gradient(ellipse 800px 600px at 50% -200px, rgba(var(--brand), 0.08), transparent 60%),
          rgb(var(--bg))
        `,
      }}
    >
      <div className="w-full max-w-[560px] text-center">
        {/* Hero illustration */}
        <svg viewBox="0 0 200 200" className="w-[144px] h-[144px] mx-auto mb-6" fill="none" aria-hidden="true">
          <circle cx="100" cy="60" r="22" fill="rgb(var(--brand))" opacity="0.85" />
          <rect x="78" y="86" width="44" height="58" rx="6" fill="rgb(var(--brand))" opacity="0.85" />
          <rect
            x="55"
            y="110"
            width="36"
            height="48"
            rx="4"
            fill="rgb(var(--accent))"
            opacity="0.6"
            transform="rotate(-8 73 134)"
          />
          <rect
            x="110"
            y="105"
            width="36"
            height="48"
            rx="4"
            fill="rgb(var(--surface-3))"
            stroke="rgb(var(--brand))"
            strokeWidth="1.5"
            transform="rotate(6 128 129)"
          />
          <circle cx="40" cy="40" r="3" fill="rgb(var(--accent))" opacity="0.6" />
          <circle cx="170" cy="50" r="2.5" fill="rgb(var(--brand))" opacity="0.6" />
          <circle cx="160" cy="160" r="3" fill="rgb(var(--accent))" opacity="0.6" />
          <circle cx="30" cy="170" r="2" fill="rgb(var(--brand))" opacity="0.6" />
        </svg>

        <div className="text-[11px] text-brand font-medium tracking-[0.08em] uppercase mb-3">
          한 가지만 알려주세요
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-text-primary mb-3 font-display tracking-tight">
          어떤 직군을 준비하고 계세요?
        </h1>
        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          선택한 직군에 맞는 샘플 회사 카드를 미리 준비해드릴게요.
          <br />
          나중에 언제든 바꿀 수 있어요.
        </p>

        {/* Selection counter */}
        <div
          className={`
            inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
            font-mono text-[11px] font-medium mb-4
            transition-all duration-200
            ${
              count === 0
                ? 'bg-card text-text-tertiary border border-line'
                : 'bg-brand/10 text-brand border border-brand/25'
            }
          `}
          role="status"
          aria-live="polite"
        >
          <span>{count === 0 ? '○' : '✓'}</span>
          <span>{count === 0 ? '1개 이상 선택해주세요' : `${count}개 선택됨 · 최대 21개`}</span>
        </div>

        {/* Group cards */}
        <div className="flex flex-col gap-3 mb-6 text-left">
          {JOB_GROUPS.map((group) => {
            const groupSelected = group.categories.filter((c) => selected.has(c)).length
            const hasActive = groupSelected > 0
            const tok = GROUP_TOKEN[group.color]
            return (
              <div
                key={group.id}
                className={`
                  bg-surface-2 rounded-2xl p-3.5 sm:p-4
                  border transition-colors
                  ${hasActive ? tok.border + '/30' : 'border-line'}
                `}
              >
                <div className="flex items-center gap-2 mb-2.5 font-mono text-[11px] text-text-tertiary tracking-wider">
                  <span className={tok.text}>
                    <GroupIcon id={group.id} />
                  </span>
                  <strong className="text-text-secondary font-semibold uppercase tracking-wider">
                    {group.label}
                  </strong>
                  <span
                    className={`
                      ml-auto text-[10px] px-2 py-0.5 rounded-full border
                      ${
                        hasActive
                          ? `${tok.text} ${tok.bg.replace('/[0.14]', '/[0.10]')} ${tok.border.replace('border-', 'border-')}/30`
                          : 'text-text-quaternary bg-card border-line'
                      }
                    `}
                  >
                    {groupSelected} / {group.categories.length}
                  </span>
                </div>

                <div
                  className={`
                    grid gap-1.5
                    ${
                      group.categories.length === 5
                        ? 'grid-cols-2 sm:grid-cols-5'
                        : group.categories.length === 4
                        ? 'grid-cols-2 sm:grid-cols-4'
                        : 'grid-cols-2 sm:grid-cols-3'
                    }
                  `}
                  role="group"
                  aria-label={group.label}
                >
                  {group.categories.map((cat) => {
                    const active = selected.has(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggle(cat)}
                        disabled={disabled}
                        aria-pressed={active}
                        className={`
                          relative px-2.5 py-2.5 rounded-lg text-xs font-medium
                          border transition-all duration-200
                          min-h-[44px] flex items-center justify-center text-center leading-tight
                          ${
                            active
                              ? `${tok.bg} ${tok.border} ${tok.text} font-semibold scale-[1.02] shadow-md`
                              : 'bg-surface border-line text-text-secondary hover:-translate-y-0.5 hover:text-text-primary ' +
                                tok.border.replace('border-', 'hover:border-') +
                                '/45'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        {cat}
                        {active && (
                          <span
                            className={`absolute top-1 right-1.5 text-[10px] font-bold ${tok.text}`}
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {/* "기타" 자유 입력 — group X 의 chip 바로 아래 */}
                  {group.id === 'X' && (
                    <div
                      className={`
                        col-span-full overflow-hidden
                        transition-all duration-300
                        ${includesOther ? 'max-h-[80px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
                      `}
                    >
                      <input
                        ref={otherInputRef}
                        type="text"
                        maxLength={200}
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="어떤 직군이세요? 예: 게임 기획, 통번역, 셰프 등"
                        className="
                          w-full bg-surface border border-line-strong rounded-lg
                          px-3 py-2.5 text-[13px] text-text-primary
                          focus:outline-none focus:border-text-tertiary
                          transition-colors
                        "
                      />
                      <span className="block text-[10px] text-text-quaternary mt-1 px-0.5">
                        비워두면 generic 샘플 카드 · 입력하면 해당 직무로 생성
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={disabled}
            className="bg-transparent text-text-tertiary px-4 py-3 text-[13px] font-medium hover:text-text-primary transition-colors disabled:opacity-50"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={disabled || count === 0}
            className="
              bg-brand hover:bg-accent text-bg px-7 py-3
              rounded-lg text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-3
              transition-colors
            "
          >
            {disabled ? '저장 중…' : '계속하기'}
          </button>
        </div>

        <div className="mt-6 text-[11px] text-text-quaternary">
          관심 직군 · 다중 선택 가능 · 언제든 변경
        </div>
      </div>
    </div>
  )
}
