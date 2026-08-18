import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore, type Theme } from '@/stores/themeStore'
import { apiClient } from '@/api/client'
import { isInNativeApp, postToNative } from '@/utils/nativeBridge'
import { AppLockSection } from '@/pages/settings/AppLockSection'
import { useDemoMode } from '@/contexts/demoMode'
import { useDemoSignupStore } from '@/stores/demoSignupStore'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark', label: '다크', icon: '🌙' },
  { value: 'light', label: '라이트', icon: '☀️' },
  { value: 'system', label: '시스템', icon: '🖥️' },
]

/**
 * 🔴 **「내 정보 창고」가 맨 위다.** 하단 탭에서 공부 노트에 자리를 내주고 여기로 왔다
 * (CEO 결정 3). 늘 있던 자리에서 사라진 항목은 **찾을 수 있는 자리**에 있어야 하고,
 * 「이사왔어요」 뱃지가 "없어진 게 아니라 옮겼다" 를 한 번에 말한다.
 * 라우트(`/myinfo`)·다른 화면의 CTA 는 그대로라 직링크·즐겨찾기는 계속 동작한다.
 */
const MENU = [
  { label: '내 정보 창고', sub: '학력·자격증·경험 정리', path: '/myinfo', icon: '📦', badge: '이사왔어요' },
  { label: '프로필 설정', sub: '닉네임 변경, 계정 탈퇴', path: '/settings/profile', icon: '👤' },
  { label: '알림 설정', sub: '마감·면접 알림 (준비 중)', path: '/settings/alarm', icon: '🔔' },
  { label: '도움말', sub: '자주 묻는 질문', path: '/settings/help', icon: '❓' },
  { label: '문의하기', sub: '버그 신고, 기능 요청', path: '/inquiry', icon: '💬' },
] as const

export function Settings() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const navigate = useNavigate()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  // 데모(비로그인 미러) — 실서비스 골격 그대로, 계정/이동 항목은 가입 모달로 잠금(테마는 실동작).
  const isDemo = useDemoMode()
  const showDemoSignup = useDemoSignupStore((s) => s.show)

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch { /* 로그아웃 실패해도 클라이언트는 정리 */ }
    clearAuth()
    postToNative({ type: 'logout' })
    // 앱에선 화면 전환이 네이티브 소유 — 랜딩을 그리면 네이티브 전환 대기 동안 그대로 보인다
    if (!isInNativeApp()) navigate('/')
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <h1 className="text-xl font-bold mb-6">설정</h1>

      <div className="bg-surface-2 border border-line rounded-xl divide-y divide-line mb-4">
        {MENU
          /* 데모는 하단 탭에 「내정보」가 그대로 있다 (스왑 제외) — 여기 또 두면 중복이다 */
          .filter((item) => !isDemo || item.path !== '/myinfo')
          .map((item) => (
            <SettingsMenuRow
              key={item.path}
              icon={item.icon}
              label={item.label}
              sub={item.sub}
              to={item.path}
              badge={'badge' in item ? item.badge : undefined}
              demo={isDemo}
              onDemoTap={showDemoSignup}
            />
          ))}

        {user?.role === 'admin' && (
          <Link
            to="/ops"
            className="flex items-center gap-4 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors"
          >
            <span className="text-xl w-7 text-center">🛠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">관리자 페이지</p>
              <p className="text-xs text-text-tertiary mt-0.5">운영 관리 콘솔</p>
            </div>
            <span className="text-text-tertiary text-sm">›</span>
          </Link>
        )}
      </div>

      <div className="bg-surface-2 border border-line rounded-xl mb-4 px-5 py-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-xl w-7 text-center">🎨</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">테마</p>
            <p className="text-xs text-text-tertiary mt-0.5">다크 / 라이트 / 시스템 설정 따름</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon }) => {
            const active = theme === value
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand/12 border-brand text-brand'
                    : 'bg-surface-3 border-strong text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ① 앱 잠금 (Face ID/Touch ID) — 네이티브 + 지원 기기에서만 렌더.
          데모(비로그인)에선 숨김 — 기기 잠금은 로그인 사용자 데이터 보호용. */}
      {!isDemo && <AppLockSection />}

      <div className="bg-surface-2 border border-line rounded-xl">
        <button
          onClick={isDemo ? () => showDemoSignup() : () => setShowLogoutModal(true)}
          className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors"
        >
          <span className="text-xl w-7 text-center">🚪</span>
          <span className="text-sm font-medium text-text-secondary">로그아웃</span>
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-xs text-text-quaternary">
          <Link to="/terms" className="hover:text-text-tertiary transition-colors">이용약관</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-text-tertiary transition-colors">개인정보처리방침</Link>
        </div>
        <p className="text-xs text-text-quaternary">치뽀 · 취준생이 만드는 취업 관리 앱</p>
      </div>

      {/* 로그아웃 확인 모달 — 모바일에서 실수 로그아웃 방지 (Sidebar·ProfileSettings와 동일 패턴) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div role="dialog" aria-modal="true" aria-label="로그아웃 확인" className="bg-surface border border-line rounded-xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">로그아웃 하시겠어요?</h3>
            <p className="text-sm text-text-quaternary mb-6">로그인 화면으로 이동합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-lg bg-brand text-bg text-sm font-medium hover:bg-accent active:bg-accent-hover transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 설정 메뉴 행 — 실서비스는 `<Link>`(내비게이션), 데모는 `<button>`(가입 모달 잠금).
 * 데모에서 실서비스 하위 페이지(AuthGuard)로 나가면 랜딩으로 튕기므로, 이동 대신 가입 유도.
 */
function SettingsMenuRow({
  icon,
  label,
  sub,
  to,
  badge,
  demo,
  onDemoTap,
}: {
  icon: string
  label: string
  sub: string
  to: string
  /** 「이사왔어요」 같은 이동 안내 — 있을 때만 렌더 */
  badge?: string
  demo: boolean
  onDemoTap: () => void
}) {
  const cls =
    'flex items-center gap-4 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors w-full text-left'
  const body = (
    <>
      <span className="text-xl w-7 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>
      </div>
      {badge && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
          {badge}
        </span>
      )}
      <span className="text-text-tertiary text-sm">›</span>
    </>
  )
  return demo ? (
    <button type="button" onClick={onDemoTap} className={cls}>
      {body}
    </button>
  ) : (
    <Link to={to} className={cls}>
      {body}
    </Link>
  )
}
