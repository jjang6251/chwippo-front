import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { autocompleteCompanies } from '@/api/companies'

/**
 * W2 — debounce 250ms + React Query.
 *
 * 빈 input 도 fetch — 모달을 열자마자 목록 자리를 만들어 둔다 (결과는 서버가 정한다).
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
