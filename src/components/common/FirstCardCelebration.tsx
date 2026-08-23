import { useEffect } from 'react'
import { Target, Lightbulb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CardResearchReveal } from '@/components/card/CardResearchReveal'
import { useCelebrationStore } from '@/stores/celebrationStore'
import { calcDday, getDdayLabel } from '@/utils/dday'

/**
 * A5 — 첫 지원 카드 생성 보상 연출.
 *
 * 카드 생성 한 번으로 일어난 것(템플릿·D-day·캘린더)을 체크 시퀀스로 보여줘
 * "입력 1번 = 관리 3종 자동"이라는 첫 가치 체감을 만든다.
 * - 실제 일어난 것만 ✓ — 안 일어난 건 💡 유도 문구 (거짓 체크 금지)
 * - 시각 언어·상호작용은 합격 CelebrationOverlay 를 따름 (confetti 는 합격 전유)
 * - 발동 판정·1회 소진은 utils/firstCardCelebration (AddCardModal 에서 트리거)
 */

interface CheckRow {
  icon: 'check' | 'hint'
  text: string
  badge?: string
}

export function FirstCardCelebration() {
  const data = useCelebrationStore((s) => s.firstCard)
  const dismiss = useCelebrationStore((s) => s.dismissFirstCard)
  const navigate = useNavigate()
  const open = data !== null

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dismiss])

  if (!data) return null

  const dday = data.deadline ? calcDday(data.deadline) : null
  const rows: CheckRow[] = data.planned
    ? [
        { icon: 'check', text: '지원 예정 보드에 등록 완료' },
        {
          icon: 'hint',
          text: '지원을 시작하면 전형 단계·D-day·캘린더가 자동으로 연결돼요',
        },
      ]
    : [
        { icon: 'check', text: '전형 단계 템플릿 적용' },
        ...(dday !== null
          ? [
              {
                icon: 'check' as const,
                text: '마감 D-day 계산 완료',
                badge: getDdayLabel(dday),
              },
              { icon: 'check' as const, text: '캘린더에 자동 등록' },
            ]
          : [
              {
                icon: 'hint' as const,
                text: '마감일을 넣으면 D-day·캘린더가 자동으로 연결돼요',
              },
            ]),
      ]
  const ctaDelayMs = 300 + rows.length * 400

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`${data.companyName} 첫 카드 완성`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 backdrop-blur-md px-6 animate-fadeIn motion-reduce:animate-none"
    >
      {/* 은은한 브랜드 글로우 (합격 연출과 동일 문법 — 색만 brand) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[460px] h-[460px] max-w-[90vw] max-h-[90vw] rounded-full bg-brand/[0.08] blur-[120px]" />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative text-center max-w-md w-full animate-celebrateUp motion-reduce:animate-none"
      >
        <div className="mb-5 flex justify-center" aria-hidden="true">
          <Target size={28} strokeWidth={1.75} />
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand bg-brand/10 border border-brand/25 px-2.5 py-1 rounded-full mb-4">
          첫 카드 완성
        </span>

        <h2 className="text-text-primary text-2xl sm:text-3xl font-bold leading-tight">
          {data.companyName}
        </h2>

        {/* 체크 시퀀스 — 0.4s 간격 순차 등장 */}
        <div className="mt-6 mb-7 mx-auto max-w-xs text-left space-y-2.5">
          {rows.map((row, i) => (
            <div
              key={i}
              style={{ animationDelay: `${300 + i * 400}ms` }}
              className="flex items-start gap-2.5 animate-celebrateUp motion-reduce:animate-none opacity-0 motion-reduce:opacity-100 [animation-fill-mode:both]"
            >
              {row.icon === 'check' ? (
                <span
                  className="shrink-0 w-5 h-5 mt-px rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center"
                  aria-hidden
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5.5l2.3 2.3L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-brand"
                    />
                  </svg>
                </span>
              ) : (
                <span className="shrink-0 w-5 h-5 mt-px flex items-center justify-center" aria-hidden>
                  <Lightbulb size={14} strokeWidth={1.75} aria-hidden="true" />
                </span>
              )}
              <p
                className={`text-sm leading-relaxed ${
                  row.icon === 'check' ? 'text-text-secondary' : 'text-text-quaternary text-[13px]'
                }`}
              >
                {row.text}
                {row.badge && (
                  <span className="ml-1.5 inline-flex text-[10px] font-mono font-semibold text-warning bg-warning/10 border border-warning/25 px-1.5 py-px rounded-full align-middle">
                    {row.badge}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* 첫 카드는 **축하 안에 통합**한다 — 오버레이를 닫자마자 같은 3요소가 카드에서
            또 뜨는 이중 연출을 만들지 않는다(트리거가 배타적: AddCardModal 참고).
            조사가 없으면 null 이라 기존 축하 그대로다. */}
        <CardResearchReveal
          applicationId={data.appId}
          variant="celebration"
          startDelayMs={ctaDelayMs}
        />

        <div
          style={{ animationDelay: `${ctaDelayMs}ms` }}
          className="animate-celebrateUp motion-reduce:animate-none opacity-0 motion-reduce:opacity-100 [animation-fill-mode:both]"
        >
          <button
            autoFocus
            onClick={() => {
              dismiss()
              navigate(`/board/${data.appId}`)
            }}
            className="text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover px-5 py-2.5 rounded-lg transition-colors"
          >
            카드 보러가기 →
          </button>
          <p className="text-text-quaternary text-[11px] mt-3">
            아무 곳이나 누르면 닫혀요
          </p>
        </div>
      </div>
    </div>
  )
}
