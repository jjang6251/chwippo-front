import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { applicationsApi } from '@/api/applications'
import type { Application } from '@/types/application'

/**
 * 지원 카드의 "직무" 를 정하는 **단일 규칙**.
 *
 * 🔴 백엔드 `src/applications/job-text.ts` 의 `resolveJobText` 와 같아야 한다.
 * `jobTitle`("백엔드 개발자") 우선, 없으면 직군 태그(`jobCategory`).
 * 사용자들이 `jobCategory` 를 업종으로 쓰기 때문이다 — 금융권에 지원한 개발자가 `금융` 을 단다.
 * 규칙이 갈리면 화면에 보이는 직무와 AI 결과 기준이 어긋난다.
 */
export function resolveJobText(
  app: Pick<Application, 'jobTitle' | 'jobCategory'> | null | undefined,
): string | null {
  return app?.jobTitle?.trim() || app?.jobCategory?.trim() || null
}

/**
 * AI feature 호출 직전 **직무 게이트**.
 *
 * `await ensure()` — 직무가 있으면 true 즉시. 없으면 전역 모달을 띄우고 사용자가
 * 입력하거나 취소할 때까지 대기한다. 입력하면 **카드의 `jobTitle` 에 저장**되므로
 * 다음부터는 모달이 뜨지 않는다.
 *
 * `useRequireAiConsent` 와 같은 자리에 같은 모양으로 쓴다:
 * ```ts
 * if (!(await ensureAiConsent())) return
 * if (!(await ensureJobTitle())) return
 * ```
 *
 * ⚠️ 서버에도 같은 게이트가 있다 (`assertJobTextPresent`). 이건 마찰을 줄이는 안내이고,
 * 진짜 경계는 서버다 — 여기만 있으면 devtools 로 우회된다.
 */
export function useRequireJobTitle(applicationId: string | undefined) {
  const qc = useQueryClient()
  const requestModal = useJobTitleGateStore((s) => s.request)

  return useCallback(async (): Promise<boolean> => {
    if (!applicationId) return false
    /**
     * 캐시가 아니라 **최신 카드**로 판정한다. 다른 탭·다른 화면에서 방금 직무를
     * 채웠는데 이 화면 캐시가 낡아서 모달이 또 뜨는 상황을 막는다.
     * 조회 실패는 게이트 통과로 처리한다 — 서버가 어차피 다시 막으므로
     * 네트워크 문제로 사용자를 여기 가둘 이유가 없다.
     */
    let app: Application | undefined
    try {
      app = await qc.fetchQuery({
        // `useApplication` 과 **같은 키**여야 캐시가 갈리지 않는다 (`['applications', id]`)
        queryKey: ['applications', applicationId],
        queryFn: () => applicationsApi.get(applicationId),
        staleTime: 0,
      })
    } catch {
      return true
    }
    if (resolveJobText(app)) return true
    return requestModal(applicationId)
  }, [applicationId, qc, requestModal])
}
