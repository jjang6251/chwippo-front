import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from '@/components/common/ToastContainer'
import { PostingCardHost } from '@/components/board/PostingCardHost'
import { CelebrationOverlay } from '@/components/common/CelebrationOverlay'
import { FirstCardCelebration } from '@/components/common/FirstCardCelebration'
import { FailedCareOverlay } from '@/components/card/FailedCareOverlay'
import { AiConsentRequiredModal } from '@/components/common/AiConsentRequiredModal'
import { JobTitleRequiredModal } from '@/components/common/JobTitleRequiredModal'
import { ClarityMask } from '@/components/common/ClarityMask'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AiFeatureGuard, InterviewAiGuard } from '@/components/auth/AiFeatureGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { AppShell } from '@/components/layout/AppShell'
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { RouteFallback } from '@/components/common/RouteFallback'
import { DemoRouteGuard } from '@/components/demo/DemoRouteGuard'
import { RouteMeta } from '@/components/layout/RouteMeta'
import { MetaPixelPageView } from '@/components/layout/MetaPixelPageView'
import { lazyWithReload } from '@/utils/lazyWithReload'
// ── 첫 진입 코어 (eager) ────────────────────────────────────────────────
// 홈(캘린더)·보드·로그인·온보딩·설정·문의 등 로그인 직후 흔히 닿는 화면은 즉시 로드해
// 첫 화면 체감 손해를 막는다.
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { LoginCallback } from '@/pages/LoginCallback'
import { SignupQuestion } from '@/pages/SignupQuestion'
import { Tour } from '@/pages/Tour'
import { Board } from '@/pages/Board'
import { BoardDetail } from '@/pages/BoardDetail'
import { Calendar } from '@/pages/Calendar'
import { MyInfo } from '@/pages/MyInfo'
import { InquiryList } from '@/pages/inquiry/InquiryList'
import { InquiryNew } from '@/pages/inquiry/InquiryNew'
import { InquiryDetail } from '@/pages/inquiry/InquiryDetail'
import { Privacy } from '@/pages/Privacy'
import { Terms } from '@/pages/Terms'
import { AccountDeletion } from '@/pages/AccountDeletion'
import { NotFound } from '@/pages/NotFound'
import { Settings } from '@/pages/settings/Settings'
import { AlarmSettings } from '@/pages/settings/AlarmSettings'
import { Notifications } from '@/pages/Notifications'
import { ProfileSettings } from '@/pages/settings/ProfileSettings'
import { Help } from '@/pages/settings/Help'
import { ExtensionSettings } from '@/pages/settings/ExtensionSettings'
import { TermsAgreement } from '@/pages/TermsAgreement'
// ── code-split (lazy) ──────────────────────────────────────────────────
// 일반 유저가 첫 로드에 절대 필요 없는 화면 + 무거운 라이브러리(recharts·tiptap) 사용처.
// admin(/ops/*) 전체, 자소서·활동·회고(recharts)·면접·데모 모드.
const Dashboard = lazyWithReload(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const StepPage = lazyWithReload(() =>
  import('@/pages/StepPage').then((m) => ({ default: m.StepPage })),
)
const Coverletters = lazyWithReload(() =>
  import('@/pages/Coverletters').then((m) => ({ default: m.Coverletters })),
)
const CoverletterDocPage = lazyWithReload(() =>
  import('@/pages/Coverletter/CoverletterDocPage').then((m) => ({
    default: m.CoverletterDocPage,
  })),
)
const ActivityPage = lazyWithReload(() =>
  import('@/pages/Activity/ActivityPage').then((m) => ({
    default: m.ActivityPage,
  })),
)
const ActivityTimelinePage = lazyWithReload(() =>
  import('@/pages/Activity/timeline/ActivityTimelinePage').then((m) => ({
    default: m.ActivityTimelinePage,
  })),
)
const NotePage = lazyWithReload(() =>
  import('@/pages/Activity/NotePage').then((m) => ({ default: m.NotePage })),
)
const InsightsPage = lazyWithReload(() =>
  import('@/pages/Activity/InsightsPage').then((m) => ({
    default: m.InsightsPage,
  })),
)
// 공부 노트 — tiptap 확장 세트(코드 하이라이팅·표)를 끌고 오므로 lazy
const StudyNotesHub = lazyWithReload(() =>
  import('@/pages/StudyNotes/StudyNotesHub').then((m) => ({
    default: m.StudyNotesHub,
  })),
)
const StudyNoteDocPage = lazyWithReload(() =>
  import('@/pages/StudyNotes/StudyNoteDocPage').then((m) => ({
    default: m.StudyNoteDocPage,
  })),
)
const Interviews = lazyWithReload(() =>
  import('@/pages/Interviews').then((m) => ({ default: m.Interviews })),
)
const InterviewSessionPage = lazyWithReload(() =>
  import('@/pages/InterviewSessionPage').then((m) => ({
    default: m.InterviewSessionPage,
  })),
)
const InterviewPracticePage = lazyWithReload(() =>
  import('@/pages/InterviewPracticePage').then((m) => ({
    default: m.InterviewPracticePage,
  })),
)
const DemoShell = lazyWithReload(() =>
  import('@/components/demo/DemoShell').then((m) => ({ default: m.DemoShell })),
)
// admin(/ops/*) — 일반 유저 0% 사용
const AdminLayout = lazyWithReload(() =>
  import('@/components/layout/AdminLayout').then((m) => ({
    default: m.AdminLayout,
  })),
)
const OpsPage = lazyWithReload(() =>
  import('@/pages/ops/OpsPage').then((m) => ({ default: m.OpsPage })),
)
const OpsInquiries = lazyWithReload(() =>
  import('@/pages/ops/OpsInquiries').then((m) => ({ default: m.OpsInquiries })),
)
const OpsAnnouncements = lazyWithReload(() =>
  import('@/pages/ops/OpsAnnouncements').then((m) => ({
    default: m.OpsAnnouncements,
  })),
)
const OpsCardFields = lazyWithReload(() =>
  import('@/pages/ops/OpsCardFields').then((m) => ({ default: m.OpsCardFields })),
)
const OpsFeatureUsage = lazyWithReload(() =>
  import('@/pages/ops/OpsFeatureUsage').then((m) => ({
    default: m.OpsFeatureUsage,
  })),
)
const OpsReach = lazyWithReload(() =>
  import('@/pages/ops/OpsReach').then((m) => ({ default: m.OpsReach })),
)
const OpsUsers = lazyWithReload(() =>
  import('@/pages/ops/OpsUsers').then((m) => ({ default: m.OpsUsers })),
)
const UserDetailPage = lazyWithReload(() =>
  import('@/pages/ops/UserDetailPage').then((m) => ({
    default: m.UserDetailPage,
  })),
)
const OpsCompanyResearchPage = lazyWithReload(() =>
  import('@/pages/ops/OpsCompanyResearchPage').then((m) => ({
    default: m.OpsCompanyResearchPage,
  })),
)
const AiUsage = lazyWithReload(() =>
  import('@/pages/Admin/AiUsage').then((m) => ({ default: m.AiUsage })),
)
const AiQuotas = lazyWithReload(() =>
  import('@/pages/Admin/AiQuotas').then((m) => ({ default: m.AiQuotas })),
)
const AuditLogs = lazyWithReload(() =>
  import('@/pages/Admin/AuditLogs').then((m) => ({ default: m.AuditLogs })),
)
const Monitoring = lazyWithReload(() =>
  import('@/pages/Admin/Monitoring').then((m) => ({ default: m.Monitoring })),
)

export default function App() {
  return (
    <BrowserRouter>
      {/* 라우트별 title·canonical·OG 갱신 — 없으면 sitemap 의 8개 URL 이
          전부 "표준 주소는 홈" 이라고 선언한다 (`utils/routeMeta.ts` 참조) */}
      <RouteMeta />
      {/* 라우트 변경마다 Meta Pixel PageView — SPA 는 문서를 다시 로드하지 않아
          표준 스니펫만으로는 방문당 1건에 그친다 (`lib/metaPixel.ts` 참조). `/ops/*` 는 제외 */}
      <MetaPixelPageView />
      <DemoRouteGuard />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* Google Play 데이터 보안 요건 — 로그인 없이 열려야 한다 (Play Console 등록 URL) */}
        <Route path="/account-deletion" element={<AccountDeletion />} />
        {/* 데모 모드 — 로그인 불필요, 샘플 데이터(읽기 전용). DemoShell 은 lazy →
            상위 레이아웃이 없어 여기서 Suspense 로 감싼다. */}
        <Route
          path="/demo"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DemoShell />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="/demo/calendar" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="board" element={<Board />} />
          <Route path="board/:id" element={<BoardDetail />} />
          <Route path="board/:id/steps/:stepId" element={<StepPage />} />
          {/* 자소서 문서 풀페이지 — AI 버튼은 demoAdapter 가 차단(가입 모달). 라우트만 데모 대응 */}
          <Route
            path="board/:applicationId/coverletter"
            element={<CoverletterDocPage />}
          />
          <Route path="calendar" element={<Calendar />} />
          <Route path="activity" element={<ActivityTimelinePage />} />
          <Route path="activity/manage" element={<ActivityPage />} />
          <Route path="coverletters" element={<Coverletters />} />
          {/* 면접 준비 — 샘플 세션 1개(카카오 1차 기술면접). AI 버튼은 demoAdapter 가 차단(가입 모달) */}
          <Route path="interviews" element={<Interviews />} />
          <Route path="interviews/:sessionId" element={<InterviewSessionPage />} />
          {/* 면접 보기 — 뒤로가기=종료라 세션과 나란한 별도 주소다 */}
          <Route
            path="interviews/:sessionId/practice"
            element={<InterviewPracticePage />}
          />
          <Route path="myinfo" element={<MyInfo />} />
          {/* 설정 — 실서비스 Settings 골격 재사용. 데모 컨텍스트(useDemoMode)에서
              변경 항목은 가입 모달로 잠금, 테마는 실동작(무백엔드). demoAdapter 로 API 0 유지. */}
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/demo/calendar" replace />} />
        </Route>
        <Route element={<AuthGuard />}>
          <Route path="/terms-agreement" element={<TermsAgreement />} />
          {/* W1 — signup 1 질문 (관심 직군). onboardedAt null 시 LoginCallback 가 redirect */}
          <Route path="/signup/question" element={<SignupQuestion />} />
          {/*
            앱 소개 투어 — 온보딩 직후 자동 재생 7장 (`plans/app-tour.md`).
            🔴 `AppShell` **밖**이다 (온보딩과 같은 자리). 안에 두면 사이드바·하단 탭과
            코인 모달이 함께 떠서, 오버레이를 흡수하려고 만든 화면이 오버레이 위에 서게 된다.
          */}
          <Route path="/signup/tour" element={<Tour />} />
          <Route element={<RouteErrorBoundary><AppShell /></RouteErrorBoundary>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/board" element={<Board />} />
            <Route path="/board/:id" element={<BoardDetail />} />
            <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
            <Route path="/calendar" element={<Calendar />} />
            {/* Clarity 마스킹 경계 — 방침 §5-2 의 "민감 화면 마스킹" 약속을 이행하는 곳.
                라우트에서 감싸야 로딩·에러·빈 상태 등 다른 렌더 분기까지 전부 덮인다. */}
            <Route element={<ClarityMask />}>
              <Route path="/myinfo" element={<MyInfo />} />
              <Route path="/activity" element={<ActivityTimelinePage />} />
              <Route path="/activity/manage" element={<ActivityPage />} />
              <Route path="/activity/insights" element={<InsightsPage />} />
              {/* 공부 노트 — 본문이 개인 학습 자료라 준비 노트와 같은 마스킹 정책 */}
              <Route path="/study-notes" element={<StudyNotesHub />} />
              <Route path="/study-notes/:id" element={<StudyNoteDocPage />} />
              <Route element={<AiFeatureGuard />}>
                <Route path="/coverletters" element={<Coverletters />} />
                <Route
                  path="/board/:applicationId/coverletter"
                  element={<CoverletterDocPage />}
                />
              </Route>
              {/* 문의 — 개인적 서술이 들어갈 수 있어 마스킹 대상 */}
              <Route path="/inquiry" element={<InquiryList />} />
              <Route path="/inquiry/new" element={<InquiryNew />} />
              <Route path="/inquiry/:id" element={<InquiryDetail />} />
              {/* 연결된 확장 — 화면에 **페어링 코드(60초짜리 자격증명)** 와 기기 지문이 뜬다.
                  세션 리플레이에 남으면 녹화를 보는 사람이 그 창 안에서 남의 확장을 붙일 수 있다. */}
              <Route path="/settings/extension" element={<ExtensionSettings />} />
            </Route>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/alarm" element={<AlarmSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/help" element={<Help />} />
            {/* 면접 AI 라우트 — 비공개 유지 (useInterviewAiEnabled) */}
            <Route element={<InterviewAiGuard />}>
              <Route path="/interviews" element={<Interviews />} />
              <Route
                path="/interviews/:sessionId"
                element={<InterviewSessionPage />}
              />
              {/* 면접 보기 — 뒤로가기=종료라 세션과 나란한 별도 주소다 */}
              <Route
                path="/interviews/:sessionId/practice"
                element={<InterviewPracticePage />}
              />
            </Route>
            <Route
              path="/activity/:activityId/logs/:logId/note"
              element={<NotePage />}
            />
          </Route>
          <Route element={<AdminGuard />}>
            {/* AdminLayout 은 lazy — 상위 shell 밖(AppShell 형제)이라 여기서 Suspense 로 감싼다. */}
            <Route
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AdminLayout />
                </Suspense>
              }
            >
              <Route path="/ops" element={<OpsPage />} />
              <Route path="/ops/inquiries" element={<OpsInquiries />} />
              <Route path="/ops/announcements" element={<OpsAnnouncements />} />
              <Route path="/ops/reach" element={<OpsReach />} />
              <Route path="/ops/card-fields" element={<OpsCardFields />} />
              <Route path="/ops/feature-usage" element={<OpsFeatureUsage />} />
              <Route path="/ops/users" element={<OpsUsers />} />
              <Route path="/ops/users/:id" element={<UserDetailPage />} />
              <Route path="/ops/ai-usage" element={<AiUsage />} />
              <Route path="/ops/ai-quotas" element={<AiQuotas />} />
              <Route path="/ops/monitoring" element={<Monitoring />} />
              {/* 5.6.3 alias — alert-thresholds 구 라우트 호환성 */}
              <Route path="/ops/alert-thresholds" element={<Monitoring />} />
              {/* PR_B2 Phase 4 */}
              <Route path="/ops/audit-logs" element={<AuditLogs />} />
              <Route
                path="/ops/company-research"
                element={<OpsCompanyResearchPage />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/*
        공고 카드 뒤처리 — 모달·보드가 언마운트돼도 결과 시트·되돌리기 토스트는 뜬다.
        🔴 이건 **실서비스 스코프** 전용이다 (main.tsx 의 앱 QueryClient). 데모는 자기
        QueryClient 를 쓰므로 `DemoShell` 이 자기 호스트를 따로 마운트한다.
      */}
      <PostingCardHost />
      <ToastContainer />
      <CelebrationOverlay />
      <FirstCardCelebration />
      <FailedCareOverlay />
      <AiConsentRequiredModal />
      <JobTitleRequiredModal />
    </BrowserRouter>
  )
}
