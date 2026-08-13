import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Apple } from 'lucide-react'
import axios from 'axios'
import { REFRESH_HTTP_TIMEOUT_MS } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { resolvePostLoginDestination } from '@/utils/authRouting'
import { CompanyCard } from '@/components/card/CompanyCard'
import { ScaledPreview } from '@/components/landing/ScaledPreview'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { InterviewQuestionCard } from '@/components/card/InterviewQuestionCard'
import { MessageBubble } from '@/components/coverletter/CoverletterChatPanel'
import { CountdownPillCard } from '@/components/calendar/CountdownPillCard'
import { CountdownHeroLarge } from '@/components/calendar/CountdownHeroLarge'
import { CalendarMonthlyGrid } from '@/components/calendar/CalendarMonthlyGrid'
import { CalendarAgendaView } from '@/components/calendar/CalendarAgendaView'
import { CoverletterQuestionCard } from '@/components/coverletter/CoverletterQuestionCard'
import {
  LANDING_BOARD,
  LANDING_CHAT,
  LANDING_COVERLETTERS,
  LANDING_CL_MAP,
  LANDING_DDAYS,
  LANDING_EVENTS,
  LANDING_QUESTIONS,
} from './Landing.data'

/**
 * 문구 속 **「AI」만** 키우고 브랜드색을 준다.
 *
 * 🔴 **AI 가 본문에 묻혀 있었다** (2026-08-09 CEO). 섹션 축을 「대상」(자소서/면접)으로
 * 통일하면서 헤딩에서 AI 가 전부 빠졌고, 실측하니 랜딩 본문에 AI 가 **3곳뿐 · 전부 14px 이하**
 * 였다. 지원 현황 관리는 노션·엑셀로도 되지만 **자소서를 읽고 면접 질문을 뽑는 건 안 된다** —
 * 치뽀의 차별점이 구석에서만 말해지고 있었다.
 *
 * 문구·구조는 그대로 두고 **글자만** 드러낸다 (CEO 판단). `em` 단위라 어느 크기에 놓여도
 * 주변 대비 같은 비율로 커진다.
 */
function hiAI(text: string) {
  return text.split(/(AI)/g).map((part, i) =>
    part === 'AI' ? (
      /*
        🔴 JSX 가 태그 앞뒤 줄바꿈을 공백으로 바꾼다 — `<span>` 안팎을 줄바꿈하면
        `AI  초안` 처럼 자간이 벌어진다. 한 줄로 붙여 쓴다.
      */
      // prettier-ignore
      <span key={i} className="text-brand font-semibold text-[1.1em] leading-none">AI</span>
    ) : (
      part
    ),
  )
}

/** 랜딩 카드는 장식이라 콜백이 필요 없다 — 클릭 자체를 `pointer-events-none` 으로 막는다 */
const noop = () => {}
const EMPTY_KEYS = new Set<string>()

