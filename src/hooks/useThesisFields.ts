/**
 * 「논문」 섹션이 그릴 칸 — 필드 사전에서 **대학원 4키만** 골라 온다.
 * 어느 키를 보는지는 `@/utils/thesisFields` 가 단일 진실이다 (게이지도 같은 목록을 본다).
 *
 * 컴포넌트 파일이 아니라 여기 두는 이유는 Fast Refresh 규칙 —
 * 컴포넌트 파일은 컴포넌트만 export 한다 (`durationPresets.ts` 와 같은 이유).
 */
import { useFieldDictionary } from '@/hooks/useMyinfo'
import type { FieldDictionaryEntry } from '@/api/myinfo'
import { THESIS_FIELD_KEYS } from '@/utils/thesisFields'

/** 사전 응답 순서가 아니라 `THESIS_FIELD_KEYS` 순서로 그린다 */
export function useThesisFields(): FieldDictionaryEntry[] {
  const { data: dictionary, isError } = useFieldDictionary()
  if (isError) return []
  const byKey = new Map((dictionary?.fields ?? []).map((f) => [f.key, f]))
  return THESIS_FIELD_KEYS.flatMap((key) => {
    const f = byKey.get(key)
    // 민감·금지 항목은 슬롯에 저장하지 않는다 (우대·기타에서 지키던 규칙 그대로)
    return f && f.storage === 'extra' && !f.sensitive && !f.forbidden ? [f] : []
  })
}
