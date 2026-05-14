import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from '@/components/common/ToastContainer'
import { CelebrationOverlay } from '@/components/common/CelebrationOverlay'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { AppShell } from '@/components/layout/AppShell'
import { DemoShell } from '@/components/demo/DemoShell'
import { DemoRouteGuard } from '@/components/demo/DemoRouteGuard'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { LoginCallback } from '@/pages/LoginCallback'
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
import { ProfileSettings } from '@/pages/settings/ProfileSettings'
import { Help } from '@/pages/settings/Help'
import { OpsPage } from '@/pages/ops/OpsPage'
import { OpsInquiries } from '@/pages/ops/OpsInquiries'
import { OpsAnnouncements } from '@/pages/ops/OpsAnnouncements'
import { TermsAgreement } from '@/pages/TermsAgreement'

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
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/alarm" element={<AlarmSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/help" element={<Help />} />
          </Route>
          <Route element={<AdminGuard />}>
            <Route path="/ops" element={<OpsPage />} />
            <Route path="/ops/inquiries" element={<OpsInquiries />} />
            <Route path="/ops/announcements" element={<OpsAnnouncements />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer />
      <CelebrationOverlay />
    </BrowserRouter>
  )
}
