import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTourStore } from '@/stores/tourStore'
import { useAuthStore } from '@/stores/authStore'
import { markOnboarded } from '@/api/users'

// ─── Step config ────────────────────────────────────────────────────────────

interface StepConfig {
  page: string | null
  selector: string | null
  title: string
  desc?: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  mobilePlacement?: 'top' | 'bottom' | 'left' | 'right'
  type: 'modal' | 'next' | 'click' | 'free'
  canGoBack: boolean
}

const STEPS: StepConfig[] = [
  // 1: Welcome modal
  { page: null, selector: null, title: '', placement: 'bottom', type: 'modal', canGoBack: false },
  // 2: Board nav (sidebar on desktop, bottom tab on mobile)
  { page: '/board', selector: 'board-nav', title: '지원 현황이 한눈에 보여요', placement: 'right', mobilePlacement: 'top', type: 'next', canGoBack: false },
  // 3: Add card button
  { page: '/board', selector: 'add-card-btn', title: '첫 카드를 만들어볼게요', placement: 'bottom', type: 'click', canGoBack: true },
  // 4: Card creation - AddCardModal handles the UI
  { page: '/board', selector: null, title: '', placement: 'bottom', type: 'modal', canGoBack: false },
  // 5: New card - user clicks it
  { page: '/board', selector: 'new-card', title: '방금 만든 카드예요', desc: '눌러서 내부를 확인해요', placement: 'bottom', type: 'click', canGoBack: false },
  // 6: Step bar overview
  { page: null, selector: 'step-bar', title: '전형 단계가 한눈에 보여요', desc: '단계별 날짜·메모를 기록해요', placement: 'bottom', type: 'next', canGoBack: true },
  // 7: Step node - click to advance current step
  { page: null, selector: 'step-node-next', title: '합격하면 다음 단계로 넘겨요', desc: '반짝이는 노드를 눌러보세요', placement: 'bottom', type: 'click', canGoBack: true },
  // 8: Step edit button (click to open modal)
  { page: null, selector: 'step-edit-btn', title: '전형이 회사마다 다르잖아요', desc: '단계를 직접 만들고 순서도 바꿔요', placement: 'bottom', type: 'click', canGoBack: true },
  // 9: Add step button inside modal
  { page: null, selector: 'add-step-btn', title: '새 단계를 추가해요', placement: 'top', type: 'click', canGoBack: false },
  // 10: Drag handle inside modal
  { page: null, selector: 'drag-handle', title: '드래그로 순서를 바꿔요', placement: 'right', type: 'next', canGoBack: false },
  // 11: Save steps button inside modal
  { page: null, selector: 'save-steps-btn', title: '저장하면 바로 반영돼요', placement: 'top', type: 'click', canGoBack: false },
  // 12: Cover letter tab (click to switch)
  { page: null, selector: 'coverletter-tab', title: '회사별 자소서를 여기서 써요', desc: '내 정보 창고 소재를 바로 꺼내 쓸 수 있어요', placement: 'bottom', type: 'click', canGoBack: false },
  // 13: Add question button inside coverletter tab
  { page: null, selector: 'add-question-btn', title: '문항과 답변을 여기서 정리해요', desc: '내 정보 창고 소재를 바로 꺼내 쓸 수 있어요', placement: 'top', type: 'next', canGoBack: true },
  // 14: Wrap-up modal
  { page: null, selector: null, title: '', placement: 'bottom', type: 'modal', canGoBack: true },
]

const TOTAL = 14
const PAD = 10
const BORDER_R = 10

// ─── Main component ──────────────────────────────────────────────────────────

