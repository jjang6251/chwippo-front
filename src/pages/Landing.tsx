import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Apple } from 'lucide-react'
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

    // 캘린더 UX 재구성 — 홈 = /calendar (대시보드는 "회고" 페이지로 강등)
    if (accessToken) { navigate('/calendar', { replace: true }); return }

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

  const handleAppleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/apple`
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
            <Link
              to="/login"
              className="inline-flex items-center justify-center text-sm font-medium bg-brand hover:bg-accent active:bg-accent-hover text-text-primary px-4 py-2 rounded-lg transition-colors"
            >
              시작하기
            </Link>
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
            <button
              onClick={handleAppleLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-black hover:bg-[#1a1a1a] text-white border border-line font-semibold text-sm rounded-xl px-8 py-3.5 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
            >
              <AppleIcon />
              Apple로 계속하기
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
                chwippo.com/board
              </div>
            </div>
            {/*
              GIF(820KB) → 정적 WebP(14~29KB). 히어로라 `loading="lazy"` 가 무의미했고
              (첫 화면이라 즉시 받는다), 모바일 유입에 그대로 부담이었다.
              바로 위에 "로그인 없이 둘러보기" 가 있어 **데모 영상보다 데모 자체가 낫다** —
              GIF 의 역할이 이미 대체돼 있었다.
            */}
            <picture>
              {/* 🔴 치수는 source·img 각각 필요하다 — 두 컷의 종횡비가 달라(1280×755 vs 390×735)
                  하나로 못 잡는다. 히어로는 접힘선 위라 빠지면 로드 전 레이아웃이 점프한다(CLS). */}
              <source media="(min-width: 1024px)" srcSet="/hero.webp" width={1280} height={755} />
              <img
                src="/hero-m.webp"
                alt="치뽀 지원 현황 보드 — 회사별 전형 단계와 D-day"
                width={390}
                height={735}
                className="w-full block"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  const wrap = target.closest('picture') as HTMLElement | null
                  if (wrap) wrap.style.display = 'none'
                  const placeholder = (wrap ?? target).nextElementSibling as HTMLElement
                  if (placeholder) placeholder.style.display = 'flex'
                }}
              />
            </picture>
            {/* 이미지 로드 실패 시 fallback */}
            <div className="hidden items-center justify-center h-64 text-text-quaternary text-sm gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-40">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              미리보기를 불러오지 못했어요
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
              src="/add-card.webp"
              mobileSrc="/add-card-m.webp"
              alt="지원 추가 화면 — 직군을 고르면 전형 템플릿이 자동 추천됩니다"
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
                  '회사·직군에 맞는 전형 템플릿 자동 추천',
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
            {/*
              "대시보드" 는 제품에서 사라진 이름이다 — 캘린더 UX 재구성에서 홈이 /calendar 가 되고
              /dashboard 는 "회고"(월간 성장 지표)로 바뀌었다(이 파일 상단 주석 참조).
              그런데 이 섹션만 옛 이름·옛 동선을 안내하고 있었고, 회고 화면엔 D-day 가 없다.
              실제로 D-day 를 보여주는 화면(보드·캘린더) 기준으로 고쳤다. (2026-08-05)
            */}
            <SectionBadge>보드 · 캘린더</SectionBadge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
              D-day 하나도<br />놓치지 않게
            </h2>
            <p className="text-text-tertiary text-sm leading-relaxed mb-4">
              지원 현황 보드에서 회사마다 남은 D-day 를 한눈에 확인하고,
              캘린더에서 임박한 일정부터 월별 뷰까지 이어서 파악하세요.
              여러 회사를 동시에 준비해도 헷갈리지 않아요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['D-day 뱃지', '임박 마감 강조', '회사명 검색', '즐겨찾기 필터'].map((tag) => (
                <span key={tag} className="text-xs text-text-tertiary bg-card border border-line rounded-full px-3 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {/* 이미지 세로 스택 */}
          <div className="flex flex-col gap-4">
            <ScreenshotPlaceholder src="/board-list.webp" mobileSrc="/board-list-m.webp" alt="지원 현황 보드 — 회사별 현재 단계와 D-day" label="지원 현황 보드" />
            <ScreenshotPlaceholder src="/calendar.webp" mobileSrc="/calendar-m.webp" alt="캘린더 — 임박한 면접·시험 일정" label="캘린더" />
          </div>
        </div>
      </section>

      {/* 섹션③ — 자소서 정보 창고 */}
      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScreenshotPlaceholder
              src="/coverletter.webp"
              alt="자소서 문항 카드 — 답변과 글자수, AI 도구"
              label="자소서 탭"
            />
            <div>
              <SectionBadge>자소서 탭 · 내 정보 창고</SectionBadge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
                자소서 소재부터 답변까지<br />한 곳에 쌓아두세요
              </h2>
              {/*
                🔴 **모바일에서 못 하는 걸 약속하지 않는다.** 자소서 작성·편집은 데스크탑 웹 전용이다
                (`useCoverletterReadOnly`: lg 미만 또는 네이티브면 보기 전용). 유입 대부분이 모바일이라
                "관리하고 · 실시간 확인하세요" 는 그대로 막다른 길이 된다.
                반면 **내 정보 창고(소재 정리)는 모바일에서도 편집 가능**하므로 첫 문장은 유지한다.
              */}
              <p className="text-text-tertiary text-sm leading-relaxed mb-6">
                경험, 수상 이력, 자격증을 내 정보 창고에 정리해두면
                지원서 작성할 때 꺼내 쓸 수 있어요.
                회사별 자소서 문항·답변은 PC에서 작성하고, 모바일로 언제든 다시 볼 수 있어요.
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
              {/* AI 연결 — 자소서 AI 는 이미 출시됐다(2026-07 재공개). "곧 출시" 는 면접 AI 뿐 */}
              <div className="bg-brand/5 border border-brand/15 rounded-lg px-4 py-3 text-xs text-text-tertiary leading-relaxed">
                <span className="text-brand font-medium">PC에서 —</span>{' '}
                자소서 작성과 AI 초안·첨삭을 도와드려요.
                모바일에서는 쓴 내용을 볼 수 있어요.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 섹션④ — AI 티저 */}
      <section className="border-t border-line bg-surface py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          {/*
            🔴 자소서 AI 는 **이미 출시돼 있다** (2026-07 재공개 · 2026-08 모델 업그레이드).
            섹션 전체가 "곧 출시 · 도와드릴 예정" 이라 **있는 기능을 없다고 안내**하고 있었다.
            아직 안 나온 건 면접 AI 하나뿐이라, 상태를 항목별로 나눴다. (2026-08-05)

            "PC에서" 를 명시하는 이유 — 자소서 편집·AI 는 데스크탑 웹 전용이다
            (`useCoverletterReadOnly`: lg 미만 또는 네이티브면 보기 전용, IAP 심사 리스크).
            안 적으면 모바일 방문자가 기대하고 들어와 막다른 길을 만난다.
          */}
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">AI가 자소서를 돕습니다</h2>
          <p className="text-text-tertiary text-sm max-w-md mx-auto leading-relaxed mb-10">
            치뽀에 쌓아둔 경험·자소서 답변을 바탕으로 AI가 초안과 첨삭을 도와드려요.
            <br />
            <span className="text-text-quaternary">
              작성·AI 기능은 PC에서 쓸 수 있고, 모바일에서는 쓴 내용을 볼 수 있어요.
            </span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { title: 'AI 자소서 초안', desc: '활동 기록과 내 정보를 근거로 문항에 맞는 초안을 만들어줘요.', badge: 'PC에서 사용 가능', live: true },
              { title: 'AI 자소서 점검', desc: '쓴 답변의 개선 포인트를 짚어주고 예시 문장을 제안해요.', badge: 'PC에서 사용 가능', live: true },
              { title: 'AI 면접 질문 뽑기', desc: '내 자소서와 회사 정보를 분석해 예상 면접 질문을 뽑아줘요.', badge: '곧 출시', live: false },
            ].map(({ title, desc, badge, live }) => (
              <div key={title} className="bg-surface-2 border border-line rounded-xl p-4">
                <span
                  className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mb-3 border ${
                    live
                      ? 'text-brand bg-brand/10 border-brand/25'
                      : 'text-text-quaternary bg-card border-line'
                  }`}
                >
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
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-brand hover:bg-accent active:bg-accent-hover text-text-primary font-semibold text-sm px-8 py-3.5 rounded-xl transition-colors shadow-[0_0_24px_rgba(107,156,127,0.25)]"
            >
              지금 무료로 시작하기
            </Link>
            {/*
              🔴 `/inquiry` 는 `AuthGuard` 안이라 **비로그인 방문자는 로그인으로 튕겼다** (2026-08-05).
              바로 위가 "피드백을 알려주세요" 인데 **아직 회원이 아닌 사람이 못 쓰는 버튼**이었다.
              첫 방문자의 피드백이 제일 귀한데 그 경로가 막혀 있던 셈.
              메일은 로그인이 필요 없으므로 mailto 로 바꿨다 (회원은 앱 안 문의 화면을 그대로 쓴다).
            */}
            <a
              href="mailto:support@chwippo.com?subject=%EC%B9%98%EB%BD%80%20%ED%94%BC%EB%93%9C%EB%B0%B1"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-card hover:bg-card active:bg-card-strong border border-line text-text-secondary hover:text-text-primary font-medium text-sm rounded-xl px-8 py-3.5 transition-colors"
            >
              의견 보내기 →
            </a>
          </div>
        </div>
      </section>

      </main>

      {/*
        앱 안내 — 2026-07-26 App Store 출시 후에도 웹 어디에도 앱 존재를 알리는 곳이
        없었다 (2026-07-29 발견). 검색으로 들어온 사람이 앱을 모르고 나간다.
        안드로이드는 아직 스토어에 없으므로 iOS 만 안내한다.
      */}
      <section className="border-t border-line py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div>
            <p className="text-text-primary text-sm font-semibold">
              마감 알림은 앱으로 받으세요
            </p>
            <p className="text-text-tertiary text-xs mt-1 leading-relaxed">
              서류 마감·면접 일정을 놓치지 않게 알려드려요. iPhone·iPad 지원.
            </p>
          </div>
          <a
            href="https://apps.apple.com/app/id6789707709"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-bg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <Apple size={15} strokeWidth={2} aria-hidden="true" />
            App Store 에서 받기
          </a>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-line py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-text-quaternary text-xs">
          <span className="font-semibold text-text-tertiary">치뽀</span>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {/* 정적 가이드·도구 페이지 (public/guide) — React 라우트가 아니라 a 태그 */}
            <a href="/guide/" className="hover:text-text-tertiary transition-colors">가이드 · 도구</a>
            <Link to="/terms" className="hover:text-text-tertiary transition-colors">이용약관</Link>
            <Link to="/privacy" className="hover:text-text-tertiary transition-colors">개인정보처리방침</Link>
            <a
              href="mailto:support@chwippo.com?subject=회사 정보 삭제 요청&body=삭제 요청 회사명:%0A요청 사유:%0A요청자 정보 (회사 측 담당자):"
              className="hover:text-text-tertiary transition-colors"
              title="회사 측 정보 삭제 요청 (24시간 SLA)"
            >
              회사 정보 삭제 요청
            </a>
          </div>
          <span>© 2026 치뽀. All rights reserved.</span>
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
  /** 데스크탑(lg 이상) 컷 */
  src: string
  /** 모바일 기본 컷 — 없으면 데스크탑 컷을 모든 폭에서 쓴다 */
  mobileSrc?: string
  alt: string
  label: string
}

