import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jobPostingApi, type JobPosting } from '@/api/jobPosting'

/**
 * 공고 요건 파싱·수정·삭제 mutation hooks.
 *
 * 데이터 소스는 application 상세(`['applications', id]`)의 jobPosting 필드 —
 * 별도 조회 query 없이 parse/patch/delete 후 상세를 invalidate 해 배너 갱신.
 * parse 는 LLM 경유라 ai-quotas 도 invalidate (실시간 잔여 캡션).
 */

const appKey = (id: string) => ['applications', id] as const

export function useParseJobPosting(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rawText: string) => jobPostingApi.parse(applicationId, rawText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appKey(applicationId) })
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
    },
  })
}

export function useUpdateJobPosting(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<JobPosting>) =>
      jobPostingApi.update(applicationId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: appKey(applicationId) }),
  })
}

export function useDeleteJobPosting(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => jobPostingApi.remove(applicationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: appKey(applicationId) }),
  })
}
