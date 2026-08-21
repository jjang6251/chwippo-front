import { deleteOwnFile, uploadFile } from '@/api/files'
import { createNoteAttachment } from '@/api/studyNotes'
import { toast } from '@/stores/toastStore'
import { compressImage, type CompressResult } from '@/utils/imageCompress'

/**
 * study-note-media PR-A — 이미지 한 장의 업로드 파이프라인.
 *
 *   압축 → presigned 발급 → R2 PUT → 첨부 등록 → 노드 확정
 *
 * ## 🔴 실패는 **여기서** 알린다
 *
 * 진입이 셋(툴바·붙여넣기·드롭)이라 각 진입마다 안내 문구를 들면 세 벌이 어긋난다.
 * 그래서 이 함수가 토스트까지 책임지고, 호출부(에디터)는 **성공/실패 두 갈래**만 본다 —
 * 실패면 자리 표시를 걷는 것 하나.
 *
 * ## 🔴 보상 삭제·서버 문구는 인터셉터와 **한 번씩만** 나눠 진다
 *
 * `apiClient` 인터셉터는 body 에 `fileUrl` 이 실린 요청이 4xx/5xx 로 떨어지면 이미
 * ① `DELETE /files` 로 R2 객체를 지우고 ② 서버 문구를 토스트한 뒤 `_toastShown` 을 세운다
 * (`client.ts`). 첨부 등록(cap 초과 400 포함)이 바로 그 경로다 — 여기서 또 지우면 없는
 * 객체를 지우고, 또 띄우면 같은 말을 두 번 한다.
 *
 * 인터셉터가 **손대지 않는** 구멍은 두 개고 그건 우리가 막는다:
 *   - 네트워크 실패(응답 자체가 없음) — 추적 조건 `status >= 400` 을 못 넘는다
 *   - 401 — 인터셉터가 cleanup 대상에서 명시적으로 제외한다
 * 둘 다 **PUT 은 성공한 뒤**라 그냥 두면 R2 에 고아가 남는다.
 */

/** 서버 scope 화이트리스트와 같은 문자열 (`scope.const.ts`) */
export const STUDY_NOTE_IMAGE_SCOPE = 'study-note/image'

const COMPRESS_MESSAGE: Record<Extract<CompressResult, { ok: false }>['reason'], string> = {
  // HEIC(아이폰 기본 포맷)가 여기로 온다 — 무엇을 하면 되는지까지 말한다
  decode: '이 형식은 브라우저가 열지 못했어요. jpg·png 로 변환해서 올려 주세요.',
  encode: '이미지를 준비하지 못했어요. 다시 시도해 주세요.',
  'too-large': '이미지가 너무 커요. 10MB 이하로 줄여서 올려 주세요.',
}

const UPLOAD_FAILED_MESSAGE = '이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'

/** 인터셉터가 이미 토스트를 냈는가 (400 서버 문구 등) — 중복 노출 방지 */
function wasToastShown(err: unknown): boolean {
  return Boolean((err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown)
}

/** 서버가 문구를 주면 **언제나 그쪽이 이긴다** — generic ERROR 로 뭉개지 않는다 */
function serverMessage(err: unknown): string | null {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

export interface UploadedNoteImage {
  src: string
  attachmentId: string
}

export async function uploadNoteImage(
  noteId: string,
  file: File,
): Promise<UploadedNoteImage> {
  const compressed = await compressImage(file)
  if (!compressed.ok) {
    toast.error(COMPRESS_MESSAGE[compressed.reason])
    throw new Error(compressed.reason)
  }

  // 원본 이름은 서버로 가지 않는다(키는 서버가 UUID 로 짓는다) — 타입만 압축 결과를 따른다
  const payload = new File([compressed.blob], file.name, { type: compressed.contentType })

  /*
    presigned 는 300초짜리다. 발급~PUT 사이에서 만료되거나 순단이 나면 **한 번만** 다시
    받는다 — `uploadFile` 이 발급과 PUT 을 한 몸으로 들고 있어서 재호출이 곧 재발급이다.
    두 번째도 실패하면 R2 에 남은 건 없다(PUT 이 안 끝났다) — 보상할 대상도 없다.
  */
  let uploaded: { fileUrl: string; fileSize: number }
  try {
    uploaded = await uploadFile(STUDY_NOTE_IMAGE_SCOPE, payload)
  } catch {
    try {
      uploaded = await uploadFile(STUDY_NOTE_IMAGE_SCOPE, payload)
    } catch (err) {
      toast.error(serverMessage(err) ?? UPLOAD_FAILED_MESSAGE)
      throw err
    }
  }

  try {
    const attachment = await createNoteAttachment(noteId, {
      fileUrl: uploaded.fileUrl,
      fileSizeBytes: uploaded.fileSize,
    })
    return { src: uploaded.fileUrl, attachmentId: attachment.id }
  } catch (err) {
    // 인터셉터가 보상 삭제 + 서버 문구까지 끝냈다 (cap 초과 400 등) — 여기선 조용히 뺀다
    if (wasToastShown(err)) throw err
    // 네트워크·401 — 인터셉터가 손대지 않는 구멍. 우리가 고아를 치운다
    await deleteOwnFile(uploaded.fileUrl).catch(() => {})
    toast.error(serverMessage(err) ?? UPLOAD_FAILED_MESSAGE)
    throw err
  }
}
