import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTourStore } from '@/stores/tourStore'
import { useThemeStore, type Theme } from '@/stores/themeStore'
import { apiClient } from '@/api/client'
import { postToNative } from '@/utils/nativeBridge'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark', label: '다크', icon: '🌙' },
  { value: 'light', label: '라이트', icon: '☀️' },
  { value: 'system', label: '시스템', icon: '🖥️' },
]

const MENU = [
  { label: '프로필 설정', sub: '닉네임 변경, 계정 탈퇴', path: '/settings/profile', icon: '👤' },
  { label: '알림 설정', sub: '마감·면접 알림 (준비 중)', path: '/settings/alarm', icon: '🔔' },
  { label: '도움말', sub: '자주 묻는 질문', path: '/settings/help', icon: '❓' },
  { label: '문의하기', sub: '버그 신고, 기능 요청', path: '/inquiry', icon: '💬' },
] as const

export function Settings() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const startTour = useTourStore((s) => s.start)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const navigate = useNavigate()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch { /* 로그아웃 실패해도 클라이언트는 정리 */ }
    clearAuth()
    postToNative({ type: 'logout' })
    navigate('/')
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <h1 className="text-xl font-bold mb-6">설정</h1>

      <div className="bg-surface-2 border border-line rounded-xl divide-y divide-line mb-4">
        {MENU.map(({ label, sub, path, icon }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-4 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors"
          >
            <span className="text-xl w-7 text-center">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>
            </div>
            <span className="text-text-tertiary text-sm">›</span>
          </Link>
        ))}
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

      <div className="bg-surface-2 border border-line rounded-xl mb-4">
        <button
          onClick={startTour}
          className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors"
        >
          <span className="text-xl w-7 text-center">🚀</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">온보딩 다시 보기</p>
            <p className="text-xs text-text-tertiary mt-0.5">치뽀 시작 안내 다시 확인하기</p>
          </div>
          <span className="text-text-tertiary text-sm">›</span>
        </button>
      </div>

      <div className="bg-surface-2 border border-line rounded-xl">
        <button
          onClick={() => setShowLogoutModal(true)}
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
                className="flex-1 py-2.5 rounded-lg bg-brand text-text-primary text-sm font-medium hover:bg-accent active:bg-accent-hover transition-colors"
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
