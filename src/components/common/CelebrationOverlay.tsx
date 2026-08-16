import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useCelebrationStore } from '@/stores/celebrationStore'

/**
 * 합격 축하 컨페티 — sage + coral + 보조색.
 *
 * 🔴 **hex 를 박아두지 않는다** (2026-08-17). 예전엔 `#6b9c7f` 처럼 그때의 다크 토큰값을
 * 복사해 뒀는데, 토큰이 바뀌자 **여기만 옛 색으로 남았다.** canvas-confetti 는 CSS 클래스를
 * 못 받으므로 **실행 시점에 토큰을 읽어** 넘긴다 — 테마가 바뀌면 컨페티 색도 따라간다.
 */
function tokenColors(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const rgb = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim()
    return v ? `rgb(${v.replace(/\s+/g, ' ')})` : fallback
  }
  return [
    rgb('--brand', '#82bb99'),
    rgb('--accent', '#f79476'),
    rgb('--success', '#84bb9a'),
    rgb('--warning', '#d4b045'),
    rgb('--text-primary', '#ebe9e3'),
  ]
}

export function CelebrationOverlay() {
  const companyName = useCelebrationStore((s) => s.companyName)
  const dismiss = useCelebrationStore((s) => s.dismiss)
  const open = companyName !== null
  const firedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      firedRef.current = false
      return
    }
    document.body.style.overflow = 'hidden'

    if (!firedRef.current) {
      firedRef.current = true
      // 중앙 위쪽에서 한 번 크게, 그 뒤 양쪽 아래 코너에서 ~2.2초간 잔잔히
      confetti({ particleCount: 70, spread: 95, startVelocity: 32, origin: { x: 0.5, y: 0.42 }, colors: tokenColors(), gravity: 1, ticks: 220, scalar: 1, disableForReducedMotion: true })
      const end = Date.now() + 2200
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 50, startVelocity: 42, origin: { x: 0, y: 0.95 }, colors: tokenColors(), gravity: 1.1, ticks: 180, scalar: 0.9, disableForReducedMotion: true })
        confetti({ particleCount: 3, angle: 120, spread: 50, startVelocity: 42, origin: { x: 1, y: 0.95 }, colors: tokenColors(), gravity: 1.1, ticks: 180, scalar: 0.9, disableForReducedMotion: true })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dismiss])

  if (!open) return null

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`${companyName} 최종 합격 축하`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 backdrop-blur-md px-6 animate-fadeIn motion-reduce:animate-none"
    >
      {/* 은은한 성공 글로우 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[460px] h-[460px] max-w-[90vw] max-h-[90vw] rounded-full bg-success/[0.08] blur-[120px]" />
      </div>

      <div onClick={(e) => e.stopPropagation()} className="relative text-center max-w-md w-full animate-celebrateUp motion-reduce:animate-none">
        <div className="text-5xl mb-5" aria-hidden>🎉</div>

        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 border border-success/25 px-2.5 py-1 rounded-full mb-4">
          최종 합격
        </span>

        <h2 className="text-text-primary text-2xl sm:text-3xl font-bold leading-tight">{companyName}</h2>
        <p className="text-text-secondary text-base sm:text-lg font-medium mt-1.5">축하해요!</p>

        <p className="text-text-tertiary text-sm leading-relaxed mt-4 mb-7">
          그동안 준비한 것들이 빛났네요.<br className="hidden sm:block" /> 다음 단계도 응원할게요.
        </p>

        <button
          autoFocus
          onClick={dismiss}
          className="text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover px-5 py-2.5 rounded-lg transition-colors"
        >
          고마워요
        </button>
      </div>
    </div>
  )
}