export function TourOverlay() {
  const { active, step, newCardId, next, prev, stop } = useTourStore()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const location = useLocation()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [showStop, setShowStop] = useState(false)
  const retriesRef = useRef(0)

  const config = STEPS[step - 1]

  // Reset stop-confirm on every new tour start
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active) setShowStop(false)
  }, [active])

  // Scroll to top and re-lock overflow on every step.
  // iOS Safari may shift the scroll position when the keyboard opens/closes;
  // scrollTo(0,0) on each step transition corrects any residual offset so that
  // getBoundingClientRect() returns stable, viewport-relative coordinates.
  useEffect(() => {
    if (active) {
      window.scrollTo(0, 0)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [active, step])

  // Navigate to required page when step changes
  useEffect(() => {
    if (!active) return
    if (config.page === '/board' && step <= 5 && !location.pathname.startsWith('/board')) {
      navigate('/board')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step])

  // Step 5 → 6: auto-advance when navigating into /board/:id
  useEffect(() => {
    if (active && step === 5 && /^\/board\/[^/]+$/.test(location.pathname)) {
      next()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Find target element and track its rect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!active || !config.selector) { setRect(null); return }
    retriesRef.current = 0

    const selector = config.selector === 'new-card' && newCardId
      ? `[data-tour-card-id="${newCardId}"]`
      : `[data-tour="${config.selector}"]`

    const find = () => {
      // querySelectorAll + filter skips display:none duplicates (e.g. sidebar on mobile)
      const el = Array.from(document.querySelectorAll(selector)).find((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 || r.height > 0
      }) as Element | undefined
      if (el) {
        const r = el.getBoundingClientRect()
        // 56px accounts for the fixed MobileNav at the bottom on mobile.
        // If the element is off-screen or hidden behind the nav, temporarily
        // unlock scroll, bring it into view, then re-lock for a stable measurement.
        const safeBottom = window.innerHeight - 56
        if (r.top < 0 || r.bottom > safeBottom) {
          document.body.style.overflow = ''
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
          const newR = el.getBoundingClientRect()
          document.body.style.overflow = 'hidden'
          setRect(newR)
        } else {
          setRect(r)
        }
        return
      }
      if (retriesRef.current++ < 12) {
        setTimeout(find, 150)
      }
    }

    // After AddCardModal closes, the mobile keyboard dismisses and the viewport
    // may be in transition. Delay so getBoundingClientRect returns stable coordinates.
    let startTimer: ReturnType<typeof setTimeout> | undefined
    if (config.selector === 'new-card') {
      startTimer = setTimeout(find, 400)
    } else {
      find()
    }

    const onResize = () => {
      const el = document.querySelector(selector)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(startTimer)
      window.removeEventListener('resize', onResize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, newCardId, location.pathname])

  if (!active) return null

  async function complete() {
    if (user) setUser({ ...user, onboardedAt: new Date().toISOString() })
    stop()
    try { await markOnboarded() } catch { /* UI already updated */ }
  }

  // Stop confirm modal
  if (showStop) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-modal-title"
          className="bg-surface border border-line rounded-xl p-6 w-full max-w-xs shadow-2xl"
        >
          <h3 id="stop-modal-title" className="text-base font-bold text-text-primary mb-1.5">투어를 중단할까요?</h3>
          <p className="text-sm text-text-tertiary mb-6 leading-relaxed">
            언제든 설정에서 '온보딩 다시 보기'를 눌러 다시 볼 수 있어요.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowStop(false)}
              className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            >
              계속하기
            </button>
            <button
              onClick={complete}
              className="flex-1 py-2.5 rounded-lg bg-card-strong text-sm font-medium text-text-secondary hover:bg-card-strong active:bg-surface-3 transition-colors"
            >
              투어 중단
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: Welcome modal
  if (step === 1) return <WelcomeModal onNext={next} onClose={() => setShowStop(true)} />

  // Step 4: AddCardModal handles everything — no overlay
  if (step === 4) return null

  // Step 15: Wrap-up modal
  if (step === 14) {
    return (
      <WrapUpModal
        onPrev={prev}
        onMyinfo={async () => { await complete(); navigate('/myinfo') }}
        onDone={async () => { await complete(); navigate('/dashboard') }}
        onClose={() => setShowStop(true)}
      />
    )
  }

  // Steps 2, 3, 5, 6, 7…: spotlight + tooltip
  const isMobile = window.innerWidth < 1024
  const placement = (isMobile && config.mobilePlacement) ? config.mobilePlacement : config.placement
  const isFree = config.type === 'free'

  return (
    <>
      {!isFree && <Spotlight rect={rect} isClick={config.type === 'click'} />}
      {(rect !== null || isFree) && (
        <TourTooltip
          key={step}
          rect={isFree ? null : rect}
          placement={placement}
          title={config.title}
          desc={config.desc}
          step={step}
          total={TOTAL}
          canGoBack={config.canGoBack}
          isClick={config.type === 'click'}
          onNext={next}
          onPrev={prev}
          onClose={() => setShowStop(true)}
        />
      )}
    </>
  )
}

// ─── Spotlight ───────────────────────────────────────────────────────────────

function Spotlight({ rect, isClick }: { rect: DOMRect | null; isClick: boolean }) {
  const x = rect ? rect.left - PAD : 0
  const y = rect ? rect.top - PAD : 0
  const w = rect ? rect.width + PAD * 2 : 0
  const h = rect ? rect.height + PAD * 2 : 0

  return (
    <>
      {/* Click blocker: non-click steps → full overlay; click steps → frame with hole over target */}
      {!isClick && <div className="fixed inset-0 z-[9998]" />}
      {isClick && !rect && <div className="fixed inset-0 z-[9998]" />}
      {isClick && rect && (
        <>
          <div style={{ position: 'fixed', top: 0,     left: 0, right: 0,       height: Math.max(0, y),     zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: y + h, left: 0, right: 0,       bottom: 0,                  zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: y,     left: 0, width: Math.max(0, x), height: h,           zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: y,     left: x + w, right: 0,   height: h,                  zIndex: 9998 }} />
        </>
      )}

      {/* Dark SVG overlay with cutout */}
      <svg
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && <rect x={x} y={y} width={w} height={h} rx={BORDER_R} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#tour-spotlight-mask)" />
      </svg>

      {/* Highlight border around target */}
      {rect && (
        <div
          style={{
            position: 'fixed', left: x, top: y, width: w, height: h,
            zIndex: 10000, borderRadius: BORDER_R,
            border: '1.5px solid rgb(var(--brand) / 0.7)',
            boxShadow: '0 0 0 1px rgb(var(--brand) / 0.15), 0 0 24px rgb(var(--brand) / 0.2)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Pulse ring for click steps */}
      {isClick && rect && (
        <div
          style={{
            position: 'fixed', left: x - 4, top: y - 4,
            width: w + 8, height: h + 8,
            zIndex: 9998, borderRadius: BORDER_R + 4, pointerEvents: 'none',
          }}
        >
          <div className="absolute inset-0 rounded-[inherit] border-2 border-brand/40 animate-ping" />
        </div>
      )}
    </>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const TOOLTIP_W = 272

interface TooltipProps {
  rect: DOMRect | null
  placement: 'top' | 'bottom' | 'left' | 'right'
  title: string
  desc?: string
  step: number
  total: number
  canGoBack: boolean
  isClick: boolean
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

function TourTooltip({ rect, placement, title, desc, step, total, canGoBack, isClick, onNext, onPrev, onClose }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  const gap = 14
  const vpW = window.innerWidth
  const vpH = window.innerHeight

  let top: number | undefined = undefined
  let bottom: number | undefined = undefined
  let left: number
  let arrowStyle: React.CSSProperties

  if (!rect) {
    // Free step: anchor tooltip near bottom-center (above mobile nav)
    const w = Math.min(TOOLTIP_W, vpW - 32)
    bottom = 72
    left = (vpW - w) / 2
    arrowStyle = {}
  } else {
    if (placement === 'bottom') {
      top = rect.bottom + PAD + gap
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    } else if (placement === 'top') {
      top = rect.top - PAD - gap - 160
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2 - 80
      left = rect.right + PAD + gap
    } else {
      top = rect.top + rect.height / 2 - 80
      left = rect.left - PAD - gap - TOOLTIP_W
    }
    // Clamp to viewport
    left = Math.max(16, Math.min(left, vpW - TOOLTIP_W - 16))
    top = Math.max(16, Math.min(top as number, vpH - 180))
    arrowStyle = getArrowStyle(placement)
  }

  const w = !rect ? Math.min(TOOLTIP_W, vpW - 32) : TOOLTIP_W

  return (
    <div
      style={{ position: 'fixed', top, bottom, left, width: w, zIndex: 10001 }}
      className={`bg-surface border border-line rounded-xl shadow-2xl shadow-black/50 transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'}`}
    >
      {/* Arrow (only when anchored to an element) */}
      {rect && <div style={{ ...arrowStyle, position: 'absolute', pointerEvents: 'none' }} />}

      <div className="p-4">
        {/* Header: step counter + close */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="flex items-center gap-1.5"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={`투어 진행 상황: ${step} / ${total}`}
          >
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-200 ${
                  i + 1 === step ? 'bg-brand w-3.5' : i + 1 < step ? 'bg-brand/40 w-1' : 'bg-card-strong w-1'
                }`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            aria-label="투어 닫기"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Text */}
        <p className="text-sm font-semibold text-text-primary leading-snug">{title}</p>
        {desc && <p className="text-xs text-text-tertiary leading-relaxed mt-1">{desc}</p>}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          {canGoBack ? (
            <button
              onClick={onPrev}
              className="text-xs text-text-quaternary hover:text-text-tertiary transition-colors"
            >
              ← 이전
            </button>
          ) : <div />}

          {isClick ? (
            <span className="text-[11px] text-brand font-medium">
              ↑ 클릭해서 진행하세요
            </span>
          ) : (
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 text-xs font-semibold text-bg bg-brand hover:bg-accent active:bg-accent-hover px-3 py-1.5 rounded-lg transition-colors"
            >
              {step === total - 1 ? '마무리' : '다음'} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getArrowStyle(
  placement: 'top' | 'bottom' | 'left' | 'right',
): React.CSSProperties {
  const size = 7
  const color = 'rgb(var(--surface))'
  const border = 'var(--line)'

  if (placement === 'bottom') {
    return {
      top: -size,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0, height: 0,
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderBottom: `${size}px solid ${color}`,
      filter: `drop-shadow(0 -1px 0 ${border})`,
    }
  }
  if (placement === 'top') {
    return {
      bottom: -size,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0, height: 0,
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderTop: `${size}px solid ${color}`,
      filter: `drop-shadow(0 1px 0 ${border})`,
    }
  }
  if (placement === 'right') {
    return {
      top: '50%',
      left: -size,
      transform: 'translateY(-50%)',
      width: 0, height: 0,
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderRight: `${size}px solid ${color}`,
    }
  }
  return {
    top: '50%',
    right: -size,
    transform: 'translateY(-50%)',
    width: 0, height: 0,
    borderTop: `${size}px solid transparent`,
    borderBottom: `${size}px solid transparent`,
    borderLeft: `${size}px solid ${color}`,
  }
}

// ─── Welcome modal (step 1) ───────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 5a2 2 0 012-2h10a2 2 0 012 2v1H2V5z" />
        <path d="M2 6h14v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        <line x1="6" y1="10.5" x2="12" y2="10.5" />
      </svg>
    ),
    label: '내 정보 창고',
    desc: '자소서 소재를\n모아두고 재활용',
  },
]

function WelcomeModal({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-modal-title"
          className="w-full md:max-w-[420px] bg-surface border border-line[0.06] rounded-t-xl md:rounded-xl shadow-2xl"
        >
        <div className="relative flex items-center justify-center px-6 pt-6">
          <span className="text-[10px] font-semibold text-text-quaternary tracking-[0.14em] uppercase">치뽀</span>
          <button
            onClick={onClose}
            className="absolute right-5 w-9 h-9 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            aria-label="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-6 pb-4">
          <h2 id="welcome-modal-title" className="text-base font-bold text-text-primary text-center mb-1">
            취업 준비, 이제 한 곳에서
          </h2>
          <p className="text-xs text-text-tertiary text-center mb-5">
            지원부터 최종합격까지 치뽀 하나로 관리해요.<br />
            <span className="text-text-quaternary">3분이면 전체 투어가 끝나요</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {FEATURES.map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-3 bg-card border border-line[0.06]">
                <span className="text-brand">{icon}</span>
                <span className="text-[11px] font-semibold text-text-primary">{label}</span>
                <span className="text-[10px] text-text-quaternary text-center leading-snug whitespace-pre-line">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-8 md:pb-6 mt-2">
          <button
            onClick={onNext}
            className="w-full py-3 rounded-xl bg-brand hover:bg-accent active:bg-accent-hover text-bg text-sm font-semibold transition-colors"
          >
            직접 둘러보기 →
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 mt-1 text-xs text-text-quaternary hover:text-text-tertiary transition-colors"
          >
            나중에 보기
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Wrap-up modal (step 8) ───────────────────────────────────────────────────

function WrapUpModal({
  onPrev,
  onMyinfo,
  onDone,
  onClose,
}: {
  onPrev: () => void
  onMyinfo: () => void
  onDone: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wrapup-modal-title"
          className="w-full md:max-w-[420px] bg-surface border border-line[0.06] rounded-t-xl md:rounded-xl shadow-2xl"
        >
        <div className="relative flex items-center justify-center px-6 pt-6">
          <span className="text-[10px] font-semibold text-text-quaternary tracking-[0.14em] uppercase">치뽀</span>
          <button onClick={onClose} className="absolute right-5 w-9 h-9 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors" aria-label="닫기">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 id="wrapup-modal-title" className="text-base font-bold text-text-primary mb-2">이제 치뽀를 시작할 준비가 됐어요!</h2>
          <div className="mt-4 flex flex-col gap-2.5 text-left">
            <div className="flex items-start gap-3 p-3 bg-card border border-line[0.05] rounded-xl">
              <span className="text-lg mt-0.5">📅</span>
              <div>
                <p className="text-xs font-semibold text-text-primary">캘린더</p>
                <p className="text-[11px] text-text-quaternary mt-0.5">마감·면접 일정을 한눈에 확인할 수 있어요</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-card border border-line[0.05] rounded-xl">
              <span className="text-lg mt-0.5">📁</span>
              <div>
                <p className="text-xs font-semibold text-text-primary">내 정보 창고</p>
                <p className="text-[11px] text-text-quaternary mt-0.5">자소서 소재를 미리 채워두면 꺼내 쓸 수 있어요</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 md:pb-6 mt-2 flex flex-col gap-2.5">
          <button
            onClick={onMyinfo}
            className="w-full py-3 rounded-xl bg-brand hover:bg-accent active:bg-accent-hover text-bg text-sm font-semibold transition-colors"
          >
            내 정보 채우러 가기
          </button>
          <div className="flex items-center justify-between">
            <button onClick={onPrev} className="py-2 pr-2 text-xs text-text-quaternary hover:text-text-tertiary transition-colors">
              ← 이전
            </button>
            <button onClick={onDone} className="py-2 pl-2 text-xs text-text-quaternary hover:text-text-tertiary transition-colors">
              대시보드로 가기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
