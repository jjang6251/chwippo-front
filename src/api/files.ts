import axios from 'axios'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

interface PresignedUrlResponse {
  uploadUrl: string
  fileUrl: string
}

export interface UploadedFile {
  fileUrl: string
  fileSize: number
}

/**
 * 파일을 R2에 직접 업로드(presigned URL)하고 결과를 반환.
 * 호출자는 fileSize를 myinfo 항목 생성 API에 함께 전달해야 storage cap 정확 집계됨.
 */
export async function uploadFile(
  scope: string,
  file: File,
): Promise<UploadedFile> {
  const { uploadUrl, fileUrl } = await apiClient
    .post('/files/presigned-url', {
      scope,
      contentType: file.type,
      fileSize: file.size,
    })
    .then(unwrap<PresignedUrlResponse>)

  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  })

  return { fileUrl, fileSize: file.size }
}

/**
 * 본인이 업로드한 R2 파일 삭제 (보상 호출용).
 * mutation 실패 시 axios 인터셉터가 자동 호출 — 일반 흐름에선 직접 부를 일 없음.
 */
export const deleteOwnFile = (fileUrl: string) =>
  apiClient.delete('/files', { data: { fileUrl } })
