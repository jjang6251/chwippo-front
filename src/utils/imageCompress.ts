/**
 * 공부 노트 이미지 — **업로드 전 클라이언트 압축** (study-note-media PR-A).
 *
 * ## 왜 클라에서 줄이나
 *
 * 업로드는 presigned URL 로 R2 에 **직행**한다 — 바이트가 백엔드를 지나가지 않으므로
 * 서버에서 Sharp 로 줄일 자리가 애초에 없다 (plan 결정 ①). 폰 사진 한 장이 5~8MB 라
 * 여기서 안 줄이면 10MB 상한에 금방 닿고, 100MB 저장 풀도 열 장이면 동난다.
 *
 * ## 🔴 알파가 있으면 jpeg 로 굽지 않는다
 *
 * jpeg 에는 투명이 없다. 투명 픽셀을 그대로 jpeg 로 인코딩하면 배경이 **검게** 칠해진다
 * (다크 모드에선 한동안 눈치도 못 챈다). 그래서 알파 판정은 `file.type` 이 아니라
 * **바이트 시그니처**로 한다 — 드래그&드롭·일부 OS 에서 `file.type` 이 빈 문자열로 오는데,
 * 그때 타입만 믿으면 투명 png 가 jpeg 경로로 새어 나간다.
 */

/** 서버 `study-note/image` scope 와 같은 화이트리스트 (svg = 스크립트 표면 · gif = 용량) */
// 백엔드 `files/scope.const.ts` STUDY_NOTE_IMAGE_POLICY 와 같은 값 — 한쪽만 바꾸면 발급 400
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

/** 서버 presigned 발급 상한과 같은 값 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** 긴 변 상한 — 읽기 모드 본문 폭(720px)의 2배 이상이라 고해상도 화면에서도 안 뭉갠다 */
export const MAX_IMAGE_EDGE = 1600

const JPEG_QUALITY = 0.85

/**
 * 긴 변이 `max` 를 넘으면 비율을 지켜 줄인다. 넘지 않으면 원본 크기 그대로 (확대 없음).
 *
 * 🔴 최소 1px 을 보장한다 — 반올림이 0 으로 떨어진 캔버스는 `toBlob` 이 null 을 준다
 * (극단 비율 파노라마: 4000×1 → 1600×0).
 */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const ratio = max / longest
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * PNG 바이트에 투명이 있을 수 있는가 — IHDR 의 colorType 한 바이트로 판정.
 *
 * colorType 4(회색+알파)·6(RGBA)은 알파 채널을 직접 들고 있다. 3(팔레트)은 채널은 없지만
 * tRNS 청크로 투명해질 수 있어 **보수적으로 포함**한다 — 청크를 끝까지 훑는 비용보다
 * 팔레트 png 를 png 로 두는 손해가 싸다.
 */
export function pngHasAlpha(bytes: Uint8Array): boolean {
  // 8(시그니처) + 4(길이) + 4('IHDR') + 8(가로·세로) + 1(bitDepth) + 1(colorType)
  if (bytes.length < 26) return false
  if (PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte)) return false
  const colorType = bytes[25]
  return colorType === 3 || colorType === 4 || colorType === 6
}

/**
 * 저장할 포맷. 알파가 있으면 무조건 png(위 🔴), webp 는 webp 유지, 나머지는 jpeg.
 * HEIC 처럼 화이트리스트 밖의 원본도 여기서 jpeg 로 수렴한다.
 */
export function outputTypeFor(sourceType: string, hasAlpha: boolean): AllowedImageType {
  if (hasAlpha) return 'image/png'
  if (sourceType === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

export type CompressResult =
  | { ok: true; blob: Blob; contentType: AllowedImageType }
  /**
   * - `decode` = 브라우저가 못 여는 형식 (변환 안내 대상 — HEIC 가 여기로 온다)
   * - `encode` = 캔버스가 결과를 못 냄
   * - `too-large` = 줄이고도 10MB 초과
   */
  | { ok: false; reason: 'decode' | 'encode' | 'too-large' }

/**
 * 리사이즈 + 재인코딩. 실패는 던지지 않고 사유로 돌려준다 — 호출부가 사유마다 다른
 * 안내를 띄워야 해서(변환 요청 vs 용량 안내) 예외로 뭉개면 구분이 사라진다.
 *
 * HEIC 는 **일단 시도한다** — Safari 는 `<img>` 로 디코드할 수 있어서 그대로 통과하고,
 * 못 여는 브라우저에서만 `decode` 로 떨어져 안내를 받는다 (plan §1).
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const contentType = outputTypeFor(file.type, pngHasAlpha(bytes))

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      return { ok: false, reason: 'decode' }
    }

    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, reason: 'encode' }
    ctx.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, contentType, JPEG_QUALITY),
    )
    if (!blob) return { ok: false, reason: 'encode' }
    if (blob.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'too-large' }
    return { ok: true, blob, contentType }
  } finally {
    // 🔴 그리기가 끝난 뒤에 푼다 — 먼저 풀면 일부 브라우저에서 캔버스가 빈 채로 남는다
    URL.revokeObjectURL(url)
  }
}
