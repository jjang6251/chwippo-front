import { uploadFile } from '@/api/files'

/**
 * 파일 첨부 상태 — 폼 컴포넌트에서 사용.
 * - empty: 첨부 없음
 * - existing: 이미 R2에 저장된 기존 파일 (편집 모드)
 * - pending: 사용자가 새로 선택한 File 객체. **저장 시점에만 R2 PUT.** 취소·이탈 시 GC.
 */
export type FileSlot =
  | { kind: 'empty' }
  | { kind: 'existing'; url: string; size: number | null }
  | { kind: 'pending'; file: File }

export const EMPTY_SLOT: FileSlot = { kind: 'empty' }

/**
 * DB row의 file_url·file_size_bytes로부터 초기 FileSlot 생성.
 * 편집 모달 진입 시 사용.
 */
export function slotFromExisting(
  url: string | null | undefined,
  size: number | null | undefined,
): FileSlot {
  if (!url) return EMPTY_SLOT
  return { kind: 'existing', url, size: size ?? null }
}

/**
 * 저장 시점에 slot을 백엔드에 보낼 { file_url, file_size_bytes }로 변환.
 * - pending이면 그제서야 R2 PUT 발생 (uploadFile 호출).
 * - existing이면 그대로 반환.
 * - empty면 둘 다 null.
 *
 * 실패 시 호출자가 catch로 사용자에게 에러 표시.
 */
export async function resolveFileForSubmit(
  slot: FileSlot,
  scope: string,
): Promise<{ file_url: string | null; file_size_bytes: number | null }> {
  if (slot.kind === 'pending') {
    const { fileUrl, fileSize } = await uploadFile(scope, slot.file)
    return { file_url: fileUrl, file_size_bytes: fileSize }
  }
  if (slot.kind === 'existing') {
    return { file_url: slot.url, file_size_bytes: slot.size }
  }
  return { file_url: null, file_size_bytes: null }
}
