import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export function Landing() {
  const { accessToken, setAccessToken } = useAuthStore()
  const navigate = useNavigate()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    if (accessToken) { navigate('/dashboard', { replace: true }); return }

    axios
      .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const token = data.data?.accessToken ?? data.accessToken
        setAccessToken(token)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {})
  }, [])

  const handleKakaoLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* 상단 네비 */}
      <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">취뽀</span>
          <button
            onClick={handleKakaoLogin}
            className="text-sm font-medium bg-brand hover:bg-accent text-white px-4 py-2 rounded-lg transition-colors"
          >
            시작하기
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          취준생이 직접 만들고, 피드백으로 자라는 서비스
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
          취업 준비의 모든 것을<br />
          <span className="text-brand">한 곳에서</span>
        </h1>

        <p className="text-text-tertiary text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
          지원 현황 관리부터 면접 일정, 자기소개서 소재까지.<br />
          취뽀 하나로 취업 준비를 끝내세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-xl px-8 py-3.5 transition-colors shadow-[0_4px_24px_rgba(254,229,0,0.2)]"
          >
            <KakaoIcon />
            카카오로 무료 시작
          </button>
          <span className="text-text-quaternary text-xs">무료 · 광고 없음 · 카드 등록 불필요</span>
        </div>
      </section>

      {/* 핵심 기능 미리보기 */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon="📋"
            title="지원 현황 한눈에"
            desc="지원 예정부터 최종 합격까지. 단계별 스텝바로 모든 회사의 진행 상황을 카드 하나로 확인하세요."
          />
          <FeatureCard
            icon="⏰"
            title="D-day 놓치지 않게"
            desc="서류 마감일, 면접 일정을 D-day 뱃지로 표시. 임박한 일정을 대시보드에서 바로 확인하세요."
          />
          <FeatureCard
            icon="📁"
            title="내 정보 창고"
            desc="자격증, 어학점수, 자기소개서 소재를 한 곳에. 지원서 작성할 때 복사해서 쓰세요."
          />
        </div>
      </section>

      {/* 스텝바 시각화 섹션 */}
      <section className="bg-surface py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-text-quaternary text-xs font-medium tracking-widest uppercase mb-4">커스텀 스텝바</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">내 취업 여정을 시각화</h2>
          <p className="text-text-tertiary text-sm mb-12 max-w-md mx-auto">
            서류 → 면접 → 합격까지 각 단계를 직접 설정하고<br />
            클릭 한 번으로 현재 단계를 업데이트하세요.
          </p>

          {/* 데모 스텝바 */}
          <div className="bg-surface-2 border border-white/5 rounded-2xl p-6 max-w-lg mx-auto text-left">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-text-primary font-semibold text-sm">카카오</p>
                <p className="text-text-quaternary text-xs mt-0.5">프론트엔드 개발자 · IT개발</p>
              </div>
              <span className="text-[10px] font-medium bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded-full font-mono">
                D-3
              </span>
            </div>

            <DemoStepBar currentIndex={2} />

            <p className="text-text-tertiary text-xs mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
              현재: 1차 면접
              <span className="ml-auto text-text-quaternary font-mono">29%</span>
            </p>
          </div>
        </div>
      </section>

      {/* "같이 만들어가는" 섹션 */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <p className="text-brand text-sm font-medium mb-4">함께 만들어가는 서비스</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          여러분의 피드백이<br />취뽀를 만들어갑니다
        </h2>
        <p className="text-text-tertiary text-sm max-w-md mx-auto mb-10 leading-relaxed">
          취준생이 직접 겪는 불편함을 해결하기 위해 만들었습니다.<br />
          부족한 점, 원하는 기능을 언제든지 알려주세요.<br />
          빠르게 반영하겠습니다.
        </p>
        <button
          onClick={handleKakaoLogin}
          className="bg-brand hover:bg-accent text-white font-semibold text-sm px-8 py-3.5 rounded-xl transition-colors shadow-[0_0_24px_rgba(94,106,210,0.3)]"
        >
          지금 무료로 시작하기
        </button>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-text-quaternary text-xs">
          <span className="font-semibold text-text-tertiary">취뽀</span>
          <div className="flex items-center gap-6">
            <a href="/terms" className="hover:text-text-tertiary transition-colors">이용약관</a>
            <a href="/privacy" className="hover:text-text-tertiary transition-colors">개인정보처리방침</a>
          </div>
          <span>© 2025 취뽀. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-surface-2 border border-white/5 rounded-2xl p-6 text-left hover:border-brand/20 transition-colors">
      <div className="text-2xl mb-4">{icon}</div>
      <h3 className="text-text-primary font-semibold text-sm mb-2">{title}</h3>
      <p className="text-text-quaternary text-xs leading-relaxed">{desc}</p>
    </div>
  )
}

const DEMO_STEPS = ['서류 제출', '서류 발표', '1차 면접', '1차 결과', '2차 면접', '2차 결과', '최종 합격']

function DemoStepBar({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center w-full">
      {DEMO_STEPS.map((_, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        const isLast = i === DEMO_STEPS.length - 1
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-3 h-3 rounded-full flex-none flex items-center justify-center
                ${isDone ? 'bg-brand' : ''}
                ${isCurrent ? 'bg-brand shadow-[0_0_10px_rgba(94,106,210,0.6)] ring-2 ring-brand/30' : ''}
                ${!isDone && !isCurrent ? 'bg-white/10 border border-white/8' : ''}
              `}
            >
              {isCurrent && <span className="absolute w-3 h-3 rounded-full bg-brand/50 animate-ping" />}
              {isDone && (
                <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4l2.5 2.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {!isLast && (
              <div className="flex-1 h-px mx-0.5 bg-white/8 overflow-hidden rounded-full">
                <div className="h-full bg-brand" style={{ width: i < currentIndex ? '100%' : '0%' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 0C4.029 0 0 3.168 0 7.08c0 2.52 1.611 4.734 4.05 6.003L3.06 17.1a.36.36 0 0 0 .54.378L8.37 14.1A10.43 10.43 0 0 0 9 14.16c4.971 0 9-3.168 9-7.08S13.971 0 9 0Z"
        fill="#191919"
      />
    </svg>
  )
}
