import { useState } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useActiveAnnouncements } from '@/hooks/useActiveAnnouncements'
import { useAuthStore } from '@/stores/authStore'
import { AnnouncementBanner } from './AnnouncementBanner'
import { AnnouncementModal } from './AnnouncementModal'

const DISMISS_KEY = (userId: string, id: string) => `dismissed_announcement_${userId}_${id}`

function isDismissed(userId: string, id: string): boolean {
  try { return localStorage.getItem(DISMISS_KEY(userId, id)) === '1' } catch { return false }
}

/**
 * 지금 살아 있는 공지들을 자리에 꽂는다 — **모달 1 + 배너 1 을 동시에** 띄운다.
 *
 * 예전엔 서버가 통틀어 1건만 내려줘서, 모달 공지가 하나 켜져 있으면 상시 배너가 통째로
 * 가려졌다(둘은 성격이 다른 자리다 — 배너는 「계속 붙어 있는 안내」, 모달은 「한 번 읽히는 발표」).
 *
 * 🔴 dismiss 는 **공지마다 따로** 기억한다. 모달을 닫았다고 배너가 같이 사라지면
 * 안 읽은 안내가 조용히 없어진다.
 */
export function AnnouncementContainer() {
  const isDemo = useDemoMode()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data } = useActiveAnnouncements()
  /** 이번 세션에 닫은 것들 — localStorage 기록과 합쳐서 본다 */
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  /** 배너를 눌러 펼친 상태 */
  const [expanded, setExpanded] = useState(false)

  // LRR P1T3 PR K L-4 — auth 로딩 윈도우(userId='') 동안 dismiss 키 오염 차단.
  // 빈 userId로 dismiss 키 만들어두면 다른 유저 로그인 직후 같은 ''로 매칭될 수 있음.
  if (!userId || isDemo) return null

  /*
    🔴 `Array.isArray` 로 한 겹 받는다. 프론트·백은 따로 배포되므로 **배열 계약 이전의
    백엔드**(단건 객체)가 새 프론트에 닿는 창이 실제로 존재한다. 거기서 `.filter` 를 부르면
    AppShell 이 통째로 죽어 로그인 후 모든 화면이 백지가 된다 — 공지 하나 못 보는 것과
    비교가 안 된다.
  */
  const visible = (Array.isArray(data) ? data : []).filter(
    (a) => !dismissedIds.includes(a.id) && !isDismissed(userId, a.id),
  )
  const modalItem = visible.find((a) => a.type === 'modal') ?? null
  const bannerItem = visible.find((a) => a.type === 'banner') ?? null

  function handleDismiss(id: string) {
    try { localStorage.setItem(DISMISS_KEY(userId, id), '1') } catch { /* ignore */ }
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setExpanded(false)
  }

  /*
    모달은 한 번에 하나다. 모달 공지가 있으면 그게 앞이고, 없을 때만 배너를 펼친 모달이 뜬다
    (겹쳐 띄우면 뒤쪽 오버레이가 앞쪽을 어둡게 덮어 글자가 안 읽힌다).
  */
  const openModal = modalItem ?? (expanded && bannerItem ? bannerItem : null)

  if (!bannerItem && !openModal) return null

  return (
    <>
      {bannerItem && (
        <AnnouncementBanner
          title={bannerItem.title}
          body={bannerItem.body}
          kind={bannerItem.kind}
          onExpand={() => setExpanded(true)}
          onDismiss={() => handleDismiss(bannerItem.id)}
        />
      )}
      {openModal && (
        <AnnouncementModal
          key={openModal.id}
          title={openModal.title}
          body={openModal.body}
          kind={openModal.kind}
          ctaLabel={openModal.cta_label}
          ctaPath={openModal.cta_path}
          onDismiss={() => handleDismiss(openModal.id)}
        />
      )}
    </>
  )
}
