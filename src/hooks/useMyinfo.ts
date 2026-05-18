import { useMutation, useQuery, useQueryClient, QueryClient } from '@tanstack/react-query'
import * as api from '@/api/myinfo'

const STORAGE_KEY = ['myinfo', 'storage-usage'] as const

/** 파일 첨부 가능 항목의 mutation 후 — 해당 섹션 목록 + storage-usage 같이 무효화 */
function invalidateWithStorage(qc: QueryClient, section: readonly string[]) {
  return () => {
    qc.invalidateQueries({ queryKey: section })
    qc.invalidateQueries({ queryKey: STORAGE_KEY })
  }
}

// ── Profile ───────────────────────────────────────────────
export function useProfile() {
  return useQuery({ queryKey: ['myinfo', 'profile'], queryFn: api.getProfile })
}
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'profile'] }),
  })
}

// ── Language Certs ────────────────────────────────────────
export function useLangCerts() {
  return useQuery({ queryKey: ['myinfo', 'language-certs'], queryFn: api.getLangCerts })
}
export function useCreateLangCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createLangCert,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'language-certs']),
  })
}
export function useUpdateLangCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.LanguageCert> }) =>
      api.updateLangCert(id, dto),
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'language-certs']),
  })
}
export function useDeleteLangCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteLangCert,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'language-certs']),
  })
}

// ── Certs ─────────────────────────────────────────────────
export function useCerts() {
  return useQuery({ queryKey: ['myinfo', 'certs'], queryFn: api.getCerts })
}
export function useCreateCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createCert,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'certs']),
  })
}
export function useUpdateCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Cert> }) => api.updateCert(id, dto),
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'certs']),
  })
}
export function useDeleteCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCert,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'certs']),
  })
}

// ── Awards ────────────────────────────────────────────────
export function useAwards() {
  return useQuery({ queryKey: ['myinfo', 'awards'], queryFn: api.getAwards })
}
export function useCreateAward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createAward,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'awards']),
  })
}
export function useUpdateAward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Award> }) => api.updateAward(id, dto),
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'awards']),
  })
}
export function useDeleteAward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteAward,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'awards']),
  })
}

// ── Experiences (파일 없음 — 항목 수 한도만, storage 무관) ─
export function useExperiences() {
  return useQuery({ queryKey: ['myinfo', 'experiences'], queryFn: api.getExperiences })
}
export function useCreateExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createExperience,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'experiences'] }),
  })
}
export function useUpdateExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Experience> }) =>
      api.updateExperience(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'experiences'] }),
  })
}
export function useDeleteExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteExperience,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'experiences'] }),
  })
}

// ── Educations ────────────────────────────────────────────
export function useEducations() {
  return useQuery({ queryKey: ['myinfo', 'educations'], queryFn: api.getEducations })
}
export function useCreateEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createEducation,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'educations']),
  })
}
export function useUpdateEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Education> }) =>
      api.updateEducation(id, dto),
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'educations']),
  })
}
export function useDeleteEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteEducation,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'educations']),
  })
}

// ── Coverletter (파일 없음) ──────────────────────────────
export function useCoverletter() {
  return useQuery({ queryKey: ['myinfo', 'coverletter'], queryFn: api.getCoverletter })
}
export function useUpdateCoverletter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateCoverletter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'coverletter'] }),
  })
}
export function useCreateCustomItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ label, order_index }: { label: string; order_index: number }) =>
      api.createCustomItem(label, order_index),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'coverletter'] }),
  })
}
export function useUpdateCustomItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.CoverletterCustom> }) =>
      api.updateCustomItem(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'coverletter'] }),
  })
}
export function useDeleteCustomItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCustomItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'coverletter'] }),
  })
}

// ── Documents ─────────────────────────────────────────────
export function useDocuments() {
  return useQuery({ queryKey: ['myinfo', 'documents'], queryFn: api.getDocuments })
}
export function useCreateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createDocument,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'documents']),
  })
}
export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: invalidateWithStorage(qc, ['myinfo', 'documents']),
  })
}
