/**
 * 컨페티 색 — sage + coral + 보조색을 **실행 시점에 토큰에서 읽어** 넘긴다.
 *
 * 🔴 **hex 를 박아두지 않는다** (2026-08-17). 예전엔 `#6b9c7f` 처럼 그때의 다크 토큰값을
 * 복사해 뒀는데, 토큰이 바뀌자 **거기만 옛 색으로 남았다.** canvas-confetti 는 CSS 클래스를
 * 못 받으므로 값으로 넘길 수밖에 없고, 그렇다면 **읽어서** 넘겨야 테마가 바뀔 때 따라간다.
 *
 * 🔴 **넘기는 형식은 hex 여야 한다** (2026-08-29 실측). 토큰은 `130 187 153` 처럼 채널만
 * 들어 있어서 예전엔 `rgb(130 187 153)` 문자열로 넘겼는데, canvas-confetti 의 색 파서는
 * **hex 전용**이다 — 그 문자열에서 hex 가 아닌 글자를 지우고 앞 6자를 읽으므로
 * `rgb(130 187 153)` → `b13018` → **rgb(177,48,24)** 이 된다. 다섯 색이 전부 비슷한
 * 벽돌색으로 뭉개져서 「sage + coral」이 화면에 한 번도 나온 적이 없었다(1280 다크 프레임에서
 * 발견). 형식이 틀려도 **던지지 않고 그럴듯한 색이 나오는** 종류의 결함이라 오래 안 들켰다.
 *
 * 🔴 컴포넌트 파일이 아니라 여기 있는 이유 — `CelebrationOverlay`(합격 축하)와
 * 투어 2장(최종 합격 폭죽)이 **같은 색**이어야 한다. 컴포넌트에서 내보내면
 * `react-refresh/only-export-components` 가 걸리고 fast-refresh 도 깨진다.
 */

/** `'130 187 153'` · `'130, 187, 153'` → `'#82bb99'`. 읽을 수 없으면 `null` */
function channelsToHex(raw: string): string | null {
  const parts = raw.split(/[\s,]+/).filter(Boolean).map(Number)
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null
  return `#${parts
    .slice(0, 3)
    .map((n) =>
      Math.min(Math.max(Math.round(n), 0), 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function confettiColors(): string[] {
  const cs = getComputedStyle(document.documentElement)
  // fallback 은 **다크 기본값**이다 — 토큰을 못 읽는 환경에서만 쓰인다
  const color = (name: string, fallback: string) =>
    channelsToHex(cs.getPropertyValue(name).trim()) ?? fallback
  return [
    color('--brand', '#82bb99'),
    color('--accent', '#f79476'),
    color('--success', '#84bb9a'),
    color('--warning', '#d4b045'),
    color('--text-primary', '#ebe9e3'),
  ]
}
