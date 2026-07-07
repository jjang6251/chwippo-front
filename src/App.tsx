import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from '@/components/common/ToastContainer'
import { CelebrationOverlay } from '@/components/common/CelebrationOverlay'
import { FirstCardCelebration } from '@/components/common/FirstCardCelebration'
import { FailedCareOverlay } from '@/components/card/FailedCareOverlay'
import { AiConsentRequiredModal } from '@/components/common/AiConsentRequiredModal'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AiFeatureGuard } from '@/components/auth/AiFeatureGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { AppShell } from '@/components/layout/AppShell'
import { DemoShell } from '@/components/demo/DemoShell'
import { DemoRouteGuard } from '@/components/demo/DemoRouteGuard'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { LoginCallback } from '@/pages/LoginCallback'
import { SignupQuestion } from '@/pages/SignupQuestion'
import { Dashboard } from '@/pages/Dashboard'
import { Board } from '@/pages/Board'
import { BoardDetail } from '@/pages/BoardDetail'
import { StepPage } from '@/pages/StepPage'
import { Calendar } from '@/pages/Calendar'
import { MyInfo } from '@/pages/MyInfo'
import { InquiryList } from '@/pages/inquiry/InquiryList'
import { InquiryNew } from '@/pages/inquiry/InquiryNew'
import { InquiryDetail } from '@/pages/inquiry/InquiryDetail'
import { Privacy } from '@/pages/Privacy'
import { Terms } from '@/pages/Terms'
import { NotFound } from '@/pages/NotFound'
import { Settings } from '@/pages/settings/Settings'
import { AlarmSettings } from '@/pages/settings/AlarmSettings'
import { Notifications } from '@/pages/Notifications'
import { ProfileSettings } from '@/pages/settings/ProfileSettings'
import { Help } from '@/pages/settings/Help'
import { OpsPage } from '@/pages/ops/OpsPage'
import { OpsInquiries } from '@/pages/ops/OpsInquiries'
import { OpsAnnouncements } from '@/pages/ops/OpsAnnouncements'
import { OpsUsers } from '@/pages/ops/OpsUsers'
import { UserDetailPage } from '@/pages/ops/UserDetailPage'
import { TermsAgreement } from '@/pages/TermsAgreement'
import { ActivityPage } from '@/pages/Activity/ActivityPage'
import { ActivityTimelinePage } from '@/pages/Activity/timeline/ActivityTimelinePage'
import { NotePage } from '@/pages/Activity/NotePage'
import { InsightsPage } from '@/pages/Activity/InsightsPage'
import { Coverletters } from '@/pages/Coverletters'
import { CoverletterDocPage } from '@/pages/Coverletter/CoverletterDocPage'
import { Interviews } from '@/pages/Interviews'
import { InterviewSessionPage } from '@/pages/InterviewSessionPage'
import { AiUsage } from '@/pages/Admin/AiUsage'
import { AiQuotas } from '@/pages/Admin/AiQuotas'
import { AuditLogs } from '@/pages/Admin/AuditLogs'
import { CompanyResearchMetrics } from '@/pages/Admin/CompanyResearchMetrics'
import { Monitoring } from '@/pages/Admin/Monitoring'
import { AdminLayout } from '@/components/layout/AdminLayout'

export default function App() {
  return (
    <BrowserRouter>
      <DemoRouteGuard />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* 데모 모드 — 로그인 불필요, 샘플 데이터(읽기 전용) */}
        <Route path="/demo" element={<DemoShell />}>
          <Route index element={<Navigate to="/demo/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="board" element={<Board />} />
          <Route path="board/:id" element={<BoardDetail />} />
          <Route path="board/:id/steps/:stepId" element={<StepPage />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="myinfo" element={<MyInfo />} />
          <Route path="*" element={<Navigate to="/demo/dashboard" replace />} />
        </Route>
        <Route element={<AuthGuard />}>
          <Route path="/terms-agreement" element={<TermsAgreement />} />
          {/* W1 — signup 1 질문 (관심 직군). onboardedAt null 시 LoginCallback 가 redirect */}
          <Route path="/signup/question" element={<SignupQuestion />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/board" element={<Board />} />
            <Route path="/board/:id" element={<BoardDetail />} />
            <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/myinfo" element={<MyInfo />} />
            <Route path="/inquiry" element={<InquiryList />} />
            <Route path="/inquiry/new" element={<InquiryNew />} />
            <Route path="/inquiry/:id" element={<InquiryDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/alarm" element={<AlarmSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/help" element={<Help />} />
            {/* activity-redesign — 기본 화면 = 날짜 타임라인, 관리는 /activity/manage */}
            <Route path="/activity" element={<ActivityTimelinePage />} />
            <Route path="/activity/manage" element={<ActivityPage />} />
            <Route path="/activity/insights" element={<InsightsPage />} />
            {/* AI 기능 라우트 — VITE_AI_FEATURES_ENABLED=false 시 dashboard redirect */}
            <Route element={<AiFeatureGuard />}>
              <Route path="/coverletters" element={<Coverletters />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route
                path="/interviews/:sessionId"
                element={<InterviewSessionPage />}
              />
              {/* A1 3경로 UI 는 AI 재활성화(useAiEnabled=true) 때 공개 — 베타는 자소서 진입점 전체 숨김 유지 */}
              <Route
                path="/board/:applicationId/coverletter"
                element={<CoverletterDocPage />}
              />
            </Route>
            <Route
              path="/activity/:activityId/logs/:logId/note"
              element={<NotePage />}
            />
          </Route>
          <Route element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route path="/ops" element={<OpsPage />} />
              <Route path="/ops/inquiries" element={<OpsInquiries />} />
              <Route path="/ops/announcements" element={<OpsAnnouncements />} />
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
                path="/ops/company-research-metrics"
                element={<CompanyResearchMetrics />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer />
      <CelebrationOverlay />
      <FirstCardCelebration />
      <FailedCareOverlay />
      <AiConsentRequiredModal />
    </BrowserRouter>
  )
}
