import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { autocompleteSchools, autocompleteMajors, autocompleteCerts, autocompleteLangCerts, type SchoolKind } from '@/api/schools'

export function useSchoolAutocomplete(rawQuery: string, kind: SchoolKind | null, enabled: boolean) {
  const [debouncedQ, setDebouncedQ] = useState(rawQuery)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])
  return useQuery({
    queryKey: ['schools', 'autocomplete', kind, debouncedQ],
    queryFn: () => (kind ? autocompleteSchools(debouncedQ, kind) : Promise.resolve([])),
    enabled: enabled && kind !== null,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useMajorAutocomplete(rawQuery: string, enabled: boolean) {
  const [debouncedQ, setDebouncedQ] = useState(rawQuery)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])
  return useQuery({
    queryKey: ['majors', 'autocomplete', debouncedQ],
    queryFn: () => autocompleteMajors(debouncedQ),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useCertAutocomplete(rawQuery: string, enabled: boolean) {
  const [debouncedQ, setDebouncedQ] = useState(rawQuery)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])
  return useQuery({
    queryKey: ['certs', 'autocomplete', debouncedQ],
    queryFn: () => autocompleteCerts(debouncedQ),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useLangCertAutocomplete(rawQuery: string, enabled: boolean) {
  const [debouncedQ, setDebouncedQ] = useState(rawQuery)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])
  return useQuery({
    queryKey: ['lang-certs', 'autocomplete', debouncedQ],
    queryFn: () => autocompleteLangCerts(debouncedQ),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
