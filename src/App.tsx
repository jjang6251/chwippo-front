import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastContainer } from '@/components/common/ToastContainer'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { AppShell } from '@/components/layout/AppShell'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { LoginCallback } from '@/pages/LoginCallback'
import { Dashboard } from '@/pages/Dashboard'
import { Board } from '@/pages/Board'
import { BoardDetail } from '@/pages/BoardDetail'
import { MyInfo } from '@/pages/MyInfo'
import { Inquiry } from '@/pages/Inquiry'
import { Privacy } from '@/pages/Privacy'
import { Terms } from '@/pages/Terms'
import { NotFound } from '@/pages/NotFound'
import { Settings } from '@/pages/settings/Settings'
import { AlarmSettings } from '@/pages/settings/AlarmSettings'
import { ProfileSettings } from '@/pages/settings/ProfileSettings'
import { Help } from '@/pages/settings/Help'
import { OpsPage } from '@/pages/ops/OpsPage'
import { OpsInquiries } from '@/pages/ops/OpsInquiries'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route element={<AuthGuard />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/board" element={<Board />} />
            <Route path="/board/:id" element={<BoardDetail />} />
            <Route path="/myinfo" element={<MyInfo />} />
            <Route path="/inquiry" element={<Inquiry />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/alarm" element={<AlarmSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/help" element={<Help />} />
          </Route>
          <Route element={<AdminGuard />}>
            <Route path="/ops" element={<OpsPage />} />
            <Route path="/ops/inquiries" element={<OpsInquiries />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
