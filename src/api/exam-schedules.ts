import { apiClient } from './client'
import type { ExamSchedule, CreateExamScheduleDto, UpdateExamScheduleDto, ConvertExamToCertDto } from '@/types/exam-schedule'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const listExamSchedules = () =>
  apiClient.get('/myinfo/exam-schedules').then(unwrap<ExamSchedule[]>)

export const createExamSchedule = (dto: CreateExamScheduleDto) =>
  apiClient.post('/myinfo/exam-schedules', dto).then(unwrap<ExamSchedule>)

export const updateExamSchedule = (id: string, dto: UpdateExamScheduleDto) =>
  apiClient.patch(`/myinfo/exam-schedules/${id}`, dto).then(unwrap<ExamSchedule>)

export const deleteExamSchedule = (id: string) =>
  apiClient.delete(`/myinfo/exam-schedules/${id}`)

export const convertExamToCert = (id: string, dto: ConvertExamToCertDto) =>
  apiClient.post(`/myinfo/exam-schedules/${id}/convert-to-cert`, dto).then((r) => r.data)
