import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface InquiryComment {
  id: string
  inquiry_id: string
  author_role: 'user' | 'admin'
  author_id: string
  content: string
  created_at: string
}

export interface Inquiry {
  id: string
  user_id: string
  category: string
  title: string
  content: string
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
  user_unread: number
  admin_unread: number
  created_at: string
}

export interface InquiryDetail extends Inquiry {
  comments: InquiryComment[]
}

export interface InquiryPayload {
  category: string
  title: string
  content: string
}

export const createInquiry = (dto: InquiryPayload) =>
  apiClient.post('/inquiries', dto).then(unwrap<Inquiry>)

export const getMyInquiries = () =>
  apiClient.get('/inquiries').then(unwrap<Inquiry[]>)

export const getInquiryDetail = (id: string) =>
  apiClient.get(`/inquiries/${id}`).then(unwrap<InquiryDetail>)

export const addComment = (id: string, content: string) =>
  apiClient.post(`/inquiries/${id}/comments`, { content }).then(unwrap<InquiryComment>)
