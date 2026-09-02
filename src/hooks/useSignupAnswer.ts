import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postSignupAnswer, type SignupAnswerBody } from '@/api/users'
import { trackSignupComplete } from '@/lib/metaPixel'
import { useAuthStore } from '@/stores/authStore'

/**
 * signup 1 질문 답변 (구 21칩 · 신 계열 1탭 공용).
 * onSuccess 시 authStore 의 user 갱신 + applications query invalidate
 * (보드·캘린더 진입 시 방금 담은 지원 예정 카드가 보이게).
 *
 * 🔴 `signupJobTitle` 을 낙관 갱신에 반드시 포함한다 — 이 값이 **카드 추가 모달 프리필의
 * 유일한 재료**라, 여기서 빠지면 온보딩 직후 첫 카드에서 프리필이 안 뜬다
 * (다음 `/auth/refresh` 까지 기다려야 나타난다 = 「어? 아까 적었는데」).
 *
 * 🔴 **가입 완료 광고 전환(Meta Pixel)을 여기서 쏜다.** 화면(`SignupQuestion`)에는 성공
 * 콜백이 「시작하기」·「건너뛰기」 **둘**이라 거기 붙이면 한 쪽을 빠뜨리거나 둘 다 붙여
 * 중복이 난다. 서버가 「이미 답변」 400 으로 막는 재진입은 `onError` 로 가므로,
 * 이 자리가 **성공 1회**를 구조로 보장하는 유일한 지점이다.
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
          signupSeriesId: body.seriesId ?? null,
          signupJobTitle: body.jobTitle?.trim() || null,
          onboardedAt: user.onboardedAt ?? new Date().toISOString(),
        })
      }
      qc.invalidateQueries({ queryKey: ['applications'] })
      // 광고 전환 — 픽셀 미설정(로컬·CI·프리뷰)이면 no-op
      trackSignupComplete()
    },
  })
}
