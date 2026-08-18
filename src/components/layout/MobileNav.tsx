import { Link, useLocation } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'
import { useAuthStore } from '@/stores/authStore'

// 캘린더 UX 재구성 — 캘린더가 홈. 대시보드는 "회고" 페이지로 강등
/**
 * 🔴 **탭 스왑: 내정보 → 공부 노트** (CEO 결정 3, 2026-08-18).
 *
 * 탭은 **지금 얼마나 쓰는지**가 아니라 **어떤 쓰임을 원하는지**로 정한다. 내 정보 창고는
 * 한 번 채우고 자소서 쓸 때 꺼내 쓰는 창고라 매일 열 자리가 아니고(설정 안 항목 +
 * `/myinfo` 라우트·CTA 는 그대로 산다), 공부 노트는 매일 열려야 하는 습관 표면이다.
 */
const TABS = [
  { label: '캘린더', path: '/calendar', icon: CalendarIcon },
  { label: '보드', path: '/board', icon: BoardIcon },
  { label: '활동 일지', path: '/activity', icon: JournalIcon },
  { label: '공부 노트', path: '/study-notes', icon: StudyNoteIcon },
  { label: '회고', path: '/dashboard', icon: GridIcon },
] as const

/**
 * 🔴 **데모는 기존 5탭을 유지한다.** 공부 노트는 `/demo/study-notes` 라우트도 샘플 데이터도
 * 없다 — 스왑까지 데모에 적용하면 메뉴가 광고하는 곳에 갈 수 없게 되고, 그건 사이드바에서
 * 이미 한 번 겪은 사고다 (2026-08-08 면접 준비). 데모가 준비되면 이 배열을 지우면 된다.
 */
const DEMO_TABS = [
  { label: '캘린더', path: '/calendar', icon: CalendarIcon },
  { label: '보드', path: '/board', icon: BoardIcon },
  { label: '활동 일지', path: '/activity', icon: JournalIcon },
  { label: '내정보', path: '/myinfo', icon: StorageIcon },
  { label: '회고', path: '/dashboard', icon: GridIcon },
] as const

export function MobileNav() {
  const location = useLocation()
  const isDemo = useDemoMode()
  const user = useAuthStore((s) => s.user)
  const link = (p: string) => (isDemo ? '/demo' + p : p)

  const baseTabs = isDemo ? DEMO_TABS : TABS
  const tabs = (!isDemo && user?.role === 'admin')
    ? [...baseTabs, { label: '관리자', path: '/ops', icon: AdminIcon }]
    : baseTabs

  const isActive = (path: string) => {
    if (path === '/ops') return location.pathname.startsWith('/ops')
    const target = link(path)
    if (path === '/board') return location.pathname.startsWith(target)
    if (path === '/activity') return location.pathname.startsWith(target)
    // 문서 페이지(/study-notes/:id)에서도 탭이 켜져 있어야 한다
    if (path === '/study-notes') return location.pathname.startsWith(target)
    return location.pathname === target
  }

  return (
    <nav data-nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line flex safe-area-pb">
      {tabs.map(({ label, path, icon: Icon }) => {
        const active = isActive(path)
        const href = path === '/ops' ? '/ops' : link(path)
        return (
          <Link
            key={path}
            to={href}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
          >
            <span className={active ? 'text-brand' : 'text-text-quaternary'}>
              <Icon size={20} />
            </span>
            <span className={`text-[10px] font-medium ${active ? 'text-brand' : 'text-text-quaternary'}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function BoardIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="3.5" rx="1" />
      <rect x="2" y="8.5" width="16" height="3.5" rx="1" />
      <rect x="2" y="14" width="10" height="3.5" rx="1" />
    </svg>
  )
}

function StorageIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v1.5H3V5z" />
      <path d="M3 6.5h14v8.5a2 2 0 01-2 2H5a2 2 0 01-2-2V6.5z" />
      <line x1="6.5" y1="11" x2="13.5" y2="11" />
    </svg>
  )
}

/** 공부 노트 — 펼친 공책. viewBox 만 24 라 stroke 를 1.8 로 맞춰 다른 탭과 굵기가 같아 보인다 */
function StudyNoteIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function JournalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h9a2 2 0 012 2v12a1 1 0 01-1 1H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <line x1="6.5" y1="7" x2="12.5" y2="7" />
      <line x1="6.5" y1="10" x2="12.5" y2="10" />
      <line x1="6.5" y1="13" x2="10" y2="13" />
    </svg>
  )
}

function CalendarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="16" height="14" rx="2" />
      <line x1="2" y1="8.5" x2="18" y2="8.5" />
      <line x1="6.5" y1="1.5" x2="6.5" y2="5.5" />
      <line x1="13.5" y1="1.5" x2="13.5" y2="5.5" />
      <circle cx="10" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function AdminIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2l2 4 4.5.7-3.2 3.1.8 4.5L10 12l-4.1 2.3.8-4.5L3.5 6.7 8 6z" />
    </svg>
  )
}
