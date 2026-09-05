import {
  useProfile,
  useEducations,
  useLangCerts,
  useCerts,
  useAwards,
  useCoverletter,
  useDocuments,
} from '@/hooks/useMyinfo'
import { useExamSchedules } from '@/hooks/useExamSchedules'
import { useActivities } from '@/hooks/useActivities'
import { computeCoreSet, computeMyinfoSections, computeProgress } from '@/utils/myinfoProgress'

export function useMyinfoProgress() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: educations = [], isLoading: eduLoading } = useEducations()
  const { data: langCerts = [], isLoading: lcLoading } = useLangCerts()
  const { data: certs = [], isLoading: cLoading } = useCerts()
  const { data: exams = [], isLoading: eLoading } = useExamSchedules()
  const { data: awards = [], isLoading: aLoading } = useAwards()
  /**
   * 경력·경험 = **활동(`Activity`)** (계획 A′ — 저장소 하나, 입구 둘). 옛 `myinfo experiences`
   * 는 더 읽지 않는다. 기본함(퀵캡처 수신함)과 보관된 활동은 제외한다.
   * 한 목록으로 넘기고 `type` 으로 경력/경험을 가르는 건 `myinfoProgress` 의 몫이다.
   */
  const { data: allActivities = [], isLoading: xLoading } = useActivities(false)
  const experiences = allActivities.filter((a) => !a.isInbox && !a.archivedAt)
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

  /**
   * 게이지가 보는 값 — 「지원서 기본 세트 N/7」. 섹션 수를 세던 `progress` 는 사이드바·칩
   * (섹션별 ✓·개수)이 계속 쓰므로 같이 돌려준다.
   */
  const coreSet = computeCoreSet({
    profile,
    educations,
    langCerts,
    certs,
    awards,
    experiences,
    documents,
  })

  return { sections, ...progress, coreSet, isLoading }
}
