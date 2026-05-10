export type ExamType = 'language' | 'cert'

export const LANGUAGE_CERT_TYPES = [
  'TOEIC',
  'TOEIC Speaking',
  'OPIC',
  'TEPS',
  'JLPT',
  'HSK',
  '기타',
] as const

export interface ExamSchedule {
  id: string
  user_id: string
  exam_type: ExamType
  cert_type: string | null
  name: string
  exam_date: string
  location: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface CreateExamScheduleDto {
  exam_type: ExamType
  cert_type?: string
  name: string
  exam_date: string
  location?: string
  memo?: string
}

export type UpdateExamScheduleDto = Partial<CreateExamScheduleDto>

export interface ConvertExamToCertDto {
  score_grade: string
}
