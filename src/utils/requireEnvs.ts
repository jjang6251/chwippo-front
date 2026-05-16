/**
 * 필수 환경변수가 모두 채워졌는지 검증.
 * 누락(undefined·빈 문자열·공백만) 시 명확한 에러 메시지로 throw.
 *
 * Vite는 build 시점 env 검증이 약해서 진입점(main.tsx)에서 fail-fast 가드로 사용.
 */
type EnvLike = Record<string, string | undefined>

export function requireEnvs(keys: readonly string[], env: EnvLike): void {
  const missing = keys.filter((k) => {
    const v = env[k]
    return v === undefined || v.trim() === ''
  })
  if (missing.length > 0) {
    throw new Error(
      `필수 환경변수 누락: ${missing.join(', ')}. .env 파일을 확인하세요.`,
    )
  }
}