/**
 * 🔴 **모바일에서 데스크탑 캡처는 정보가 아니라 장식이 된다.**
 *
 * 실측(2026-08-05): 1280px 캡처가 모바일에서 **340px = 0.27배**로 렌더된다.
 * 12px 글자가 3.2px 이 되어 D-day 뱃지·스텝바 같은 셀링 포인트가 판독 불가다.
 * 390px 로 찍으면 340px 렌더 = **0.87배**라 거의 원본 크기로 읽힌다.
 *
 * 쓰레드 홍보 유입은 거의 전부 모바일이므로 **모바일 컷이 기본**이고, `mobileSrc` 가 있으면
 * lg 이상에서만 데스크탑 컷으로 바꾼다. 한 방문자는 둘 중 하나만 받는다.
 * (자소서 섹션은 실제로 PC 전용 기능이라 데스크탑 컷만 둔다 — mobileSrc 없음)
 */
function ScreenshotPlaceholder({ src, mobileSrc, alt, label }: ScreenshotPlaceholderProps) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
      <picture>
        {mobileSrc && <source media="(min-width: 1024px)" srcSet={src} />}
        <img
          src={mobileSrc ?? src}
          alt={alt}
          loading="lazy"
          className="w-full block"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            const wrap = target.closest('picture') as HTMLElement | null
            if (wrap) wrap.style.display = 'none'
            const placeholder = (wrap ?? target).nextElementSibling as HTMLElement
            if (placeholder) placeholder.style.display = 'flex'
          }}
        />
      </picture>
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  )
}
