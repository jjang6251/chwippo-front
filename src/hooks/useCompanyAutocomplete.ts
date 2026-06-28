import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { autocompleteCompanies } from '@/api/companies'

/**
 * W2 — debounce 250ms + React Query.
 *
 * 빈 input 도 fetch (signup 직군 boost 추천). 사용자가 모달 열자마자 추천 보임.
 */
export function useCompanyAutocomplete(rawQuery: string) {
  const [debouncedQ, setDebouncedQ] = useState(rawQuery)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])

  return useQuery({
    queryKey: ['companies', 'autocomplete', debouncedQ],
    queryFn: () => autocompleteCompanies(debouncedQ),
    staleTime: 5 * 60 * 1000, // 5분 — 같은 q 재요청 안 함
    placeholderData: (prev) => prev, // 새 q 입력 중 옛 결과 유지 (flicker 방지)
  })
}
