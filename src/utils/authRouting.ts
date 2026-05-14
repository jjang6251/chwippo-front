export type PostAuthDestination = '/terms-agreement' | '/dashboard'

/**
 * termsAgreedAt 기반 로그인 후 이동 경로 결정.
 * Landing(refresh), AuthGuard 에서 공통 사용.
 */
export function resolvePostLoginDestination(
  termsAgreedAt: string | null | undefined,
): PostAuthDestination {
  return termsAgreedAt ? '/dashboard' : '/terms-agreement'
}

/**
 * LoginCallback URL 파라미터 `needs_terms` 파싱.
 * 백엔드가 String(!user.termsAgreedAt) 으로 직렬화한 값을 복원.
 */
export function parseNeedsTerms(param: string | null): boolean {
  return param === 'true'
}
