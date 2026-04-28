import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { deleteAccount } from '@/api/users'
import { apiClient } from '@/api/client'

export function ProfileSettings() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      clearAuth()
      navigate('/')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">프로필 설정</h1>

      {/* 계정 정보 */}
      <section className="bg-surface-2 border border-white/5 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">계정 정보</h2>
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <span className="text-sm text-text-muted">이메일</span>
          <span className="text-sm">{user?.email ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-text-muted">로그인 방식</span>
          <span className="text-sm">카카오</span>
        </div>
      </section>

      {/* 로그아웃 */}
      <section className="bg-surface-2 border border-white/5 rounded-xl p-5 mb-4">
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center justify-between text-sm text-text-secondary hover:text-text-primary transition-colors py-1"
        >
          <span>로그아웃</span>
          <span className="text-text-muted">›</span>
        </button>
      </section>

      {/* 계정 탈퇴 */}
      <section className="bg-surface-2 border border-danger/15 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-danger mb-1">계정 탈퇴</h2>
        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          탈퇴 시 지원 카드, 내 정보, 업로드한 파일 등 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-lg border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
        >
          탈퇴하기
        </button>
      </section>

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">로그아웃 하시겠어요?</h3>
            <p className="text-sm text-text-muted mb-6">로그인 화면으로 이동합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-text-secondary hover:bg-white/4 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-accent transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold mb-2">정말 탈퇴하시겠어요?</h3>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              지원 카드, 내 정보, 파일 등 모든 데이터가 즉시 삭제되며
              복구할 수 없습니다. 카카오 연동도 함께 해제됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-text-secondary hover:bg-white/4 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-danger text-white text-sm font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {deleteMutation.isPending ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
