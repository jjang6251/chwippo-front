import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useAuthStore } from '@/stores/authStore'
import { markOnboarded } from '@/api/users'
import { AddCardModal } from '@/components/card/AddCardModal'

export function OnboardingFlow() {
  const show = useOnboardingStore((s) => s.show)
  const close = useOnboardingStore((s) => s.close)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [addCardOpen, setAddCardOpen] = useState(false)

  if (!show) return null

  function handleClose() {
    setStep(1)
    close()
  }

  async function completeOnboarding() {
    if (user) setUser({ ...user, onboardedAt: new Date().toISOString() })
    setStep(1)
    close()
    try { await markOnboarded() } catch { /* UI already updated */ }
  }

  async function handleMyinfo() {
    if (user) setUser({ ...user, onboardedAt: new Date().toISOString() })
    setStep(1)
    close()
    navigate('/myinfo')
    try { await markOnboarded() } catch { /* UI already updated */ }
  }

  function handleAddCardClose() {
    setAddCardOpen(false)
    setStep(3)
  }

  const STEPS_23 = {
    2: {
      emoji: '🏢',
      title: '첫 지원 회사를 추가해보세요',
      sub: '회사 이름과 직무만 입력하면 지원 단계가 자동으로 생성돼요.',
    },
    3: {
      emoji: '📁',
      title: '내 정보 창고를 채워두면',
      sub: '자기소개서 작성할 때 저장해둔 내 정보를 바로 꺼내 쓸 수 있어요.',
    },
  } as const

  const FEATURES = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="16" height="4" rx="1.2" />
          <rect x="1" y="7.5" width="16" height="4" rx="1.2" />
          <rect x="1" y="14" width="9" height="3" rx="1.2" />
        </svg>
      ),
      label: '지원 보드',
      desc: '카드 한 장으로\n지원 상태 추적',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="16" height="14" rx="1.5" />
          <line x1="1" y1="7.5" x2="17" y2="7.5" />
          <line x1="6" y1="1" x2="6" y2="5" />
          <line x1="12" y1="1" x2="12" y2="5" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
      label: '일정 캘린더',
      desc: '마감·면접 일정을\n한눈에 확인',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5a2 2 0 012-2h10a2 2 0 012 2v1H2V5z" />
          <path d="M2 6h14v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          <line x1="6" y1="10.5" x2="12" y2="10.5" />
        </svg>
      ),
      label: '내 정보 창고',
      desc: '자소서 소재를\n모아두고 재활용',
    },
  ]

  if (addCardOpen) {
    return <AddCardModal open={true} onClose={handleAddCardClose} />
  }

  const content23 = step === 2 || step === 3 ? STEPS_23[step] : null

  return (
    <>
      {/* overlay */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0">
        <div className="w-full md:max-w-[420px] bg-surface border border-white/[0.06] rounded-t-2xl md:rounded-2xl shadow-2xl">

          {/* header row */}
          <div className="relative flex items-center justify-center px-6 pt-6">
            <span className="text-[10px] font-semibold text-text-quaternary tracking-[0.14em] uppercase">
              치뽀
            </span>
            <button
              onClick={handleClose}
              className="absolute right-5 w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-white/[0.06] transition-colors"
              aria-label="닫기"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* progress dots */}
          <div
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-label={`온보딩 진행: ${step} / 3`}
            className="flex items-center justify-center gap-2 mt-4"
          >
            {([1, 2, 3] as const).map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'bg-brand w-4' : 'bg-white/[0.15] w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Step 1 — feature highlight */}
          {step === 1 && (
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-bold text-text-primary text-center mb-1">
                취업 준비, 이제 한 곳에서
              </h2>
              <p className="text-xs text-text-tertiary text-center mb-5">
                지원부터 최종합격까지 치뽀 하나로 관리하세요.
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {FEATURES.map(({ icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]"
                  >
                    <span className="text-brand">{icon}</span>
                    <span className="text-[11px] font-semibold text-text-primary">{label}</span>
                    <span className="text-[10px] text-text-quaternary text-center leading-snug whitespace-pre-line">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps 2 & 3 — simple content */}
          {content23 && (
            <div className="px-6 pt-7 pb-4 text-center">
              <div className="text-5xl mb-5">{content23.emoji}</div>
              <h2 className="text-lg font-bold text-text-primary leading-snug mb-2.5">
                {content23.title}
              </h2>
              <p className="text-sm text-text-tertiary leading-relaxed">{content23.sub}</p>
            </div>
          )}

          {/* CTAs */}
          <div className="px-6 pb-8 md:pb-6 mt-3 flex flex-col gap-2.5">
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl bg-brand hover:bg-accent text-text-primary text-sm font-semibold transition-colors"
              >
                시작하기
              </button>
            )}
            {step === 2 && (
              <>
                <button
                  onClick={() => setAddCardOpen(true)}
                  className="w-full py-3 rounded-xl bg-brand hover:bg-accent text-text-primary text-sm font-semibold transition-colors"
                >
                  지금 추가하기
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="w-full py-2.5 text-sm text-text-quaternary hover:text-text-tertiary transition-colors"
                >
                  나중에
                </button>
              </>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={handleMyinfo}
                  className="w-full py-3 rounded-xl bg-brand hover:bg-accent text-text-primary text-sm font-semibold transition-colors"
                >
                  내 정보 채우러 가기
                </button>
                <button
                  onClick={completeOnboarding}
                  className="w-full py-2.5 text-sm text-text-quaternary hover:text-text-tertiary transition-colors"
                >
                  마치기
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
