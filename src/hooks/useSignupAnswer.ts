import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postSignupAnswer, type SignupAnswerBody } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

/**
 * W1 — signup 1 질문 (관심 직군) 답변 + 가상 회사 샘플 자동 생성.
 * onSuccess 시 authStore 의 user 갱신 + applications query invalidate (보드 진입 시 샘플 보임).
 */
export function useSignupAnswer() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: (body: SignupAnswerBody) => postSignupAnswer(body),
    onSuccess: (_, body) => {
      // 낙관적 — backend 응답 X (204). authStore 즉시 갱신
      if (user) {
        setUser({
          ...user,
          signupJobCategories: body.jobCategories,
          signupOtherText: body.otherText?.trim() || null,
          onboardedAt: user.onboardedAt ?? new Date().toISOString(),
        })
      }
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}
