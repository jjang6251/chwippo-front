import {
  useProfile,
  useEducations,
  useLangCerts,
  useCerts,
  useAwards,
  useExperiences,
  useCoverletter,
  useDocuments,
} from '@/hooks/useMyinfo'
import { useExamSchedules } from '@/hooks/useExamSchedules'
import { computeMyinfoSections, computeProgress } from '@/utils/myinfoProgress'

export function useMyinfoProgress() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: educations = [], isLoading: eduLoading } = useEducations()
  const { data: langCerts = [], isLoading: lcLoading } = useLangCerts()
  const { data: certs = [], isLoading: cLoading } = useCerts()
  const { data: exams = [], isLoading: eLoading } = useExamSchedules()
  const { data: awards = [], isLoading: aLoading } = useAwards()
  const { data: experiences = [], isLoading: xLoading } = useExperiences()
  const { data: coverletter, isLoading: clLoading } = useCoverletter()
  const { data: documents = [], isLoading: dLoading } = useDocuments()

  const isLoading = profileLoading || eduLoading || lcLoading || cLoading || eLoading || aLoading || xLoading || clLoading || dLoading

  const sections = computeMyinfoSections({
    profile,
    educations,
    langCerts,
    certs,
    examSchedules: exams,
    awards,
    experiences,
    documents,
    coverletter,
  })

  const progress = computeProgress(sections)

  return { sections, ...progress, isLoading }
}
