import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface InquiryPayload {
  category: string
  title: string
  content: string
}

export const createInquiry = (dto: InquiryPayload) =>
  apiClient.post('/inquiries', dto).then(unwrap<{ id: string }>)
