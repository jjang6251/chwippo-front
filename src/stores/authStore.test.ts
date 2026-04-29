import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const mockUser = {
  id: 'user-uuid-1',
  nickname: '홍길동',
  email: 'hong@kakao.com',
  role: 'user' as const,
}

describe('authStore', () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    useAuthStore.setState({ user: null, accessToken: null })
  })

  describe('초기 상태', () => {
    it('user는 null', () => {
      expect(useAuthStore.getState().user).toBeNull()
    })

    it('accessToken은 null', () => {
      expect(useAuthStore.getState().accessToken).toBeNull()
    })
  })

  describe('setUser', () => {
    it('user 설정', () => {
      useAuthStore.getState().setUser(mockUser)
      expect(useAuthStore.getState().user).toEqual(mockUser)
    })

    it('setUser(null) → user null로 초기화', () => {
      useAuthStore.getState().setUser(mockUser)
      useAuthStore.getState().setUser(null)
      expect(useAuthStore.getState().user).toBeNull()
    })

    it('user.role 필드 포함', () => {
      useAuthStore.getState().setUser({ ...mockUser, role: 'admin' })
      expect(useAuthStore.getState().user?.role).toBe('admin')
    })
  })

  describe('setAccessToken', () => {
    it('accessToken 설정', () => {
      useAuthStore.getState().setAccessToken('my-access-token-abc')
      expect(useAuthStore.getState().accessToken).toBe('my-access-token-abc')
    })

    it('setAccessToken(null) → null로 초기화', () => {
      useAuthStore.getState().setAccessToken('some-token')
      useAuthStore.getState().setAccessToken(null)
      expect(useAuthStore.getState().accessToken).toBeNull()
    })
  })

  describe('clearAuth', () => {
    it('clearAuth → user와 accessToken 모두 null', () => {
      useAuthStore.getState().setUser(mockUser)
      useAuthStore.getState().setAccessToken('some-token')

      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
    })

    it('이미 null 상태에서 clearAuth 호출 → 오류 없음', () => {
      expect(() => useAuthStore.getState().clearAuth()).not.toThrow()
    })
  })

  describe('localStorage 미사용', () => {
    it('setUser 후 localStorage에 저장되지 않음 (in-memory 전용)', () => {
      useAuthStore.getState().setUser(mockUser)
      // Zustand persist 없음 → localStorage 미사용
      expect(localStorage.getItem('auth')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
    })
  })
})
