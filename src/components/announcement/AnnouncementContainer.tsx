import { useState } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useActiveAnnouncement } from '@/hooks/useActiveAnnouncement'
import { useTourStore } from '@/stores/tourStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useAuthStore } from '@/stores/authStore'
import { AnnouncementBanner } from './AnnouncementBanner'
import { AnnouncementModal } from './AnnouncementModal'

const DISMISS_KEY = (userId: string, id: string) => `dismissed_announcement_${userId}_${id}`

function isDismissed(userId: string, id: string): boolean {
  try { return localStorage.getItem(DISMISS_KEY(userId, id)) === '1' } catch { return false }
}

export function AnnouncementContainer() {
  const isDemo = useDemoMode()
  const isTourActive = useTourStore((s) => s.active)
  const isOnboarding = useOnboardingStore((s) => s.show)
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: announcement } = useActiveAnnouncement()
  const [dismissed, setDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (isDemo || isTourActive || isOnboarding || !announcement || isDismissed(userId, announcement.id) || dismissed) return null

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY(userId, announcement!.id), '1') } catch { /* ignore */ }
    setDismissed(true)
    setShowModal(false)
  }

  if (announcement.type === 'modal') {
    return (
      <AnnouncementModal
        title={announcement.title}
        body={announcement.body}
        onDismiss={handleDismiss}
      />
    )
  }

  return (
    <>
      <AnnouncementBanner
        title={announcement.title}
        body={announcement.body}
        onExpand={() => setShowModal(true)}
        onDismiss={handleDismiss}
      />
      {showModal && (
        <AnnouncementModal
          title={announcement.title}
          body={announcement.body}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
