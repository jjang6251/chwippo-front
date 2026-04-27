import { Outlet } from 'react-router-dom'

// M6에서 사이드바/탭바 포함한 완전한 레이아웃으로 교체
export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Outlet />
    </div>
  )
}
