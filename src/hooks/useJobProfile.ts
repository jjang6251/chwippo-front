import { useMutation } from '@tanstack/react-query'
import { patchJobProfile, type JobProfileBody } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'

/**
 * 희망 직무·계열 변경 (`PATCH /users/me/job-profile`).
 *
 * 🔴 **낙관 갱신이 필수다.** 서버가 204 라 응답에 새 값이 없고, `user` 는 `/auth/refresh`
 * 로만 다시 내려온다 — 갱신을 안 하면 방금 바꾼 직무가 다음 부팅까지 화면에 안 나타나고
 * (「어? 아까 바꿨는데」), 카드 추가 모달 프리필도 옛 값을 계속 채운다.
 * `useSignupAnswer` 와 같은 방식이다.
 *
 * 🔴 **보낸 필드만** 갈아 끼운다. `{...user, signupJobTitle: body.jobTitle}` 처럼 통째로
 * 덮으면 계열만 바꾼 요청이 직무를 `undefined` 로 지운다.
 *
 * 실패하면 스토어는 **손도 안 댄다** — 화면만 바뀌고 서버는 옛 값인 상태가 제일 나쁘다.
 */
export function useUpdateJobProfile() {
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: (body: JobProfileBody) => patchJobProfile(body),
    onSuccess: (_, body) => {
      // 구독값이 아니라 최신 스냅샷을 읽는다 — 저장 대기 중 다른 곳에서 user 가 바뀔 수 있다
      const current = useAuthStore.getState().user
      if (!current) return
      setUser({
        ...current,
        ...(body.jobTitle !== undefined
          ? { signupJobTitle: body.jobTitle?.trim() || null }
          : {}),
        ...(body.seriesId !== undefined
          ? { signupSeriesId: body.seriesId ?? null }
          : {}),
      })
    },
    onError: () => toast.error('저장에 실패했어요. 다시 시도해주세요.'),
  })
}
