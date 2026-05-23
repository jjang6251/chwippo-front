import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { resolvePostLoginDestination } from '@/utils/authRouting'

export function Landing() {
  const { accessToken, setAccessToken, setUser } = useAuthStore()
  const navigate = useNavigate()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    if (accessToken) { navigate('/dashboard', { replace: true }); return }

    axios
      .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const payload = data.data ?? data
        setAccessToken(payload.accessToken)
        if (payload.user) setUser(payload.user)
        navigate(resolvePostLoginDestination(payload.user?.termsAgreedAt), { replace: true })
      })
      .catch(() => { /* refresh 실패는 무시 — 비로그인 상태로 랜딩 표시 */ })
    // 랜딩 첫 진입 시 1회만 자동 로그인 시도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKakaoLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur border-b border-line">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight">치뽀</Link>
          <nav aria-label="메인 네비게이션" className="flex items-center gap-2">
            <Link
              to="/demo"
              className="text-sm font-medium text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg transition-colors"
            >
              둘러보기
            </Link>
            <button
              type="button"
              onClick={handleKakaoLogin}
              className="text-sm font-medium bg-brand hover:bg-accent active:bg-accent-hover text-text-primary px-4 py-2 rounded-lg transition-colors"
            >
              시작하기
            </button>
          </nav>
        </div>
      </header>

      <main>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            취준생이 직접 만들고, 피드백으로 자라는 서비스
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
            취업 준비의 모든 것을<br />
            <span className="text-brand">한 곳에서</span>
          </h1>

          <p className="text-text-tertiary text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10">
            지원 현황 관리부터 면접 일정, 자기소개서 소재까지.<br className="hidden sm:block" />
            치뽀 하나로 취업 준비를 끝내세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              onClick={handleKakaoLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-xl px-8 py-3.5 transition-colors shadow-[0_4px_24px_rgba(254,229,0,0.15)]"
            >
              <KakaoIcon />
              카카오로 무료 시작
            </button>
            <Link
              to="/demo"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-card hover:bg-card active:bg-card-strong border border-line text-text-secondary hover:text-text-primary font-medium text-sm rounded-xl px-8 py-3.5 transition-colors"
            >
              로그인 없이 둘러보기 →
            </Link>
          </div>
          <p className="text-text-quaternary text-xs">무료로 시작 · 카드 등록 불필요</p>
        </div>

        {/* GIF placeholder */}
        <div className="relative mx-auto max-w-3xl">
          <div className="absolute inset-0 rounded-2xl bg-brand/5 blur-3xl -z-10 scale-95" />
          <div className="bg-surface-2 border border-line rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
            {/* 브라우저 크롬 */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line bg-surface">
              <span className="w-2.5 h-2.5 rounded-full bg-card-strong" />
              <span className="w-2.5 h-2.5 rounded-full bg-card-strong" />
              <span className="w-2.5 h-2.5 rounded-full bg-card-strong" />
              <div className="ml-3 flex-1 bg-card rounded px-3 py-1 text-xs text-text-quaternary font-mono">
                app.chwippo.com/board
              </div>
            </div>
            <img
              src="/demo-preview.gif"
              alt="치뽀 앱 미리보기"
              loading="lazy"
              className="w-full block"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                const placeholder = target.nextElementSibling as HTMLElement
                if (placeholder) placeholder.style.display = 'flex'
              }}
            />
            {/* GIF 파일 없을 때 fallback */}
            <div className="hidden items-center justify-center h-64 text-text-quaternary text-sm gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-40">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              앱 미리보기 GIF (촬영 예정)
            </div>
          </div>
        </div>
      </section>

      {/* 섹션① — 지원 추가 한 번에 */}
      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 이미지 (모바일: 위, 데스크탑: 좌) */}
            <ScreenshotPlaceholder
              src="/add-card.png"
              alt="지원 추가 화면"
              label="전형 템플릿 자동 세팅"
            />
            {/* 텍스트 */}
            <div>
              <SectionBadge>전형 템플릿</SectionBadge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
                회사 고르면<br />전형 단계까지 자동으로
              </h2>
              <p className="text-text-tertiary text-sm leading-relaxed mb-6">
                회사명과 직무를 고르면 서류 제출부터 1차 면접, 최종 결과까지
                전형 단계가 자동으로 세팅됩니다. 스텝바가 바로 생성되어
                지금 어느 단계인지 한눈에 보여요.
              </p>
              <ul className="space-y-2.5">
                {[
                  '업종별 전형 템플릿 자동 추천',
                  '스텝바 클릭 한 번으로 단계 업데이트',
                  '스텝별 날짜·장소·메모 기록',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="w-4 h-4 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="rgb(var(--brand))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 섹션② — 여러 회사 한눈에 */}
      <section className="border-t border-line bg-surface py-20">
        <div className="max-w-3xl mx-auto px-6">
          {/* 텍스트 */}
          <div className="text-center mb-10">
            <SectionBadge>대시보드 · 캘린더</SectionBadge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
              D-day 하나도<br />놓치지 않게
            </h2>
            <p className="text-text-tertiary text-sm leading-relaxed mb-4">
              대시보드에서 임박한 마감을 D-day 뱃지로 한눈에 확인하고,
              캘린더에서 면접·시험 일정을 월별로 파악하세요.
              여러 회사를 동시에 준비해도 헷갈리지 않아요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['D-day 뱃지', '월별 캘린더', '임박 마감 강조', '회사별 필터'].map((tag) => (
                <span key={tag} className="text-xs text-text-tertiary bg-card border border-line rounded-full px-3 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {/* 이미지 세로 스택 */}
          <div className="flex flex-col gap-4">
            <ScreenshotPlaceholder src="/dashboard.png" alt="대시보드 화면" label="대시보드" />
            <ScreenshotPlaceholder src="/calendar.png" alt="캘린더 화면" label="캘린더" />
          </div>
        </div>
      </section>

      {/* 섹션③ — 자소서 정보 창고 */}
      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScreenshotPlaceholder
              src="/coverletter.png"
              alt="자소서 탭 화면"
              label="자소서 탭"
            />
            <div>
              <SectionBadge>자소서 탭 · 내 정보 창고</SectionBadge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
                자소서 소재부터 답변까지<br />한 곳에 쌓아두세요
              </h2>
              <p className="text-text-tertiary text-sm leading-relaxed mb-6">
                경험, 수상 이력, 자격증을 내 정보 창고에 정리해두면
                지원서 작성할 때 꺼내 쓸 수 있어요.
                회사별 자소서 답변도 탭 하나로 관리하고, 글자수도 실시간으로 확인하세요.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  '경험·수상·자격증 소재 정리',
                  '회사별 자소서 문항·답변 보관',
                  '글자수 실시간 체크',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="w-4 h-4 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="rgb(var(--brand))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              {/* AI 티저 연결 */}
              <div className="bg-brand/5 border border-brand/15 rounded-lg px-4 py-3 text-xs text-text-tertiary leading-relaxed">
                <span className="text-brand font-medium">곧 출시 —</span>{' '}
                지금 쌓아둔 소재와 답변을 바탕으로 AI가 자소서 첨삭·면접 질문을 도와드릴 예정이에요.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 섹션④ — AI 티저 */}
      <section className="border-t border-line bg-surface py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-success/10 border border-success/20 text-success text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            곧 출시
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">AI가 자소서·면접까지</h2>
          <p className="text-text-tertiary text-sm max-w-md mx-auto leading-relaxed mb-10">
            지금 치뽀에 쌓아둔 경험·자소서 답변을 바탕으로
            AI가 자소서 첨삭·초안 생성, 면접 예상 질문을 도와드릴 예정이에요.
            미리 내 정보를 채워두면 출시 즉시 바로 쓸 수 있어요.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { title: 'AI 자소서 첨삭', desc: '쓴 답변의 개선 포인트를 짚어주고 예시 문장을 제안해요.', badge: '자소서 탭' },
              { title: 'AI 자소서 초안', desc: '경험 키워드 몇 가지만 입력하면 자소서 초안을 만들어줘요.', badge: '자소서 탭' },
              { title: 'AI 면접 질문 뽑기', desc: '내 자소서와 회사 정보를 분석해 예상 면접 질문을 뽑아줘요.', badge: '면접 단계' },
            ].map(({ title, desc, badge }) => (
              <div key={title} className="bg-surface-2 border border-line rounded-xl p-4">
                <span className="inline-block text-[10px] font-medium text-text-quaternary bg-card border border-line rounded-full px-2 py-0.5 mb-3">
                  {badge}
                </span>
                <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
                <p className="text-xs text-text-quaternary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 섹션⑤ — 같이 만들어가는 서비스 */}
      <section className="border-t border-line py-20">
        <div className="max-w-xl mx-auto px-6 text-center">
          <p className="text-brand text-sm font-medium mb-4">함께 만들어가는 서비스</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
            여러분의 피드백이<br />치뽀를 만들어갑니다
          </h2>
          <p className="text-text-tertiary text-sm leading-relaxed mb-10">
            취준생이 직접 겪는 불편함을 해결하기 위해 만들었습니다.
            부족한 점, 원하는 기능을 언제든지 알려주세요. 빠르게 반영하겠습니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleKakaoLogin}
              className="w-full sm:w-auto bg-brand hover:bg-accent active:bg-accent-hover text-text-primary font-semibold text-sm px-8 py-3.5 rounded-xl transition-colors shadow-[0_0_24px_rgba(107,156,127,0.25)]"
            >
              지금 무료로 시작하기
            </button>
            <Link
              to="/inquiry"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-card hover:bg-card active:bg-card-strong border border-line text-text-secondary hover:text-text-primary font-medium text-sm rounded-xl px-8 py-3.5 transition-colors"
            >
              문의하기 →
            </Link>
          </div>
        </div>
      </section>

      </main>

      {/* 푸터 */}
      <footer className="border-t border-line py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-text-quaternary text-xs">
          <span className="font-semibold text-text-tertiary">치뽀</span>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="hover:text-text-tertiary transition-colors">이용약관</Link>
            <Link to="/privacy" className="hover:text-text-tertiary transition-colors">개인정보처리방침</Link>
          </div>
          <span>© 2025 치뽀. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium text-text-quaternary bg-card border border-line rounded-full px-3 py-1 mb-4">
      {children}
    </span>
  )
}

interface ScreenshotPlaceholderProps {
  src: string
  alt: string
  label: string
}

function ScreenshotPlaceholder({ src, alt, label }: ScreenshotPlaceholderProps) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full block"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement
          target.style.display = 'none'
          const placeholder = target.nextElementSibling as HTMLElement
          if (placeholder) placeholder.style.display = 'flex'
        }}
      />
      <div className="hidden items-center justify-center h-52 text-text-quaternary text-xs gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-40">
          <rect x="0.7" y="0.7" width="12.6" height="12.6" rx="1.8" stroke="currentColor" strokeWidth="1.1" />
          <path d="M4 5l2 2.5L8 4l3 4H3L4 5z" fill="currentColor" opacity="0.3" />
        </svg>
        {label} 스크린샷
      </div>
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
