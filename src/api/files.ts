import axios from 'axios'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

interface PresignedUrlResponse {
  uploadUrl: string
  fileUrl: string
}

export async function uploadFile(
  scope: string,
  file: File,
): Promise<string> {
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

  return fileUrl
}
