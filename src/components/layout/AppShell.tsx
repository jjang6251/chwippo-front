import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { MobileHeader } from './MobileHeader'
import { useDemoMode } from '@/contexts/demoMode'
import { DemoBanner } from '@/components/demo/DemoBanner'

export function AppShell() {
  const isDemo = useDemoMode()
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <MobileHeader />
          <main className="flex-1 pb-20 lg:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
