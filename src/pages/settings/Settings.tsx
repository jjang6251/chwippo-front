import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

const MENU = [
  { label: '프로필 설정', sub: '닉네임 변경, 계정 탈퇴', path: '/settings/profile', icon: '👤' },
  { label: '알림 설정', sub: '마감·면접 알림 (준비 중)', path: '/settings/alarm', icon: '🔔' },
  { label: '도움말', sub: '자주 묻는 질문', path: '/settings/help', icon: '❓' },
  { label: '문의하기', sub: '버그 신고, 기능 요청', path: '/inquiry', icon: '💬' },
] as const

export function Settings() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">설정</h1>

      <div className="bg-surface-2 border border-white/5 rounded-xl divide-y divide-white/5 mb-4">
        {MENU.map(({ label, sub, path, icon }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors"
          >
            <span className="text-xl w-7 text-center">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">{sub}</p>
            </div>
            <span className="text-text-muted text-sm">›</span>
          </Link>
        ))}
      </div>

      <div className="bg-surface-2 border border-white/5 rounded-xl">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors"
        >
          <span className="text-xl w-7 text-center">🚪</span>
          <span className="text-sm font-medium text-text-secondary">로그아웃</span>
        </button>
      </div>

      <p className="text-center text-xs text-text-muted mt-8 opacity-50">취뽀 · 취준생이 만드는 취업 관리 앱</p>
    </div>
  )
}
