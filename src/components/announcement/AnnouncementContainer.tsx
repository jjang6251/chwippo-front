import { useState } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useActiveAnnouncement } from '@/hooks/useActiveAnnouncement'
import { AnnouncementBanner } from './AnnouncementBanner'
import { AnnouncementModal } from './AnnouncementModal'

const DISMISS_KEY = (id: string) => `dismissed_announcement_${id}`

function isDismissed(id: string): boolean {
  try { return localStorage.getItem(DISMISS_KEY(id)) === '1' } catch { return false }
}

export function AnnouncementContainer() {
  const isDemo = useDemoMode()
  const { data: announcement } = useActiveAnnouncement()
  const [dismissed, setDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (isDemo || !announcement || isDismissed(announcement.id) || dismissed) return null

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY(announcement!.id), '1') } catch { /* ignore */ }
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