export function Landing() {
  /**
   * 🔴 **좁은 화면엔 「모바일 화면」을 보여준다** (2026-08-09).
   *
   * 액자는 `데스크탑 폭 ÷ 칸 폭` 으로 배율을 내는데, 390px 뷰포트에서 340px 칸에
   * 1500px 짜리 면접 화면을 넣으면 **배율 0.23 — 14px 글씨가 3px** 이 된다. 실측이다.
   * 데스크탑 화면을 줄이는 게 아니라, **그 컴포넌트들이 실제 모바일 앱에서 그리는 모습**을
   * 그대로 그린다(390px 폭). 배율이 0.87 이 돼 읽힌다.
   *
   * `lg` 미만에서 켠다 — 태블릿(768px)도 면접이 0.48 이라 읽기 어려웠다.
   * 액자 폭이 내용에 맞춰지므로 칸이 남아도 빈 공간 없이 가운데 놓인다.
   */
  const compact = useMediaQuery('(max-width: 1023px)')

  const { accessToken, setAccessToken, setUser } = useAuthStore()
  const navigate = useNavigate()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    // 캘린더 UX 재구성 — 홈 = /calendar (대시보드는 "회고" 페이지로 강등)
    if (accessToken) { navigate('/calendar', { replace: true }); return }

    /*
      🔴 performRefresh(공용 통로)를 쓰지 않는다 — 그 경로는 실패 시 반드시
      handleAuthFailure(토스트 + clearAuth + '/' 이동)를 타는데, **랜딩에서 401 은
      비정상이 아니라 비로그인 방문자의 정상 상태**다. 갈아끼우면 첫 방문자가
      "로그인이 만료되었습니다" 토스트와 '/' 재이동(무한 새로고침)을 겪는다.
      회전 락 대상도 아니다 (앱의 로그인 화면은 네이티브라 이 코드가 렌더되지 않고,
      브라우저엔 중재할 네이티브가 없다). 시간 상한만 doRefresh 와 맞춘다.
    */
    axios
      .post(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: REFRESH_HTTP_TIMEOUT_MS },
      )
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
          {/*
            🔴 **로고도 누르는 요소다** (2026-08-09 uiux). 32×28 이라 44px 미달이었고
            `focus-visible` 링도 없었다. 글자 크기는 그대로 두고 **터치 영역만** 넓힌다.
          */}
          <Link
            to="/"
            className="text-lg font-bold tracking-tight inline-flex items-center min-h-[44px] px-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            치뽀
          </Link>
          <nav aria-label="메인 네비게이션" className="flex items-center gap-2">
            <Link
              to="/demo"
              className="text-sm font-medium text-text-secondary hover:text-text-primary inline-flex items-center min-h-[44px] px-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              둘러보기
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center min-h-[44px] text-sm font-medium bg-brand hover:bg-brand-hover active:bg-brand-hover text-bg px-4 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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

          {/*
            🔴 **랜딩이 파는 것과 사람들이 쓰는 것이 어긋나 있었다** (2026-08-09).
            예전 카피는 `"취업 준비의 모든 것을 한 곳에서"` — 모아두고·자동으로·안 놓치게,
            전부 **관리**를 판다. 그런데 관측에서 제일 많이 열리는 화면은
            `/board/:id/steps/:stepId`(전형 단계 상세)로, 자소서·캘린더보다 위였다.
            거기서 사람들이 하는 일은 **「준비 체크리스트」를 적고 지우는 것**이다.

            그리고 `"한 곳에서"` 는 잡코리아·사람인·노션 템플릿이 전부 하는 말이라
            **왜 치뽀인지**가 없었다. 그래서 약속을 관리에서 **준비**로 옮긴다.

            ⚠️ 표본이 작다(실사용자 2명 · `/ops` 세션은 CEO 본인). 이 수정의 목표는
            "전환율 개선" 이 아니라 **랜딩이 실제 제품을 설명하게 만드는 것**이다.
          */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-6 break-keep">
            지원한 회사가 늘어날수록<br />
            <span className="text-brand">헷갈리지 않게</span>
          </h1>

          {/*
            제품이 화면에서 쓰는 말을 그대로 쓴다 — 「준비 체크리스트」(StepPage).

            🔴 **첫 줄에 "취업 준비" 를 남긴다.** 초안에서 h1 을 `"다음 전형까지 뭘 준비하지?"` 로
            바꾸자 **히어로에서 "취업" 이 통째로 사라졌고**, 검색으로 들어온 사람이 무슨 서비스인지
            알 근거가 배지 한 줄뿐이었다 (e2e `landing.spec` 이 잡았다).

            🔴 **h1 은 바로 아래 화면이 증명할 수 있는 것만 말한다** (2026-08-09).
            초안은 `"다음 전형까지 / 뭘 준비하지?"` 였는데, **묻는 것과 화면이 답하는 것이 달랐다** —
            질문은 "준비" 인데 히어로 보드는 "어디까지 왔는지"(단계·D-day·진행률)를 보여준다.
            게다가 「준비 체크리스트」를 보여주던 섹션을 뺀 뒤라 그 약속을 받아주는 자리도 없었다.

            그래서 **여러 회사가 쌓일수록 헷갈린다** 는 실제 고통으로 바꿨다 —
            카드 4장이 각각 다른 단계·D-day 로 놓인 그 화면이 곧 답이다.
            체크리스트 기능 자체는 그대로 있고, 랜딩에서만 뺀다.
          */}
          <p className="text-text-tertiary text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10 break-keep">
            {/*
              🔴 **줄바꿈이 숨으면 공백도 사라진다** (2026-08-09). `hidden sm:block` 은
              `<br>` 을 없애는 게 아니라 안 보이게 할 뿐이라, 모바일에서 앞뒤 문장이
              `다릅니다.회사·직군만` 으로 **붙어버렸다.** JSX 는 줄 끝 공백도 지운다.
              `{' '}` 로 공백을 명시한다.
            */}
            취업 준비는 회사마다 전형이 다릅니다.{' '}
            <br className="hidden sm:block" />
            회사·직군만 고르면 단계가 자동으로 생기고, 어디까지 왔는지 한눈에 보여요.
          </p>

          {/*
            🔴 **무엇을 할 수 있는지 히어로에서 바로 보여준다** (2026-08-09 CEO).
            h1 은 "왜" 를 말하고(다음 전형까지 뭘 준비하지?), 여기서 "무엇" 을 말한다.
            아래로 스크롤해야 기능을 아는 구조였다.

            🔴 **AI 두 개는 PC 전용이라 그대로 못 박는다.** 자소서 작성·편집은 데스크탑 웹
            전용이고(`useCoverletterReadOnly`), 면접 질문 생성도 같다. 표시 없이 나열하면
            모바일 방문자에게 막다른 길을 약속하는 셈이 된다 — 섹션3 에서 이미 한 번 고친 자리다.
            `PC` 마커는 본문성 정보이므로 11px 하한을 지킨다(DESIGN.md 규칙 7).
          */}
          <ul className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { label: '지원 현황 · 일정 관리', pcOnly: false },
              { label: 'AI 자소서', pcOnly: true },
              { label: 'AI 면접 준비', pcOnly: true },
            ].map(({ label, pcOnly }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary bg-card border border-line rounded-full pl-4 pr-3 py-2"
              >
                {hiAI(label)}
                {pcOnly && (
                  <span className="text-[11px] font-normal text-text-quaternary border-l border-line pl-1.5">
                    PC
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              onClick={handleKakaoLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-xl px-8 py-3.5 transition-colors shadow-[0_4px_24px_rgba(254,229,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <KakaoIcon />
              카카오로 무료 시작
            </button>
            <button
              onClick={handleAppleLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-black hover:bg-[#1a1a1a] text-white border border-line font-semibold text-sm rounded-xl px-8 py-3.5 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <AppleIcon />
              Apple로 계속하기
            </button>
            <Link
              to="/demo"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-card hover:bg-card active:bg-card-strong border border-line text-text-secondary hover:text-text-primary font-medium text-sm rounded-xl px-8 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
            {/* 브라우저 크롬 — 데스크탑 은유라 모바일 화면 위엔 얹지 않는다 */}
            <div className={`${compact ? 'hidden' : 'flex'} items-center gap-1.5 px-4 py-3 border-b border-line bg-surface`}>
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
            {/*
              🔴 **스크린샷이 아니라 진짜 카드를 렌더한다** (2026-08-09 CEO).

              히어로에 스크린샷(`hero.webp`, 이 커밋에서 삭제)을 깔면
              **카드 디자인이 바뀌는 순간 랜딩이 조용히 낡는다** —
              오늘 하루에만 "랜딩이 제품과 어긋난다" 를 네 번 고쳤다. 실제 `CompanyCard` 를 쓰면
              그 어긋남이 원리적으로 안 생기고, 어떤 해상도에서도 선명하며 라이트/다크가 자동이다.

              쓸 수 있는 이유 — 이 컴포넌트가 부르는 mutation 훅은 **`.mutate()` 전에는 요청을
              보내지 않는다.** `QueryClientProvider`(main.tsx)·`BrowserRouter`(App.tsx)가 이미
              랜딩을 감싸고, `useDemoMode` 는 기본값이 `false` 라 Provider 없이도 동작한다.

              🔴 `pointer-events-none` — 랜딩에서 카드를 눌러 삭제·단계변경이 나가면 안 된다.
              `aria-hidden` 으로 보조기기 탐색에서도 뺀다(장식이고, 아래 CTA 가 실제 진입점이다).

              데이터는 **여기에 직접 둔다.** `@/demo/sampleData` 를 import 하면 1,000줄짜리 데모
              모듈이 통째로 첫 화면 번들에 딸려온다.
            */}
            <div className="p-3 sm:p-4">
              <ScaledPreview width={compact ? 390 : 1080}>
                <div className={`grid ${compact ? 'grid-cols-1 gap-3 p-3' : 'grid-cols-2 gap-4 p-4'}`}>
                  {LANDING_BOARD.slice(0, compact ? 2 : 4).map((app) => (
                    <CompanyCard key={app.id} application={app} />
                  ))}
                </div>
              </ScaledPreview>
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
          {/*
            🔴 **스크린샷이 아니라 실제 컴포넌트다** (2026-08-09).
            `CountdownPillCard` 는 `DdayItem` 하나만 받고 query 훅이 없다 — 캘린더 **페이지**가
            훅 11개를 쓰는 것과 달리, 실제로 **그리는** 컴포넌트는 props 만 받는다.
            D-day 숫자도 오늘 기준으로 계산돼 랜딩이 오래 살아도 안 틀어진다.
          */}
          <div className="flex flex-col gap-4">
            {/*
              🔴 **한 장짜리 카드가 아니라 그 화면 그대로** (2026-08-09 CEO).
              캘린더 상단은 `CountdownHeroLarge`(가장 임박한 일정) + `CountdownPillCard` 2장이다.
              부분만 떼면 "D-day 를 한눈에" 라는 약속이 안 보인다.
            */}
            <ScaledPreview width={compact ? 390 : 760} label="캘린더 — 임박한 일정">
              <div className={compact ? 'space-y-2.5 p-3' : 'space-y-3 p-4'}>
                <CountdownHeroLarge event={LANDING_DDAYS[0]} streakDays={5} />
                <div className={`grid ${compact ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-3'}`}>
                  {LANDING_DDAYS.slice(1, compact ? 2 : 3).map((e) => (
                    <CountdownPillCard key={e.stepId} event={e} />
                  ))}
                </div>
              </div>
            </ScaledPreview>
            {/*
              🔴 **월별 뷰가 빠져 있었다** (2026-08-09 CEO). 바로 위 설명이
              `"임박한 일정부터 월별 뷰까지 이어서 파악하세요"` 라고 약속하는데
              화면에는 임박한 일정만 있었다 — 랜딩이 광고하고 안 보여주는 그 패턴이다.
              `CalendarMonthlyGrid` 는 `CalendarEvent[]` 만 받고 데이터 훅이 없어 그대로 쓴다.
            */}
            {/*
              🔴 **화면 크기마다 제품이 쓰는 뷰가 다르다** (2026-08-09).
              `Calendar.tsx` 는 아젠다 뷰를 항상 그리고 **월별 그리드는 `!isMobile` 일 때만** 붙인다.
              처음엔 모바일에서 월별 그리드를 그렸다가 pill 이 `당…` `한…` 으로 잘려 빼버렸는데,
              **애초에 제품이 모바일에서 안 쓰는 뷰**였다. 잘린 게 아니라 자리를 잘못 고른 것이다.
              모바일엔 아젠다 뷰를 둔다 — 실제 사용자가 그 자리에서 보는 화면이고,
              "월별 뷰까지 이어서" 라는 약속도 날짜별로 쭉 이어 보는 것으로 지켜진다.
            */}
            <ScaledPreview
              width={compact ? 390 : 900}
              label={compact ? '캘린더 — 날짜별로 이어 보기' : '캘린더 — 월별 뷰'}
            >
              <div className={compact ? 'p-3' : 'p-4'}>
                {compact ? (
                  <CalendarAgendaView events={LANDING_EVENTS} />
                ) : (
                  <CalendarMonthlyGrid events={LANDING_EVENTS} />
                )}
              </div>
            </ScaledPreview>
          </div>
        </div>
      </section>

      {/* 섹션③ — 자소서 정보 창고 */}
      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6">
          {/*
            🔴 **화면이 가로로 넓어 2열을 버렸다** (2026-08-09). 텍스트 옆 464px 칸에
            1120px 짜리 자소서 화면을 넣으니 0.4배로 줄어 **글씨가 안 읽혔다.**
            섹션② 와 같은 구조로 — 설명을 위에, 화면은 아래 전체 폭에.
          */}
          <div className="text-center mb-10 max-w-xl mx-auto">
              {/*
                🔴 **「내 정보 창고」를 약속하지 않는다** (2026-08-09 CEO). 배지·h2·본문·불릿
                네 곳이 소재 정리를 광고했는데 **그 화면을 보여주지 않았다.** 랜딩이 광고하고
                안 보여주는 게 오늘 계속 고쳐온 문제라, 보여줄 것까지로 약속을 줄인다.
                h2 의 "소재부터" 도 곧 내 정보 창고라 같이 바꾼다 — 배지만 지우면 약속은 남는다.

                🔴 **섹션 축을 「대상」으로 통일한다.** 예전엔 이 섹션이 자소서(대상 축),
                다음 섹션이 AI(기능 축)라 **자소서 AI 가 세 군데서 소개**됐다
                (여기 PC 안내 · 여기 미리보기 · 다음 섹션 카드 2장). 사용자는 "자소서 써야 해" 로
                생각하지 "AI 기능 볼래" 로 생각하지 않고, 히어로 칩도 이미 대상 축이다.
              */}
              <SectionBadge>자소서</SectionBadge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug break-keep">
                회사마다 다른 자소서를<br />쌓아두고, 같이 고쳐 씁니다
              </h2>
              {/*
                🔴 **모바일에서 못 하는 걸 약속하지 않는다.** 자소서 작성·편집은 데스크탑 웹 전용이다
                (`useCoverletterReadOnly`: lg 미만 또는 네이티브면 보기 전용). 유입 대부분이 모바일이라
                "관리하고 · 실시간 확인하세요" 는 그대로 막다른 길이 된다.
              */}
              <p className="text-text-tertiary text-sm leading-relaxed mb-6 break-keep">
                {hiAI('회사별 문항과 답변을 한곳에 모아두고, 막히면 AI 와 주고받으며 고쳐 씁니다.')}{' '}
                작성은 PC에서 하고, 모바일로는 언제든 다시 볼 수 있어요.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  '회사별 자소서 문항·답변 보관',
                  '글자수 실시간 체크',
                  'AI 초안 · AI 점검 — 쌓아둔 경험을 근거로',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <span className="w-4 h-4 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="rgb(var(--brand))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {hiAI(item)}
                  </li>
                ))}
              </ul>
              {/* AI 연결 — 자소서·면접 AI 모두 출시됨 (면접은 2026-08-07) */}
              <div className="bg-brand/5 border border-brand/15 rounded-lg px-4 py-3 text-xs text-text-tertiary leading-relaxed">
                <span className="text-brand font-medium">PC에서 —</span>{' '}
                {hiAI('자소서 작성과 AI 초안·첨삭을 도와드려요.')}{' '}
                모바일에서는 쓴 내용을 볼 수 있어요.
              </div>
          </div>
            {/*
              🔴 **마지막 스크린샷도 실물로** (2026-08-09). 라이트 모드에서 이 이미지만
              다크로 박혀 있어 아래 실물 컴포넌트들과 확연히 어긋났다.
              `preview` 는 참조 경험 조회를 끈다 — 비로그인 방문자에게 401 이 나가지 않게.
            */}
            {/*
              🔴 **자소서 화면 그대로** (2026-08-09 CEO) — 문항 카드 하나만 떼면
              "AI 와 같이 쓴다" 가 안 보인다. 실제 페이지는 왼쪽에 문항·답변이 쌓이고
              오른쪽 360px 에 AI 패널이 붙는 2열이다(`CoverletterDocPage` 와 같은 격자).
              오른쪽은 **대화가 채워진 상태** — 빈 패널은 이 기능이 뭘 하는지 못 보여준다.
            */}
            {/*
              🔴 **모바일엔 이 2열이 존재하지 않는다.** AI 채팅 패널은 실제 앱에서
              `hidden lg:flex` — 데스크탑 전용이다. 좁은 화면에 2열을 그리면
              **없는 화면을 광고하는 셈**이라, 모바일은 문항 카드만 쌓는다.
              (섹션 문구가 이미 `"자소서 작성과 AI 는 PC에서"` 라고 밝히고 있다)
            */}
            <ScaledPreview width={compact ? 390 : 1120} label="자소서 탭">
              <div
                className={
                  compact
                    ? 'p-3'
                    : 'grid grid-cols-[minmax(0,1fr)_360px] gap-[22px] p-4'
                }
              >
                <div className="space-y-3">
                  {LANDING_COVERLETTERS.slice(0, compact ? 2 : 3).map((c, i) => (
                    <CoverletterQuestionCard
                      key={c.id}
                      cl={c}
                      number={i + 1}
                      applicationId="hero-4"
                      expanded={i === 0}
                      onToggle={noop}
                      onUpdate={noop}
                      onDelete={noop}
                      onAskAI={noop}
                      preview
                      /*
                        🔴 **모바일은 보기 전용이다** (2026-08-09 검수). 제품의 모바일 자소서는
                        `useCoverletterReadOnly`(lg 미만) 로 **편집·AI 요소가 아예 없다.**
                        그런데 여기선 유형 select·글자수 input·편집 textarea·「AI 에게 묻기」가
                        그대로 그려져, 바로 위 문구(`"PC에서 작성하고, 모바일로 다시 볼 수 있어요"`)와
                        **한 화면 안에서 정반대**를 말하고 있었다.
                      */
                      readOnly={compact}
                    />
                  ))}
                </div>
                {!compact && (
                  <aside className="bg-card border border-line rounded-[14px] p-3.5 h-fit">
                    <p className="text-text-primary text-sm font-semibold mb-3">AI</p>
                    <div className="space-y-3">
                      {LANDING_CHAT.map((m) => (
                        <MessageBubble
                          key={m.id}
                          message={m}
                          clMap={LANDING_CL_MAP}
                          appliedUpdateKeys={EMPTY_KEYS}
                          onApply={noop}
                          onReject={noop}
                          onBulkApply={noop}
                        />
                      ))}
                    </div>
                  </aside>
                )}
              </div>
            </ScaledPreview>
        </div>
      </section>

      {/* 섹션④ — AI 티저 */}
      <section className="border-t border-line bg-surface py-20">
        {/* 그림 2장이 원본 크기(348 + 788)로 들어가야 글씨가 안 뭉갠다 */}
        <div className="max-w-3xl lg:max-w-[1180px] mx-auto px-6 text-center">
          {/*
            🔴 **이 섹션은 「면접」이다** (2026-08-09 CEO). 예전 제목은 `"AI가 서류부터 면접까지"` —
            **기능 축**이라 바로 위 자소서 섹션(대상 축)과 축이 달랐고, 그래서 자소서 AI 가
            세 군데서 소개됐다(자소서 섹션 PC 안내 · 자소서 미리보기 · 여기 카드 2장).

            축을 대상으로 통일해 자소서 AI 는 자소서 섹션이 온전히 맡고, 여기는 면접만 맡는다.
            `"AI가 서류부터 면접까지"` 라는 한 문장은 잃지만, **히어로 칩**(`AI 자소서` · `AI 면접 준비`)이
            이미 그 역할을 한다.

            🔴 자소서·면접 AI 는 **이미 출시돼 있다** (자소서 2026-07 재공개 · 면접 2026-08-07).
            없는 기능으로 안내하지 않도록, 새 AI 기능을 낼 때 이 섹션 문구도 같이 본다.
          */}
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 break-keep">
            내 자소서를 읽고<br />면접 질문을 뽑아줍니다
          </h2>
          <p className="text-text-tertiary text-sm max-w-md mx-auto leading-relaxed mb-10 break-keep">
            {hiAI('회사·직무와 내가 쓴 답변에서 AI 가 나올 법한 질문을 만듭니다. 지어내지 않아요.')}
            <br />
            <span className="text-text-quaternary">
              면접 준비는 PC에서 쓸 수 있어요.
            </span>
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-3xl mx-auto mb-2">
            {[
              { t: '예상 질문 20문항', d: '자기소개·직무·자소서 기반까지 종류별로 뽑아줘요.' },
              { t: '꼬리질문', d: '내가 쓴 답을 파고드는 질문까지 이어서 만들어요.' },
              { t: 'AI 예상 답변', d: '막히면 예시 답변을 만들고, 말하면 몇 초인지도 알려줘요.' },
            ].map(({ t, d }) => (
              <li key={t} className="bg-surface-2 border border-line rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-1.5">{hiAI(t)}</h3>
                <p className="text-xs text-text-quaternary leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>

          {/*
            🔴 **AI 섹션에 그림이 하나도 없었다** (2026-08-09). 카드 3장이 전부 글이라
            "예상 질문을 뽑아줘요" 가 무슨 화면인지 알 방법이 없었고, 히어로에서
            「AI 면접 준비」를 내걸면서 **약속만 하고 보여주지는 않는 상태**가 됐다.

            그림은 **데모에서 떴다** — 어제 5개사 면접 데이터를 채워 넣은 덕에 실사용자 자료가
            섞이지 않으면서도 진짜 화면이다. 좌측 패널은 접고 찍었다(회사 조사가 비어 있고
            AI 주의 문구가 빨갛게 뜬다).
          */}
          {/*
            🔴 **AI 섹션에 그림이 하나도 없었다** (2026-08-09). 카드 3장이 전부 글이라
            "예상 질문을 뽑아줘요" 가 무슨 화면인지 알 방법이 없었다.

            🔴 **스크린샷이 아니라 실제 컴포넌트다** (2026-08-09). 이미지는 UI 가 바뀌는
            순간 조용히 낡고 다크 모드에 박제된다. `MessageBubble`·`InterviewQuestionCard` 는
            **props 만 받고 query 훅이 없어**(패널·페이지 본체와 달리) 여기서 그대로 쓸 수 있다.
            면접은 `readOnly` — 코인 쓰는 버튼이 빠진 **읽기 모드** 그대로다.
          */}
          <div className="mt-10 text-left">
            
            <ScaledPreview width={compact ? 390 : 1028} label="면접 준비 — 예상 질문과 AI 답변">
              <div className={compact ? 'p-3 space-y-3' : 'p-4 space-y-3'}>
                {LANDING_QUESTIONS.slice(0, compact ? 1 : 2).map((q, i) => (
                  <InterviewQuestionCard
                    key={q.id}
                    question={q}
                    sessionId="lp-s1"
                    applicationId="hero-4"
                    questionNo={i + 1}
                    readOnly
                    forceAnswerOpen
                  />
                ))}
              </div>
            </ScaledPreview>
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
              className="inline-flex items-center justify-center w-full sm:w-auto bg-brand hover:bg-brand-hover active:bg-brand-hover text-bg font-semibold text-sm px-8 py-3.5 rounded-xl transition-colors shadow-[0_0_24px_rgba(107,156,127,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-card hover:bg-card active:bg-card-strong border border-line text-text-secondary hover:text-text-primary font-medium text-sm rounded-xl px-8 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
          {/*
            🔴 **푸터 링크가 높이 16px 이었다** (2026-08-09 uiux) — 44px 기준의 3분의 1이라
            모바일에서 정확히 누르기 어렵다. 글자는 그대로 두고 세로 영역만 넓히고,
            늘어난 높이만큼 `gap` 을 줄여 줄 간격이 벌어지지 않게 한다.
          */}
          <div className="flex items-center gap-x-5 gap-y-0 flex-wrap justify-center">
            {/* 정적 가이드·도구 페이지 (public/guide) — React 라우트가 아니라 a 태그 */}
            <a href="/guide/" className="inline-flex items-center min-h-[44px] px-1 rounded hover:text-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">가이드 · 도구</a>
            <Link to="/terms" className="inline-flex items-center min-h-[44px] px-1 rounded hover:text-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">이용약관</Link>
            <Link to="/privacy" className="inline-flex items-center min-h-[44px] px-1 rounded hover:text-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">개인정보처리방침</Link>
            <a
              href="mailto:support@chwippo.com?subject=회사 정보 삭제 요청&body=삭제 요청 회사명:%0A요청 사유:%0A요청자 정보 (회사 측 담당자):"
              className="inline-flex items-center min-h-[44px] px-1 rounded hover:text-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
