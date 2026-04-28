import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/myinfo'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'language-certs'] }),
  })
}
export function useUpdateLangCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.LanguageCert> }) =>
      api.updateLangCert(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'language-certs'] }),
  })
}
export function useDeleteLangCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteLangCert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'language-certs'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'certs'] }),
  })
}
export function useUpdateCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Cert> }) => api.updateCert(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'certs'] }),
  })
}
export function useDeleteCert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'certs'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'awards'] }),
  })
}
export function useUpdateAward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<api.Award> }) => api.updateAward(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'awards'] }),
  })
}
export function useDeleteAward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteAward,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'awards'] }),
  })
}

// ── Experiences ───────────────────────────────────────────
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

// ── Coverletter ───────────────────────────────────────────
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'documents'] }),
  })
}
export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myinfo', 'documents'] }),
  })
}
