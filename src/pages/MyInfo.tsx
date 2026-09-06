import { useId, useRef, useState, useEffect, createContext, useContext, Fragment } from 'react'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useNativeMode } from '@/hooks/useNativeMode'
import { useDemoLink } from '@/hooks/useDemoLink'
import { Link, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  useProfile, useUpdateProfile,
  useLangCerts, useCreateLangCert, useUpdateLangCert, useDeleteLangCert,
  useCerts, useCreateCert, useUpdateCert, useDeleteCert,
  useAwards, useCreateAward, useUpdateAward, useDeleteAward,
  useEducations, useCreateEducation, useUpdateEducation, useDeleteEducation,
  useCoverletter, useUpdateCoverletter, useCreateCustomItem, useUpdateCustomItem, useDeleteCustomItem,
  useDocuments, useCreateDocument, useDeleteDocument,
} from '@/hooks/useMyinfo'
import { useExamSchedules, useDeleteExamSchedule } from '@/hooks/useExamSchedules'
import { useUpdateJobProfile } from '@/hooks/useJobProfile'
import { useAuthStore } from '@/stores/authStore'
import { JobTitleField } from '@/components/card/JobTitleField'
import type { JobProfileBody } from '@/api/users'
import { useActivities } from '@/hooks/useActivities'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'
import { HIGHEST_DEGREE_TO_EDU, type JumpOptions } from '@/utils/myinfoProgress'
import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'
import { addYears, todayLocal } from '@/utils/datetime'
import type {
  UserProfile, UpdateProfileDto, MilitaryStatus, MilitaryDischarge, HighestDegree,
  LanguageCert, Cert, Award, Coverletter, CoverletterCustom, MyDocument, Education,
  FieldDictionaryEntry,
} from '@/api/myinfo'
import { EducationModal } from '@/components/myinfo/EducationModal'
import type { ExamSchedule } from '@/types/exam-schedule'
import { toast } from '@/stores/toastStore'

/** 인터셉터가 이미 토스트를 띄웠으면 중복 알림 안 함 */
function notifySaveError(err: unknown, fallback = '저장에 실패했어요.') {
  const shown = (err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown
  if (!shown) toast.error(fallback)
}
import { CopyButton } from '@/components/myinfo/CopyButton'
import { FileUpload } from '@/components/myinfo/FileUpload'
import { EMPTY_SLOT, resolveFileForSubmit, slotFromExisting, type FileSlot } from '@/utils/fileSlot'
import { AddExamScheduleModal } from '@/components/myinfo/AddExamScheduleModal'
import { ConvertExamToCertModal } from '@/components/myinfo/ConvertExamToCertModal'
import { MyinfoProgressGauge } from '@/components/myinfo/MyinfoProgressGauge'
import { StorageUsageBar } from '@/components/myinfo/StorageUsageBar'
import { MyInfoItemRow } from '@/components/myinfo/MyInfoItemRow'
import { MyInfoEmptyAdd } from '@/components/myinfo/MyInfoEmptyAdd'
import { MyInfoViewRow } from '@/components/myinfo/MyInfoViewRow'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { InfoModal } from '@/components/myinfo/InfoModal'
import { CertAutocomplete } from '@/components/myinfo/CertAutocomplete'
import { LangCertAutocomplete } from '@/components/myinfo/LangCertAutocomplete'
import type { CertSuggestion, LangCertSuggestion } from '@/api/schools'
import { Field, FieldLabel, ModalSection, SelectField, FIELD_INPUT_CLASS, FIELD_SELECT_CLASS } from '@/components/myinfo/fields'
import { AddressField } from '@/components/myinfo/AddressField'
import { ExtrasSectionBody } from '@/components/myinfo/ExtrasSection'
import { ThesisSectionBody } from '@/components/myinfo/ThesisSection'
import { useThesisFields } from '@/hooks/useThesisFields'
import { GRAD_DEGREES } from '@/utils/thesisFields'
import { ExperienceFormModal, type ExperienceFormMode } from '@/components/myinfo/ExperienceFormModal'
import { SegmentedToggle } from '@/components/common/SegmentedToggle'
import { DurationChips } from '@/components/common/DurationChips'
import { MILITARY_PRESETS } from '@/utils/durationPresets'
import { HelpPill } from '@/components/common/HelpPill'
import { TYPE_KO } from '@/pages/Activity/constants'
import { useRemoveActivity } from '@/hooks/useActivities'
import { isCareerType } from '@/types/activity'
import type { Activity } from '@/types/activity'
import { DocumentSlotsBody } from '@/components/myinfo/DocumentSlotsSection'

// ── 섹션 메타데이터 ────────────────────────────────────────
/**
 * 🔴 **두 묶음** — 「지원서에 옮겨 적는 정보」와 「취업 준비 도구」가 한 줄로 섞여 있어서
 * 사용자가 「확장을 쓰려면 이걸 다 채워야 하나」로 읽었다. 페이지는 그대로 하나지만
 * (탭은 만들지 않는다 — 딥링크·모두 펼치기가 깨진다) 순서와 헤더로 답을 준다.
 */
const SECTIONS = [
  // ─── 지원서 정보 ───
  { id: 'profile',        label: '기본 인적사항', icon: '👤', accent: 'brand',   group: 'application' },
  { id: 'education',      label: '학력',         icon: '🎓', accent: 'success', group: 'application' },
  // 🔴 석·박사에게만 보인다 (`GRAD_DEGREES`) — 학사 지원자에게는 칩도 섹션도 없다
  { id: 'thesis',         label: '논문',         icon: '📄', accent: 'violet',  group: 'application' },
  { id: 'military',       label: '병역사항',     icon: '🪖', accent: 'warning', group: 'application' },
  { id: 'extras',         label: '우대·기타',     icon: '🎗️', accent: 'violet',  group: 'application' },
  // 경력·경험은 저장소가 하나지만 지원서에서는 다른 칸이다 (CEO 2026-09-06) — 나란히 두고 갈라 보여준다
  { id: 'career',         label: '경력',         icon: '💼', accent: 'success', group: 'application' },
  { id: 'experiences',    label: '경험',         icon: '🌱', accent: 'success', group: 'application' },
  { id: 'language-certs', label: '어학 자격증',   icon: '🌐', accent: 'success', group: 'application' },
  { id: 'certs',          label: '자격증',       icon: '📜', accent: 'brand',   group: 'application' },
  { id: 'awards',         label: '수상 내역',     icon: '🏆', accent: 'warning', group: 'application' },
  { id: 'files',          label: '지원 서류',     icon: '📁', accent: 'success', group: 'application' },
  // ─── 준비 도구 ───
  { id: 'coverletter',    label: '자소서 소재',   icon: '✍️', accent: 'brand',   group: 'tools' },
  { id: 'goals',          label: '스펙 목표',     icon: '🎯', accent: 'danger',  group: 'tools' },
  { id: 'exam-schedules', label: '시험 일정',     icon: '📚', accent: 'violet',  group: 'tools' },
] as const

type SectionGroup = 'application' | 'tools'

const GROUPS: { id: SectionGroup; title: string; blurb: string }[] = [
  // 확장 문장은 뺐다 — 아직 없는 것을 설명하면 「그거 없으면 소용없나」가 된다
  { id: 'application', title: '지원서 정보', blurb: '채용 폼에 옮겨 적는 정보예요' },
  { id: 'tools',       title: '준비 도구',   blurb: '지원서와 별개로 취업 준비를 돕는 것' },
]

/**
 * 게이지 칩이 섹션에 남기는 지시 — 「펴고 스크롤」 다음에 그 섹션이 할 일.
 * `seq` 는 **같은 칩을 다시 눌러도** 효과가 다시 돌게 하는 값이다 (옵션이 같으면 객체가
 * 같아 보여 effect 가 안 뛴다).
 */
export interface SectionIntent {
  section: string
  opts: JumpOptions
  seq: number
}

/** 각 그룹의 첫 섹션 id — 헤더·구분점을 여기 앞에 넣는다 */
const GROUP_FIRST_ID: Record<SectionGroup, string | undefined> = {
  application: SECTIONS.find((s) => s.group === 'application')?.id,
  tools: SECTIONS.find((s) => s.group === 'tools')?.id,
}

const ACCENT_STYLE = {
  brand:   { icon: 'bg-brand/15 text-brand',    border: 'border border-brand/25',   activeBorder: 'border-2 border-brand',   activeGlow: 'shadow-lg'   },
  warning: { icon: 'bg-warning/15 text-warning', border: 'border border-warning/25', activeBorder: 'border-2 border-warning', activeGlow: 'shadow-lg' },
  success: { icon: 'bg-success/15 text-success', border: 'border border-success/25', activeBorder: 'border-2 border-success', activeGlow: 'shadow-lg' },
  danger:  { icon: 'bg-danger/15 text-danger',   border: 'border border-danger/25',  activeBorder: 'border-2 border-danger',  activeGlow: 'shadow-lg'  },
  violet:  { icon: 'bg-violet/15 text-violet',   border: 'border border-violet/25',  activeBorder: 'border-2 border-violet',  activeGlow: 'shadow-lg'  },
}

// ── 섹션 collapsible 상태 (localStorage 보존) ─────────────
const COLLAPSE_KEY = 'myinfo:collapsed:v2'

interface CollapseCtxValue {
  isCollapsed: (id: string) => boolean
  toggle: (id: string) => void
}
const CollapseCtx = createContext<CollapseCtxValue | null>(null)

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const allIds = () => new Set<string>(SECTIONS.map((s) => s.id))
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY)
      // 첫 방문 (저장된 상태 없음) → 모두 접힘. 이후엔 사용자 마지막 상태 그대로.
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : allIds()
    } catch { return allIds() }
  })
  const persist = (next: Set<string>) => {
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
  }
  return {
    isCollapsed: (id: string) => collapsed.has(id),
    toggle: (id: string) => {
      const next = new Set(collapsed)
      if (next.has(id)) next.delete(id); else next.add(id)
      persist(next)
    },
    /** 게이지 칩이 보낸 섹션은 **펴서** 보여준다 — 접힌 채로 스크롤하면 헛걸음이다 */
    expand: (id: string) => {
      if (!collapsed.has(id)) return
      const next = new Set(collapsed)
      next.delete(id)
      persist(next)
    },
    collapseAll: () => persist(new Set(SECTIONS.map((s) => s.id))),
    expandAll: () => persist(new Set()),
    allCollapsed: collapsed.size >= SECTIONS.length,
  }
}

function useCollapse(): CollapseCtxValue {
  const ctx = useContext(CollapseCtx)
  return ctx ?? { isCollapsed: () => false, toggle: () => {} }
}

const MILITARY_BRANCHES = ['육군', '해군', '공군', '해병대', '사회복무요원', '산업기능요원', '전문연구요원']

// ── 자동저장 상태 ──────────────────────────────────────────
function useSaved() {
  const [saved, setSaved] = useState(false)
  const show = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  return { saved, show }
}

// ── 공통 인풋 ──────────────────────────────────────────────
// `ModalSection`·`FieldLabel`·`Field`·`SelectField` 는 `@/components/myinfo/fields` 로 옮겼다 —
// 새 섹션(우대·기타)과 경험 경량 폼이 같은 칸 톤을 써야 하는데, 화면 파일에서 import 하면
// 방향이 뒤집힌다. 클래스·동작은 그대로다 (이관만).

/** 자동완성 선택 후 자격증 정보 카드 (issuer · category · validYears) */
function CertInfoCard({ issuer, category, categoryColor, validYears }: {
  issuer: string; category?: string; categoryColor?: string; validYears?: number | null
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-text-primary flex-1 truncate">{issuer}</p>
        {category && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${categoryColor ?? 'bg-brand/15 text-brand'}`}>
            {category}
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-tertiary">
        {validYears === null ? '평생 유효 · 자격번호 발급' : validYears ? `유효기간 ${validYears}년` : ''}
      </p>
    </div>
  )
}

function DeleteModal({ label = '이 항목', onClose, onConfirm }: { label?: string; onClose: () => void; onConfirm: () => void }) {
  // 이 확인창은 InfoModal 위에 겹쳐 열린다 — capture 단계에서 ESC 를 선점하고 preventDefault 해야
  // 뒤에 있는 InfoModal 의 ESC 닫기(U14)가 먼저 먹어 편집 모달만 사라지는 일이 없다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${label} 삭제 확인`} className="bg-surface border border-line rounded-xl w-full max-w-xs p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold text-text-primary mb-1">삭제할까요?</p>
          <p className="text-xs text-text-quaternary">{label}을(를) 삭제하면 복구할 수 없어요.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 min-h-[44px] sm:min-h-0 text-xs border border-line text-text-secondary rounded-lg hover:bg-card active:bg-card-strong transition-colors">취소</button>
          <button type="button" onClick={onConfirm} className="flex-1 py-2.5 min-h-[44px] sm:min-h-0 text-xs font-semibold bg-danger/90 hover:bg-danger text-text-primary rounded-lg transition-colors">삭제</button>
        </div>
      </div>
    </div>
  )
}

// ── 섹션 카드 ─────────────────────────────────────────────
function SectionCard({ id, sectionRef, saved, isActive, headerRight, children }: {
  id: string; sectionRef: (el: HTMLElement | null) => void; saved?: boolean; isActive?: boolean; headerRight?: React.ReactNode; children: React.ReactNode
}) {
  const meta = SECTIONS.find(s => s.id === id)!
  const ac = ACCENT_STYLE[meta.accent as keyof typeof ACCENT_STYLE]
  const { isCollapsed, toggle } = useCollapse()
  const closed = isCollapsed(id)
  return (
    <section id={id} ref={sectionRef as React.RefCallback<HTMLElement>} className={`rounded-xl transition-[border-color,box-shadow] duration-300 bg-card overflow-hidden
      ${isActive ? `${ac.activeBorder} ${ac.activeGlow}` : ac.border}`}>
      {/*
        🔴 `<button>` **안**의 `<h2>` 는 제목이 아니다 — 버튼 내용은 한 줄 이름으로 납작해져
        heading 역할이 사라진다. 그래서 페이지에 섹션 제목이 하나도 없었다. 뒤집어서 heading 이
        버튼을 감싼다 (`h3` — 그룹 헤더가 `h2` 다). 클래스는 그대로라 보이는 모습은 같다.
      */}
      <h3>
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={!closed}
          aria-controls={closed ? undefined : `${id}-body`}
          className={`w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-2/40 transition-colors ${closed ? '' : 'border-b border-line'}`}
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${ac.icon}`}>{meta.icon}</span>
            <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            {saved && (
              <span className="text-[10px] font-medium text-success flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                저장됨
              </span>
            )}
            <CollapsibleChevron open={!closed} />
          </div>
        </button>
      </h3>
      {/*
        접힌 동안 본문을 **떼어 낸다** — 섹션 12개의 폼·업로더를 늘 붙여 두면 접기가 무의미하다.
        그래서 `aria-controls` 도 열려 있을 때만 건다 (없는 id 를 가리키는 것보다 안 거는 게 낫다).
      */}
      {!closed && <div id={`${id}-body`} className="px-6 py-5">{children}</div>}
    </section>
  )
}

/**
 * 두 묶음의 경계 — 옛 「기타」 구분선을 확장한 정도로 **가볍게** 둔다.
 * 탭이 아니라 헤더인 이유: 딥링크(`#goals`)·「모두 펼치기」·스크롤 스파이가 한 페이지를
 * 전제로 짜여 있고, 탭을 넣으면 그 셋이 모두 깨진다.
 */
function GroupHeader({ group }: { group: SectionGroup }) {
  const meta = GROUPS.find((g) => g.id === group)!
  return (
    <div className={group === 'application' ? '' : 'pt-3 border-t border-line'}>
      <h2 className="text-[13px] font-bold text-text-primary">{meta.title}</h2>
      <p className="text-text-tertiary text-xs mt-1">{meta.blurb}</p>
    </div>
  )
}

function AddButton({ onClick, label = '추가' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-line hover:border-brand/30 rounded-xl py-3 min-h-[44px] sm:min-h-0 transition-colors flex items-center justify-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
export function MyInfo() {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [activeSection, setActiveSection] = useState('profile')
  const isProgrammaticScroll = useRef(false)
  const scrollLockTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const location = useLocation()
  const { sections: progressSections } = useMyinfoProgress()
  const collapse = useCollapsedSections()
  /*
    「논문」은 조건이 둘이다 — 최종 학력이 석·박사이고, 사전이 그 4키를 준다.
    칩(사이드바·모바일)과 본문이 **같은 조건**을 봐야 한다: 한쪽만 걸면 눌러도 아무 데도
    안 가는 칩이 남는다.
  */
  const { data: myProfile } = useProfile()
  const thesisFields = useThesisFields()
  const showThesis =
    !!myProfile?.highest_degree &&
    (GRAD_DEGREES as readonly string[]).includes(myProfile.highest_degree) &&
    thesisFields.length > 0
  const visibleSections = SECTIONS.filter((s) => s.id !== 'thesis' || showThesis)
  /** 게이지 칩이 남긴 지시 (편집 열기·칸 포커스) — 대상 섹션 하나만 읽는다 */
  const [intent, setIntent] = useState<SectionIntent | null>(null)
  const seqRef = useRef(0)
  // 네이티브 앱은 웹 모바일 헤더(h-12)가 숨겨지므로 sticky 오프셋을 0으로 —
  // top-12 를 그대로 두면 칩 바가 상단에서 48px 떠서 스크롤됨 (CEO 실기 2026-07-19)
  const isNative = useNativeMode()

  // 활성 탭이 화면 밖이면 가로 스크롤로 중앙으로 끌어옴 (모바일 sticky 칩)
  useEffect(() => {
    const btn = tabRefs.current[activeSection]
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeSection])

  // URL hash로 진입 시 해당 섹션으로 자동 스크롤 (예: /myinfo#goals)
  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return
    const tryScroll = (attempts = 0) => {
      const el = sectionRefs.current[hash]
      if (el) {
        setActiveSection(hash)
        isProgrammaticScroll.current = true
        const top = el.getBoundingClientRect().top + window.scrollY - 24
        window.scrollTo({ top, behavior: 'smooth' })
        scrollLockTimer.current = setTimeout(() => { isProgrammaticScroll.current = false }, 800)
      } else if (attempts < 10) {
        setTimeout(() => tryScroll(attempts + 1), 100)
      }
    }
    tryScroll()
  }, [location.hash])

  useEffect(() => {
    // scrollY + viewport 상단 100px 지점 기준 — 어느 섹션의 [top, bottom] 안에 들어가는가
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return

      const bounds = SECTIONS.flatMap(({ id }) => {
        const el = sectionRefs.current[id]
        if (!el) return []
        const rect = el.getBoundingClientRect()
        return [{
          id: id as string,
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
        }]
      })

      // 페이지 끝 도달 시 마지막 섹션 강제 (모바일 주소창 영향 고려해 -10)
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10
      if (atBottom) {
        setActiveSection(SECTIONS[SECTIONS.length - 1].id)
        return
      }

      // viewport 중앙 지점이 어느 섹션의 [top, bottom] 안에 있는가 — 짧은 섹션도 안정적으로 잡힘
      const probe = window.scrollY + window.innerHeight / 2
      const active = bounds.find((b) => b.top <= probe && b.bottom > probe)
      if (active) setActiveSection(active.id)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id]
    if (!el) return
    setActiveSection(id)
    isProgrammaticScroll.current = true
    clearTimeout(scrollLockTimer.current)
    const top = el.getBoundingClientRect().top + window.scrollY - 24
    window.scrollTo({ top, behavior: 'smooth' })
    scrollLockTimer.current = setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 800)
  }

  /**
   * 게이지 칩 → 해당 섹션을 **펴고** 이동 (접힌 채 스크롤하면 빈 헤더만 본다).
   *
   * 🔴 여기서 끝내면 도착지가 **보기 모드의 빈 줄**이다 — 칩이 「비었다」고 해서 눌렀는데
   * [편집] 을 한 번 더 찾아야 한다. `opts` 가 그 한 걸음을 없앤다.
   */
  const jumpTo = (id: string, opts?: JumpOptions) => {
    collapse.expand(id)
    scrollTo(id)
    if (!opts) { setIntent(null); return }
    seqRef.current += 1
    setIntent({ section: id, opts, seq: seqRef.current })
  }
  /** 지시는 **그 섹션에만** 전달한다 — 객체 동일성이 유지돼야 effect 가 헛돌지 않는다 */
  const intentFor = (id: string) => (intent?.section === id ? intent : null)

  return (
    <CollapseCtx.Provider value={{ isCollapsed: collapse.isCollapsed, toggle: collapse.toggle }}>
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-text-primary text-xl font-bold">내 정보 창고</h1>
          {/* 두 줄이 서로를 반쯤 되풀이했다 — 「무엇을 하는 곳」과 「어떻게 저장되나」 한 줄로 */}
          <p className="text-text-tertiary text-xs mt-1.5">지원서·자소서에 쓰는 정보를 한 번만 적어 두는 곳이에요. 칸을 벗어나면 저장돼요.</p>
        </div>
        <button
          type="button"
          onClick={() => collapse.allCollapsed ? collapse.expandAll() : collapse.collapseAll()}
          className="shrink-0 text-[11px] font-medium text-text-tertiary hover:text-text-primary px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md border border-line hover:bg-card-strong touch-manipulation transition-colors"
        >
          {collapse.allCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>
      </div>

      <div className="mb-6 space-y-3">
        <MyinfoProgressGauge onJump={jumpTo} />
        <StorageUsageBar />
      </div>

      {/* 모바일 섹션 점프 칩 — lg 이상에서는 좌측 사이드바로 대체 */}
      <nav aria-label="섹션 바로가기" className={`lg:hidden sticky ${isNative ? 'top-0' : 'top-12'} z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-bg/95 backdrop-blur-sm border-b border-line mb-4`}>
        <div
          className="flex gap-1.5 overflow-x-auto py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {visibleSections.map((s) => {
            const isActive = activeSection === s.id
            const status = progressSections.find((p) => p.id === s.id)
            return (
              <Fragment key={s.id}>
                {/* 두 묶음 사이 구분점 하나 — 칩 바는 좁아서 헤더가 들어갈 자리가 없다 */}
                {s.id === GROUP_FIRST_ID.tools && (
                  <span aria-hidden="true" className="flex-none self-center text-text-quaternary px-0.5">·</span>
                )}
                {/* 지금 보고 있는 섹션 칩은 `aria-current` 로도 말해야 한다 — 색만으로는 안 들린다 */}
                <button
                  ref={(el) => { tabRefs.current[s.id] = el }}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => scrollTo(s.id)}
                  className={`flex-none flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-full text-[11px] font-medium whitespace-nowrap touch-manipulation transition-colors duration-150 border
                    ${isActive
                      ? 'bg-brand/15 text-brand border-brand/30'
                      : 'bg-card text-text-quaternary border-line hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {status && status.active && (
                    status.kind === 'multi'
                      ? <span className={`text-[10px] font-mono tabular-nums ${status.count > 0 ? 'text-brand' : 'text-text-quaternary'}`}>({status.count})</span>
                      : status.filled
                        ? <span className="text-success text-[10px]">✓</span>
                        : null
                  )}
                </button>
              </Fragment>
            )
          })}
        </div>
      </nav>

      <div className="flex gap-8">
        {/* 좌측 섹션 네비 */}
        <aside className="hidden lg:block w-44 flex-none sticky top-8 self-start">
          <nav className="space-y-0.5">
            {visibleSections.map((s) => {
              const ac = ACCENT_STYLE[s.accent as keyof typeof ACCENT_STYLE]
              const isActive = activeSection === s.id
              const status = progressSections.find((p) => p.id === s.id)
              // 그룹 라벨은 옛 「기타」 구분선 자리를 그대로 쓴다 — 두 묶음이 사이드바에서도
              // 같은 경계로 보여야 본문의 그룹 헤더와 어긋나지 않는다.
              const groupHead = GROUPS.find((g) => GROUP_FIRST_ID[g.id] === s.id)
              return (
                <div key={s.id}>
                  {groupHead && (
                    <div className={`px-3 ${groupHead.id === 'application' ? 'mb-2' : 'my-2'}`}>
                      {groupHead.id !== 'application' && <div className="h-px bg-card-strong mb-2" />}
                      <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider">{groupHead.title}</p>
                    </div>
                  )}
                {/* 모바일 칩의 짝 — 지금 보는 섹션은 색만이 아니라 `aria-current` 로도 말한다 */}
                <button
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150
                    ${isActive
                      ? 'bg-card-strong text-text-primary border-l-2 border-brand pl-[10px]'
                      : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong border-l-2 border-transparent pl-[10px]'
                    }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm flex-none transition-colors ${isActive ? ac.icon : 'bg-card opacity-70'}`}>{s.icon}</span>
                  <span className="text-[11px] font-medium truncate flex-1">{s.label}</span>
                  {status && status.active && (
                    status.kind === 'multi'
                      ? <span className={`text-[10px] font-mono tabular-nums flex-none ${status.count > 0 ? 'text-brand' : 'text-text-quaternary'}`}>({status.count})</span>
                      : status.filled
                        ? <span className="text-success text-[10px] flex-none" aria-label="채움 완료">✓</span>
                        : <span className="text-text-quaternary text-[10px] flex-none" aria-label="미입력">○</span>
                  )}
                </button>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* 우측 섹션들 — SECTIONS 배열 순서와 동일 */}
        <div className="flex-1 space-y-5 min-w-0">
          <GroupHeader group="application" />
          <ProfileSection       sectionRef={(el) => { sectionRefs.current['profile'] = el }}          isActive={activeSection === 'profile'}   intent={intentFor('profile')} />
          <EducationsSection    sectionRef={(el) => { sectionRefs.current['education'] = el }}        isActive={activeSection === 'education'} intent={intentFor('education')} />
          {showThesis && (
            <ThesisSection      sectionRef={(el) => { sectionRefs.current['thesis'] = el }}          isActive={activeSection === 'thesis'} fields={thesisFields} />
          )}
          <MilitarySection      sectionRef={(el) => { sectionRefs.current['military'] = el }}         isActive={activeSection === 'military'}  intent={intentFor('military')} />
          <ExtrasSection        sectionRef={(el) => { sectionRefs.current['extras'] = el }}          isActive={activeSection === 'extras'}    intent={intentFor('extras')} />
          <ActivitySection mode="career"     sectionRef={(el) => { sectionRefs.current['career'] = el }}      isActive={activeSection === 'career'} />
          <ActivitySection mode="experience" sectionRef={(el) => { sectionRefs.current['experiences'] = el }} isActive={activeSection === 'experiences'} />
          <LangCertsSection     sectionRef={(el) => { sectionRefs.current['language-certs'] = el }}   isActive={activeSection === 'language-certs'} />
          <CertsSection         sectionRef={(el) => { sectionRefs.current['certs'] = el }}            isActive={activeSection === 'certs'} />
          <AwardsSection        sectionRef={(el) => { sectionRefs.current['awards'] = el }}           isActive={activeSection === 'awards'} />
          <FilesSection         sectionRef={(el) => { sectionRefs.current['files'] = el }}            isActive={activeSection === 'files'} onJump={jumpTo} />

          <GroupHeader group="tools" />
          <CoverletterSection   sectionRef={(el) => { sectionRefs.current['coverletter'] = el }}      isActive={activeSection === 'coverletter'} />
          <GoalsSection         sectionRef={(el) => { sectionRefs.current['goals'] = el }}            isActive={activeSection === 'goals'} />
          <ExamSchedulesSection sectionRef={(el) => { sectionRefs.current['exam-schedules'] = el }}   isActive={activeSection === 'exam-schedules'} />
        </div>
      </div>
    </div>
    </CollapseCtx.Provider>
  )
}

// ── 기본 인적사항 ─────────────────────────────────────────
const GENDER_KO: Record<string, string> = { MALE: '남성', FEMALE: '여성' }
/**
 * 「인적사항이 하나라도 채워졌나」 판정 대상.
 *
 * 🔴 새로 늘어난 칸(영문 이름·주소·국적·비상연락처)도 여기 있어야 한다 — 없으면 주소만
 * 채운 사용자가 새로고침했을 때 빈 상태 카드가 덮어써서 **자기가 넣은 값을 못 본다.**
 */
const PROFILE_FIELDS: Array<keyof UserProfile> = [
  'name', 'name_hanja', 'gender', 'birthdate', 'phone', 'email_personal',
  'name_en_last', 'name_en_first',
  'address_zip', 'address_base', 'address_detail', 'address_region',
  'nationality_2', 'emergency_phone', 'emergency_relation',
  // ⚠️ `nationality` 는 일부러 뺐다 — 서버 기본값이 '대한민국' 이라 넣으면 **모든 계정이**
  //    「채워짐」이 되어 빈 상태 카드가 아무에게도 안 뜬다.
]

/** 비상연락처 관계 — 지원서 4곳이 같은 목록을 쓴다 */
const EMERGENCY_RELATIONS = ['부', '모', '배우자', '형제자매', '친척', '지인', '기타']

/**
 * ② **정식 자리** — 희망 직무·계열 (`plans/job-role-first.md` 묶음 3).
 *
 * 온보딩에서 한 번 정한 직무·계열을 나중에 바꾸는 **본 자리**다. 설정이 아니라 여기인 이유는
 * 설정 페이지가 기기·계정 옵션(알림·테마·로그아웃)의 집이고, 이건 **내 이력 데이터**라서다 —
 * 이름·연락처와 같은 카드에 있는 게 맞다.
 *
 * ## 항상 보인다 — `hasAny` 와 무관하게
 *
 * 인적사항이 통째로 비어 있어도 직무는 온보딩에서 이미 채워졌을 수 있고, 반대도 마찬가지다.
 * 빈 상태 카드(`MyInfoEmptyAdd`)에 가려지면 「바꾸러 왔는데 없다」가 된다.
 *
 * ## 저장 — 필드 단위 자동 저장 (이 카드의 다른 필드와 같은 규칙)
 *
 * - **blur** → 그 사이에 실제로 바뀐 것만 싣는다 (직무 + 그에 따라 옮겨간 계열)
 * - **계열을 손으로 고르면** 즉시 (pill 은 blur 를 기다릴 자리가 아니다)
 * - 🔴 **타이핑 중 추론 계열은 저장하지 않는다** — `onSeriesChange` 는 글자마다 오므로
 *   그대로 저장하면 「간」→「간호」→「간호사」에 PATCH 가 세 번 난다. blur 가 한 번에 싣는다
 *
 * ## 🔴 직무를 비워도 계열은 남는다
 *
 * 온보딩에서 **계열만 고른 사용자가 다수**다 (직무 타이핑은 선택이었다). 그들에게 이 칸은
 * 처음부터 비어 있고, 그 상태에서 계열이 지워지면 자기 계열을 볼 수도 바꿀 수도 없게 된다.
 * `seriesIsSaved` 가 그 계약을 건다 — 판정이 없으면 `JobTitleField` 는 계열을 **건드리지 않고**
 * 저장된 값을 칩으로 그대로 보여준다. 「이 칸 비움」은 「계열 취소」가 아니다.
 */
function JobProfileBlock({ onSaved }: { onSaved: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { mutate } = useUpdateJobProfile()

  const storedTitle = user?.signupJobTitle ?? null
  const storedSeries = user?.signupSeriesId ?? null

  const [title, setTitle] = useState(storedTitle ?? '')
  const [seriesId, setSeriesId] = useState<string | null>(storedSeries)

  const save = (body: JobProfileBody) => mutate(body, { onSuccess: onSaved })

  const handleBlur = () => {
    // 비운 건 「모름」의 정직한 상태다 — 빈 문자열이 아니라 null 로 보낸다
    const nextTitle = title.trim() || null
    const body: JobProfileBody = {}
    if (nextTitle !== storedTitle) body.jobTitle = nextTitle
    /*
      계열은 **판정이 실제로 옮겨갔을 때만** 함께 실린다. `seriesIsSaved` 덕에 판정이
      없으면 `seriesId` 가 저장값 그대로라, 여기서 자동으로 빠진다 — 직무를 비웠다고
      계열까지 null 로 나가지 않는다.
    */
    if (seriesId !== storedSeries) body.seriesId = seriesId
    // 바뀐 게 없으면 안 부른다 — 서버가 400 을 주는 빈 body 이기도 하다
    if (body.jobTitle === undefined && body.seriesId === undefined) return
    save(body)
  }

  // 🔴 `seriesIsSaved` 모드라 여기 `id` 는 **절대 null 이 아니다** (판정 없음은 안 올라온다)
  const handleSeriesChange = (id: string | null, manual: boolean) => {
    setSeriesId(id)
    if (!manual || id === storedSeries) return
    save({ seriesId: id })
  }

  return (
    <div className="mb-5 pb-5 border-b border-line">
      <JobTitleField
        variant="field"
        labelText="희망 직무"
        placeholder="예: 마케터, 간호사, 회계 담당자"
        value={title}
        onChange={(v) => setTitle(v)}
        onBlur={handleBlur}
        seriesId={seriesId}
        seriesIsSaved
        onSeriesChange={handleSeriesChange}
      />
      {/*
        「AI 가 이 기준으로 만든다」는 JobTitleField 가 바로 위에서 이미 말한다 —
        여기선 **이 화면에서만 알 수 있는 것**(카드 프리필)만 덧붙인다.
      */}
      <p className="text-xs text-text-tertiary mt-2">
        카드 추가할 때 이 직무가 미리 채워져요
      </p>
    </div>
  )
}

/** 🔴 `export` 는 테스트 전용이다 — 페이지는 아래 `MyInfo` 가 직접 조립한다 */
export function ProfileSection({ sectionRef, isActive, intent }: {
  sectionRef: (el: HTMLElement | null) => void; isActive?: boolean; intent?: SectionIntent | null
}) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()
  /** 게이지 칩이 지목한 칸을 찾을 범위 — 편집 폼 안쪽만 본다 */
  const formRef = useRef<HTMLDivElement>(null)

  const init = {
    name: '', name_hanja: '', gender: '', birthdate: '', phone: '', email_personal: '',
    name_en_last: '', name_en_first: '',
    address_zip: '', address_base: '', address_detail: '', address_region: '',
    nationality: '', nationality_2: '',
    emergency_phone: '', emergency_relation: '',
  }
  const [form, setForm] = useState(init)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  /** 이중 국적 칸은 접어 둔다 — 5/11 폼만 묻고, 그중에서도 두 번째 국적은 드물다 */
  const [showSecondNationality, setShowSecondNationality] = useState(false)

  if (profile && !loaded) {
    setForm({
      name: profile.name ?? '', name_hanja: profile.name_hanja ?? '',
      gender: profile.gender ?? '', birthdate: profile.birthdate ?? '',
      phone: profile.phone ?? '', email_personal: profile.email_personal ?? '',
      name_en_last: profile.name_en_last ?? '', name_en_first: profile.name_en_first ?? '',
      address_zip: profile.address_zip ?? '', address_base: profile.address_base ?? '',
      address_detail: profile.address_detail ?? '', address_region: profile.address_region ?? '',
      // 기본값 「대한민국」 — 5/11 폼이 국적을 묻고 거의 전부 대한민국이다
      nationality: profile.nationality ?? '대한민국',
      nationality_2: profile.nationality_2 ?? '',
      emergency_phone: profile.emergency_phone ?? '', emergency_relation: profile.emergency_relation ?? '',
    })
    setShowSecondNationality(!!profile.nationality_2)
    /*
      🔴 이름·연락처가 **둘 다** 비었으면 처음부터 편집 폼이다. 보기 모드의 「—」 줄 열 개는
      「없다」만 알려 주고 채울 방법은 안 알려 준다 — 창고의 첫 화면이 그러면 안 된다.
      둘 중 하나라도 있으면 이미 쓰던 사람이라 보기 모드가 맞다.
    */
    if (!profile.name?.trim() && !profile.phone?.trim()) setEditing(true)
    setLoaded(true)
  }

  /*
    게이지 칩이 보낸 지시 — 편집으로 열고, 폼이 붙은 다음 렌더에서 그 칸에 포커스한다.
    (`setEditing` 은 같은 tick 에 DOM 을 바꾸지 않으므로 두 번에 나눠 처리한다)
  */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!intent) return
    if (intent.opts.edit && !editing) { setEditing(true); return }
    const key = intent.opts.focus
    // eslint-disable-next-line chwippo/no-bare-autofocus -- 게이지 칩을 탭한 뒤에만 도는 이동이다 (열자마자 포커스가 아니다)
    if (key) formRef.current?.querySelector<HTMLElement>(`[name="${key}"]`)?.focus()
  }, [intent, editing])
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = (key: string, val: string) =>
    update({ [key]: val || null } as UpdateProfileDto, { onSuccess: show })

  /** 여러 칸을 한 번에 (주소 검색 결과처럼 한 동작에서 여러 값이 정해질 때) */
  const savePatch = (patch: Record<string, string>) => {
    const dto = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v || null]),
    ) as UpdateProfileDto
    update(dto, { onSuccess: show })
  }

  const hasAny = !!profile && PROFILE_FIELDS.some((k) => (profile[k] ?? '').toString().trim().length > 0)

  return (
    <SectionCard id="profile" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      {/* 🔴 빈 상태 카드보다 **위** — 인적사항이 비어도 직무는 채워져 있을 수 있다 */}
      <JobProfileBlock onSaved={show} />
      {!hasAny && !editing ? (
        <MyInfoEmptyAdd
          emoji="👤"
          label="기본 인적사항 입력하기"
          example="예: 이름 · 성별 · 생년월일 · 연락처"
          onClick={() => setEditing(true)}
        />
      ) : (
        <div>
          <div className="flex justify-end -mt-1 mb-2">
            <EditToggleButton editing={editing} onClick={() => setEditing((v) => !v)} />
          </div>
          {editing ? (
            /*
              🔴 편집 폼에는 복사 버튼을 두지 않는다 — 쓰는 중에 칸 오른쪽을 가리고, 값이
              아직 저장 전이라 「지금 복사한 게 저장된 값인가」가 애매하다. 복사는 보기 모드의
              몫이다 (`MyInfoViewRow copyable`).
            */
            <div className="space-y-6" ref={formRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* 브라우저가 이미 아는 값(이름·연락처·주소)은 창고에서도 그대로 받는다 — 타이핑이 0 이 된다 */}
                <Field name="name" label="이름" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} onBlur={() => save('name', form.name)} placeholder="홍길동" required autoComplete="name" />
                {/* 빈도 pill 은 **데스크탑에서만** 라벨 옆에 — 모바일은 섹션 헤더 하나로 충분하다 */}
                <Field name="name_hanja" label="이름 (한자)" value={form.name_hanja} onChange={(v) => setForm(f => ({ ...f, name_hanja: v }))} onBlur={() => save('name_hanja', form.name_hanja)} placeholder="洪吉童" />
                {/* 저장값은 `MALE`·`FEMALE` 이지만 사람에게는 「남성」·「여성」으로 보인다 */}
                <SelectField name="gender" label="성별" value={form.gender} onChange={(v) => { setForm(f => ({ ...f, gender: v })); save('gender', v) }} options={['MALE', 'FEMALE']} optionLabels={GENDER_KO} />
                <Field name="birthdate" label="생년월일" type="date" value={form.birthdate} onChange={(v) => { setForm(f => ({ ...f, birthdate: v })); save('birthdate', v) }} />
                <Field name="phone" label="연락처" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} onBlur={() => save('phone', form.phone)} placeholder="010-0000-0000" autoComplete="tel" inputMode="tel" />
                <Field name="email_personal" label="이메일" value={form.email_personal} onChange={(v) => setForm(f => ({ ...f, email_personal: v }))} onBlur={() => save('email_personal', form.email_personal)} placeholder="example@email.com" autoComplete="email" inputMode="email" spellCheck={false} />
              </div>

              {/* 영문 이름 — 지원서 8/11 이 묻고, 그중 여럿이 성/이름을 **분리** 입력받는다 */}
              <div className="pt-5 border-t border-line">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* 「영문이름」은 실측에서 성/이름 한 항목이다 — pill 은 그룹의 첫 칸에만 */}
                  <Field name="name_en_last" label="영문 성" value={form.name_en_last} onChange={(v) => setForm(f => ({ ...f, name_en_last: v }))} onBlur={() => save('name_en_last', form.name_en_last)} placeholder="HONG" maxLength={40} autoComplete="family-name" />
                  <Field name="name_en_first" label="영문 이름" value={form.name_en_first} onChange={(v) => setForm(f => ({ ...f, name_en_first: v }))} onBlur={() => save('name_en_first', form.name_en_first)} placeholder="GILDONG" maxLength={40} autoComplete="given-name" />
                </div>
                <HelpPill label="입력 형식">영문 성, 이름 순 · 예 HONG GILDONG (대문자)</HelpPill>
              </div>

              {/* 주소 — 8/11 이 묻고 4곳은 우편번호 팝업을 쓴다 */}
              <div className="pt-5 border-t border-line">
                <AddressField
                  value={{
                    address_zip: form.address_zip,
                    address_base: form.address_base,
                    address_detail: form.address_detail,
                    address_region: form.address_region,
                  }}
                  onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
                  onCommit={savePatch}
                />
              </div>

              {/* 국적 · 비상연락처 */}
              <div className="pt-5 border-t border-line space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field name="nationality" label="국적" value={form.nationality} onChange={(v) => setForm(f => ({ ...f, nationality: v }))} onBlur={() => save('nationality', form.nationality)} placeholder="대한민국" maxLength={40} />
                  {showSecondNationality ? (
                    <Field label="추가 국적" value={form.nationality_2} onChange={(v) => setForm(f => ({ ...f, nationality_2: v }))} onBlur={() => save('nationality_2', form.nationality_2)} placeholder="이중 국적이 있다면" maxLength={40} />
                  ) : (
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setShowSecondNationality(true)}
                        className="min-h-[44px] px-3 text-[13px] font-medium text-text-tertiary hover:text-brand border border-dashed border-line hover:border-brand/30 rounded-xl transition-colors"
                      >
                        + 추가 국적
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field name="emergency_phone" label="비상 연락처" type="tel" value={form.emergency_phone} onChange={(v) => setForm(f => ({ ...f, emergency_phone: v }))} onBlur={() => save('emergency_phone', form.emergency_phone)} placeholder="010-0000-0000" maxLength={20} autoComplete="tel" inputMode="tel" />
                  <SelectField label="비상 연락처 관계" value={form.emergency_relation} onChange={(v) => { setForm(f => ({ ...f, emergency_relation: v })); save('emergency_relation', v) }} options={EMERGENCY_RELATIONS} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <MyInfoViewRow label="이름" value={profile?.name} copyable />
              <MyInfoViewRow label="이름 (한자)" value={profile?.name_hanja} copyable />
              <MyInfoViewRow label="영문 이름" value={[profile?.name_en_last, profile?.name_en_first].filter(Boolean).join(' ')} copyable />
              <MyInfoViewRow label="성별" value={profile?.gender ? GENDER_KO[profile.gender] : ''} />
              <MyInfoViewRow label="생년월일" value={profile?.birthdate} />
              <MyInfoViewRow label="연락처" value={profile?.phone} copyable />
              <MyInfoViewRow label="이메일" value={profile?.email_personal} copyable />
              <MyInfoViewRow
                label="주소"
                value={[
                  profile?.address_zip ? `(${profile.address_zip})` : '',
                  profile?.address_base,
                  profile?.address_detail,
                ].filter(Boolean).join(' ')}
                copyable
              />
              <MyInfoViewRow label="국적" value={[profile?.nationality, profile?.nationality_2].filter(Boolean).join(' · ')} />
              <MyInfoViewRow label="비상 연락처" value={[profile?.emergency_phone, profile?.emergency_relation].filter(Boolean).join(' · ')} copyable />
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ── 편집/완료 토글 버튼 ───────────────────────────────────
function EditToggleButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  if (editing) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-accent px-2.5 py-1 rounded-md bg-brand/10 hover:bg-brand/15 transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M2 6L4.5 8.5L9 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        완료
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-brand px-2 py-1 rounded-md hover:bg-card-strong transition-colors"
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <path d="M7.5 1.5L9.5 3.5L4 9H2V7L7.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      편집
    </button>
  )
}

// ── 병역사항 ──────────────────────────────────────────────
/**
 * 병역 상태 9종 — 지원서 폼 합집합(현대차 9 · 현대카드 6 · 우리은행 4)을 그대로 담았다.
 * 기본 = **비대상**. 대부분의 사용자는 여기서 손을 안 댄다 (센서스 「입력 UX 관찰」 #1).
 */
const MILITARY_STATUS_OPTIONS: { value: MilitaryStatus; label: string }[] = [
  { value: 'not_applicable', label: '비대상' },
  { value: 'completed', label: '군필' },
  { value: 'serving', label: '복무 중' },
  { value: 'discharge_expected', label: '전역예정' },
  { value: 'not_completed', label: '미필' },
  { value: 'exempted', label: '면제' },
  { value: 'alt_service_serving', label: '특례 복무 중' },
  { value: 'alt_service_completed', label: '특례 필' },
  { value: 'medical_discharge', label: '의가사 전역' },
]

/** 군별·계급·병과·복무기간·제대구분을 펴는 상태들 */
const MILITARY_DETAIL_STATUSES: MilitaryStatus[] = [
  'completed', 'serving', 'discharge_expected',
  'alt_service_serving', 'alt_service_completed', 'medical_discharge',
]
/** 사유 한 칸만 묻는 상태들 */
const MILITARY_REASON_STATUSES: MilitaryStatus[] = ['not_completed', 'exempted']

const MILITARY_DISCHARGE_OPTIONS: { value: MilitaryDischarge; label: string }[] = [
  { value: 'honorable', label: '만기전역' },
  { value: 'medical', label: '의병전역' },
  { value: 'release_from_call', label: '소집해제' },
  { value: 'wounded', label: '상이전역' },
  { value: 'dishonorable', label: '불명예전역' },
  { value: 'other', label: '기타' },
]

const MILITARY_STATUS_KO: Record<MilitaryStatus, string> =
  Object.fromEntries(MILITARY_STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<MilitaryStatus, string>
const MILITARY_DISCHARGE_KO: Record<MilitaryDischarge, string> =
  Object.fromEntries(MILITARY_DISCHARGE_OPTIONS.map((o) => [o.value, o.label])) as Record<MilitaryDischarge, string>

/** 옛 `military_type`(한글 라벨) → 새 `military_discharge` 코드값 */
const LEGACY_TYPE_TO_DISCHARGE: Record<string, MilitaryDischarge> = {
  '만기전역': 'honorable',
  '의병전역': 'medical',
  '불명예전역': 'dishonorable',
}

/**
 * 🔴 **옛 데이터 매핑** — 새 컬럼이 비어 있으면 옛 칸에서 읽어 온다.
 * `military_type` 이 '복무 중' 이면 상태는 `serving`, 그 외 값이 있으면 `completed`.
 * 어느 쪽도 없고 옛 칸이 하나라도 차 있으면 「군필」로 본다 (예전 UI 가 그 뜻이었다).
 *
 * 🔴 아무 흔적도 없으면 `''`(미선택)이다 — 「비대상」을 미리 골라 두면 **저장 전인데 답한
 * 것처럼 보인다**(게이지는 계속 미완료라 화면과 어긋난다). 보훈·장애 토글에서 이미 고친 규칙.
 */
function deriveMilitaryStatus(p?: UserProfile): MilitaryStatus | '' {
  if (p?.military_status) return p.military_status
  if (p?.military_type === '복무 중') return 'serving'
  const legacyFilled = !!(p?.military_branch || p?.military_type || p?.military_start || p?.military_end || p?.military_unit)
  return legacyFilled ? 'completed' : ''
}

/** select 가 돌려준 문자열을 상태 9종으로 좁힌다 — 목록에 없으면 미선택 */
function toMilitaryStatus(v: string): MilitaryStatus | '' {
  return MILITARY_STATUS_OPTIONS.find((o) => o.value === v)?.value ?? ''
}

function deriveDischarge(p?: UserProfile): MilitaryDischarge | '' {
  if (p?.military_discharge) return p.military_discharge
  return (p?.military_type && LEGACY_TYPE_TO_DISCHARGE[p.military_type]) || ''
}

const MILITARY_FIELDS: Array<keyof Pick<UserProfile, 'military_branch' | 'military_type' | 'military_start' | 'military_end' | 'military_unit'>> =
  ['military_branch', 'military_type', 'military_start', 'military_end', 'military_unit']

/** 🔴 `export` 는 테스트 전용이다 — 페이지는 위 `MyInfo` 가 직접 조립한다 */
export function MilitarySection({ sectionRef, isActive, intent }: {
  sectionRef: (el: HTMLElement | null) => void; isActive?: boolean; intent?: SectionIntent | null
}) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()
  const [form, setForm] = useState({
    military_status: '' as MilitaryStatus | '',
    military_branch: '',
    military_rank: '',
    military_specialty: '',
    military_start: '',
    military_end: '',
    military_discharge: '' as MilitaryDischarge | '',
    military_exempt_reason: '',
  })
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const durationChipsId = useId()

  if (profile && !loaded) {
    setForm({
      military_status: deriveMilitaryStatus(profile),
      military_branch: profile.military_branch ?? '',
      military_rank: profile.military_rank ?? '',
      // 병과는 옛 `military_unit` 에 있던 값이다 — 새 칸이 비어 있으면 그걸 끌어온다
      military_specialty: profile.military_specialty ?? profile.military_unit ?? '',
      military_start: profile.military_start ?? '',
      military_end: profile.military_end ?? '',
      military_discharge: deriveDischarge(profile),
      military_exempt_reason: profile.military_exempt_reason ?? '',
    })
    /*
      🔴 남성인데 병역이 **통째로 비었으면** 처음부터 편집이다 — 보기 모드의 「비대상」 한 줄은
      저장된 답처럼 보이는데 실제로는 아무것도 안 정해진 상태다 (게이지도 계속 미완료다).
      옛 칸에 값이 있으면 이미 쓰던 사람이라 보기 모드가 맞다.
    */
    const legacyFilled = MILITARY_FIELDS.some((k) => (profile[k] ?? '').toString().trim().length > 0)
    if (profile.gender === 'MALE' && !profile.military_status && !legacyFilled) setEditing(true)
    setLoaded(true)
  }

  /** 게이지의 「병역」 칩 — 성별이 저장돼 있으면 바로 편집으로 연다 */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (intent?.opts.edit) setEditing(true)
  }, [intent])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isMale = profile?.gender === 'MALE'
  const hasAny = !!profile && (
    !!profile.military_status ||
    MILITARY_FIELDS.some((k) => (profile[k] ?? '').toString().trim().length > 0)
  )
  const status = form.military_status
  const showDetail = status !== '' && MILITARY_DETAIL_STATUSES.includes(status)
  const showReason = status !== '' && MILITARY_REASON_STATUSES.includes(status)
  const isServing = status === 'serving' || status === 'alt_service_serving'

  const save = (dto: UpdateProfileDto) => update(dto, { onSuccess: show })

  const handleStatusChange = (v: MilitaryStatus | '') => {
    setForm(f => ({ ...f, military_status: v, military_end: v === 'serving' || v === 'alt_service_serving' ? '' : f.military_end }))
    // 「선택」으로 되돌리면 그 칸을 비운다 (이 API 의 관례 — 빈 문자열이 아니라 null)
    const dto: UpdateProfileDto = { military_status: v || null }
    // 복무 중이면 전역일은 아직 없는 값이다 — 남겨두면 지원서에 거짓이 채워진다
    if ((v === 'serving' || v === 'alt_service_serving') && form.military_end) dto.military_end = null
    save(dto)
  }

  const handleStartChange = (v: string) => {
    if (v && form.military_end && v > form.military_end) {
      toast.error('입대일은 전역일 이전이어야 해요.')
      return
    }
    setForm(f => ({ ...f, military_start: v }))
    save({ military_start: v || null })
  }

  const handleEndChange = (v: string) => {
    if (v && form.military_start && v < form.military_start) {
      toast.error('전역일은 입대일 이후여야 해요.')
      return
    }
    setForm(f => ({ ...f, military_end: v }))
    save({ military_end: v || null })
  }

  /** 병과 — 새 칸과 옛 칸을 **같이** 쓴다 (옛 데이터를 읽는 곳이 아직 남아 있다) */
  const saveSpecialty = () =>
    save({ military_specialty: form.military_specialty || null, military_unit: form.military_specialty || null })

  /** 제대 구분 — 새 코드값과 옛 한글 라벨을 같이 쓴다 (같은 이유) */
  const handleDischargeChange = (v: MilitaryDischarge) => {
    setForm(f => ({ ...f, military_discharge: v }))
    save({ military_discharge: v, military_type: MILITARY_DISCHARGE_KO[v] })
  }

  return (
    <SectionCard id="military" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      {!isMale ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <span className="text-2xl">🪖</span>
          <p className="text-xs text-text-quaternary text-center">기본 인적사항에서 성별을 <span className="text-text-tertiary">남성</span>으로 설정하면 입력할 수 있어요</p>
        </div>
      ) : !hasAny && !editing ? (
        <MyInfoEmptyAdd
          emoji="🪖"
          label="병역사항 입력하기"
          example="예: 육군 · 만기전역 · 2018.03 ~ 2019.12"
          onClick={() => setEditing(true)}
        />
      ) : (
        <div>
          <div className="flex justify-end -mt-1 mb-2">
            <EditToggleButton editing={editing} onClick={() => setEditing((v) => !v)} />
          </div>
          {editing ? (
            <div className="space-y-4">
              <div>
                {/*
                  🔴 세그먼트 9칸은 모바일에서 두 줄로 접혀 「어느 게 골라진 건가」를 매번 다시
                  읽게 만들었다. 고를 게 많고 서로 배타적인 값은 select 가 맞다 — 프로젝트의
                  다른 칸(군별·제대 사유)과 같은 `SelectField` 를 그대로 쓴다.
                */}
                <SelectField
                  label="병역 상태"
                  value={status}
                  options={MILITARY_STATUS_OPTIONS.map((o) => o.value)}
                  optionLabels={MILITARY_STATUS_KO}
                  onChange={(v) => handleStatusChange(toMilitaryStatus(v))}
                />
                {status === 'not_applicable' && (
                  <HelpPill label="대부분">비대상이면 여기서 끝이에요 — 지원서 병역 칸이 자동으로 채워져요</HelpPill>
                )}
              </div>

              {/* 조건부 펼침 — 회색 미리보기 없이 그냥 숨긴다 (있지도 않은 칸을 보여주지 않는다) */}
              {showDetail && (
                /*
                  🔴 분기점은 `lg` 하나다 (DESIGN.md §9 — 사이드바가 나타나는 지점).
                  칸 안의 `span`(병과)·`col-span-2`(칩·제대 구분)도 **같은 `lg`** 여야 한다:
                  하나라도 어긋나면 그 구간에서 암시 칼럼이 생겨 첫 칸이 0px 이 된다.
                */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                  <SelectField label="군별" value={form.military_branch} onChange={(v) => { setForm(f => ({ ...f, military_branch: v })); save({ military_branch: v || null }) }} options={MILITARY_BRANCHES} />
                  <Field label="계급" value={form.military_rank} onChange={(v) => setForm(f => ({ ...f, military_rank: v }))} onBlur={() => save({ military_rank: form.military_rank || null })} placeholder="병장, 하사 등" maxLength={20} />
                  <Field label="병과" value={form.military_specialty} onChange={(v) => setForm(f => ({ ...f, military_specialty: v }))} onBlur={saveSpecialty} placeholder="보병, 통신 등" maxLength={40} span />

                  <Field label="입대일" type="date" value={form.military_start} onChange={handleStartChange} />
                  {/* 종료일 칸에서 「칩으로 채울 수 있다」를 알려면 칩 묶음이 그 칸의 설명이어야 한다 */}
                  <Field
                    label={isServing ? '전역일 (복무 중)' : '전역일'}
                    type="date"
                    value={isServing ? '' : form.military_end}
                    onChange={handleEndChange}
                    disabled={isServing}
                    describedBy={isServing ? undefined : durationChipsId}
                  />
                  {!isServing && (
                    <div className="lg:col-span-2">
                      <DurationChips
                        id={durationChipsId}
                        start={form.military_start}
                        presets={MILITARY_PRESETS}
                        // 입대일이 복무 기간에 들어간다 — 2020-01-01 + 18개월 → 전역 2021-06-30
                        inclusiveEnd
                        label="복무 기간 자동 계산"
                        onPick={(end) => handleEndChange(end)}
                      />
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <FieldLabel label="제대 구분" />
                    <SegmentedToggle
                      label="제대 구분"
                      value={form.military_discharge || 'honorable'}
                      options={MILITARY_DISCHARGE_OPTIONS}
                      onChange={handleDischargeChange}
                    />
                  </div>
                </div>
              )}

              {showReason && (
                <Field
                  label={status === 'exempted' ? '면제 사유' : '미필 사유'}
                  value={form.military_exempt_reason}
                  onChange={(v) => setForm(f => ({ ...f, military_exempt_reason: v }))}
                  onBlur={() => save({ military_exempt_reason: form.military_exempt_reason || null })}
                  placeholder="예: 생계곤란, 질병"
                  maxLength={100}
                />
              )}
            </div>
          ) : (
            <div>
              <MyInfoViewRow label="병역 상태" value={status ? MILITARY_STATUS_KO[status] : ''} />
              {showDetail && (
                <>
                  <MyInfoViewRow label="군별" value={profile?.military_branch} />
                  <MyInfoViewRow label="계급" value={profile?.military_rank} />
                  <MyInfoViewRow label="병과" value={profile?.military_specialty ?? profile?.military_unit} />
                  <MyInfoViewRow label="입대일" value={profile?.military_start} />
                  <MyInfoViewRow label="전역일" value={isServing ? '복무 중' : profile?.military_end} />
                  <MyInfoViewRow label="제대 구분" value={form.military_discharge ? MILITARY_DISCHARGE_KO[form.military_discharge] : ''} />
                </>
              )}
              {showReason && (
                <MyInfoViewRow label={status === 'exempted' ? '면제 사유' : '미필 사유'} value={profile?.military_exempt_reason} />
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ── 어학 자격증 ───────────────────────────────────────────
function LangCertsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [], isLoading } = useLangCerts()
  const { mutateAsync: create } = useCreateLangCert()
  const { mutateAsync: update } = useUpdateLangCert()
  const { mutate: remove } = useDeleteLangCert()
  const [modal, setModal] = useState<null | 'add' | LanguageCert>(null)
  const [deleteTarget, setDeleteTarget] = useState<LanguageCert | null>(null)
  const emptyForm = { cert_type: '', score_grade: '', issuer: '', cert_number: '', acquired_at: '', expires_at: '' }
  const [form, setForm] = useState(emptyForm)
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)
  /** 자동완성 칸은 `Field` 가 아니라 라벨을 직접 이어야 한다 (없으면 「콤보박스」로만 읽힌다) */
  const certTypeInputId = useId()
  const [langCertMeta, setLangCertMeta] = useState<LangCertSuggestion | null>(null)

  const scoreLabel = langCertMeta
    ? langCertMeta.scoreType === 'number'
      ? `점수 (0~${langCertMeta.scoreMax})`
      : '등급'
    : '점수·등급'
  const scorePlaceholder = langCertMeta?.scoreExample ?? '예: 990 / N1 / 5급'

  const openAdd = () => { setForm(emptyForm); setSlot(EMPTY_SLOT); setLangCertMeta(null); setModal('add') }
  const openEdit = (item: LanguageCert) => {
    setForm({ cert_type: item.cert_type, score_grade: item.score_grade ?? '', issuer: item.issuer ?? '', cert_number: item.cert_number ?? '', acquired_at: item.acquired_at ?? '', expires_at: item.expires_at ?? '' })
    setSlot(slotFromExisting(item.file_url, item.file_size_bytes))
    setLangCertMeta(null)
    setModal(item)
  }

  const handleLangCertSelect = (c: LangCertSuggestion) => {
    setLangCertMeta(c)
    setForm((f) => ({
      ...f,
      cert_type: c.name,
      issuer: f.issuer.trim() ? f.issuer : c.issuer,
    }))
    if (c.validYears && form.acquired_at && !form.expires_at) {
      const years = c.validYears
      const acquiredAt = form.acquired_at
      setForm((f) => ({ ...f, expires_at: addYears(acquiredAt, years) }))
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const fileFields = await resolveFileForSubmit(slot, 'myinfo/language-cert')
      const dto = { ...form, ...fileFields }
      if (modal === 'add') await create(dto as Omit<LanguageCert, 'id'>)
      else if (modal && typeof modal === 'object') await update({ id: modal.id, dto: dto as Partial<LanguageCert> })
      setModal(null)
      setLangCertMeta(null)
    } catch (err) {
      notifySaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard id="language-certs" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}
        {!isLoading && items.length === 0 && (
          <MyInfoEmptyAdd
            emoji="🌐"
            label="첫 어학 자격증 추가하기"
            example="예: TOEIC · 990 · 2024.03"
            onClick={openAdd}
          />
        )}
        {items.map((item) => {
          const fields = [
            { label: '종류', value: item.cert_type ?? '' },
            { label: '점수·등급', value: item.score_grade ?? '', mono: true },
            { label: '발급기관', value: item.issuer ?? '' },
            { label: '자격증번호', value: item.cert_number ?? '', mono: true },
            { label: '취득일', value: item.acquired_at ?? '', mono: true },
            { label: '만료일', value: item.expires_at ?? '', mono: true },
          ]
          return (
            <MyInfoItemRow
              key={item.id}
              emoji="🌐"
              accent="success"
              title={[item.cert_type, item.score_grade].filter(Boolean).join(' · ')}
              meta={[item.issuer, item.acquired_at, item.file_url && '📎 파일'].filter(Boolean).join(' · ') || undefined}
              onClick={() => openEdit(item)}
              onEdit={() => openEdit(item)}
              detailFields={fields}
            />
          )
        })}
        {!isLoading && items.length > 0 && (
          <MyInfoEmptyAdd label="어학 자격증 추가" compact onClick={openAdd} />
        )}
      </div>
      {modal && (
        <InfoModal
          title={modal === 'add' ? '어학 자격증 추가' : '어학 자격증 편집'}
          emoji="🌐"
          accent="success"
          subtitle={modal !== 'add' && typeof modal === 'object' ? [modal.cert_type, modal.score_grade].filter(Boolean).join(' · ') : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
          saveLabel={modal === 'add' ? '추가' : '수정'}
        >
          <ModalSection title="시험 정보" first>
            <div className="space-y-3">
              <div>
                <FieldLabel label="종류" required htmlFor={certTypeInputId} />
                <LangCertAutocomplete
                  id={certTypeInputId}
                  value={form.cert_type}
                  onChange={(v) => setForm(f => ({ ...f, cert_type: v }))}
                  onSelect={handleLangCertSelect}
                  placeholder="예: TOEIC · JLPT · HSK"
                  inputClassName={FIELD_INPUT_CLASS}
                />
              </div>
              {langCertMeta && (
                <CertInfoCard
                  issuer={langCertMeta.issuer}
                  category={langCertMeta.category}
                  validYears={langCertMeta.validYears}
                />
              )}
              {langCertMeta?.scoreType === 'grade' && langCertMeta.grades ? (
                <SelectField
                  label={scoreLabel}
                  value={form.score_grade}
                  onChange={(v) => setForm(f => ({ ...f, score_grade: v }))}
                  options={langCertMeta.grades}
                />
              ) : (
                <Field label={scoreLabel} value={form.score_grade} onChange={(v) => setForm(f => ({ ...f, score_grade: v }))} placeholder={scorePlaceholder} />
              )}
              <Field label="발급기관" value={form.issuer} onChange={(v) => setForm(f => ({ ...f, issuer: v }))} placeholder={langCertMeta?.issuer ?? 'ETS'} />
              <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} spellCheck={false} />
            </div>
          </ModalSection>
          <ModalSection title="취득 · 만료">
            <div className="grid grid-cols-2 gap-2">
              <Field label="취득일" type="date" value={form.acquired_at} onChange={(v) => setForm(f => ({ ...f, acquired_at: v }))} />
              {langCertMeta && langCertMeta.validYears === null ? (
                <div className="flex items-end pb-3">
                  <p className="text-xs text-text-quaternary italic">평생 유효</p>
                </div>
              ) : (
                <Field label="만료일" type="date" value={form.expires_at} onChange={(v) => setForm(f => ({ ...f, expires_at: v }))} />
              )}
            </div>
          </ModalSection>
          <ModalSection title="증빙 파일">
            <FileUpload slot={slot} scope="myinfo/language-cert" onChange={setSlot} hint="예: 점수증명서, 성적표" disabled={saving} />
          </ModalSection>
        </InfoModal>
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.cert_type}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); setModal(null) }}
        />
      )}
    </SectionCard>
  )
}

// ── 자격증 ────────────────────────────────────────────────
/** 🔴 `export` 는 테스트 전용이다 — 페이지는 위 `MyInfo` 가 직접 조립한다 */
export function CertsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [], isLoading } = useCerts()
  const { mutateAsync: create } = useCreateCert()
  const { mutateAsync: update } = useUpdateCert()
  const { mutate: remove } = useDeleteCert()
  const [modal, setModal] = useState<null | 'add' | Cert>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cert | null>(null)
  const emptyForm = { name: '', grade: '', issuer: '', cert_number: '', acquired_at: '', expires_at: '' }
  const [form, setForm] = useState(emptyForm)
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)
  /** 자동완성 칸은 `Field` 가 아니라 라벨을 직접 이어야 한다 (없으면 「콤보박스」로만 읽힌다) */
  const nameInputId = useId()
  /** 자격증 정적 카탈로그 메타 (자동완성 선택 후 hasNumber/validYears 등 조건부 표시 위해) */
  const [certMeta, setCertMeta] = useState<CertSuggestion | null>(null)
  /** 자격증번호 placeholder (선택된 자격증의 numberExample) */
  const numberPlaceholder = certMeta?.numberExample ?? '자격번호'
  /** hasNumber=false 시 자격번호 필드 hide */
  const showNumberField = certMeta ? certMeta.hasNumber : true

  const openAdd = () => { setForm(emptyForm); setSlot(EMPTY_SLOT); setCertMeta(null); setModal('add') }
  const openEdit = (item: Cert) => {
    setForm({ name: item.name, grade: item.grade ?? '', issuer: item.issuer ?? '', cert_number: item.cert_number ?? '', acquired_at: item.acquired_at ?? '', expires_at: item.expires_at ?? '' })
    setSlot(slotFromExisting(item.file_url, item.file_size_bytes))
    setCertMeta(null) // 초기엔 미매칭, 자동완성 재선택 시 재설정
    setModal(item)
  }

  const handleCertSelect = (c: CertSuggestion) => {
    setCertMeta(c)
    setForm((f) => ({
      ...f,
      name: c.name,
      // 사용자가 이미 issuer 입력했으면 유지, 아니면 자동 채움
      issuer: f.issuer.trim() ? f.issuer : c.issuer,
      // hasNumber=false 면 cert_number 강제 clear (저장 dto 정합성)
      cert_number: c.hasNumber ? f.cert_number : '',
    }))
    // validYears 있으면 취득일 있을 때 expires_at 자동 계산 프리셋 (덮어쓰기 아님, 빈 경우만)
    if (c.validYears && form.acquired_at && !form.expires_at) {
      const years = c.validYears
      const acquiredAt = form.acquired_at
      setForm((f) => ({ ...f, expires_at: addYears(acquiredAt, years) }))
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const fileFields = await resolveFileForSubmit(slot, 'myinfo/cert')
      // hasNumber=false 이면 cert_number 확실히 undefined
      const cleanNumber = showNumberField ? form.cert_number : ''
      const dto = { ...form, cert_number: cleanNumber, ...fileFields }
      if (modal === 'add') await create(dto as Omit<Cert, 'id'>)
      else if (modal && typeof modal === 'object') await update({ id: modal.id, dto: dto as Partial<Cert> })
      setModal(null)
      setCertMeta(null)
    } catch (err) {
      notifySaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard id="certs" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}
        {!isLoading && items.length === 0 && (
          <MyInfoEmptyAdd
            emoji="📜"
            label="첫 자격증 추가하기"
            example="예: 컴퓨터활용능력 1급 · 대한상공회의소 · 2024.05"
            onClick={openAdd}
          />
        )}
        {items.map((item) => {
          const fields = [
            { label: '자격증명', value: item.name ?? '' },
            { label: '등급', value: item.grade ?? '' },
            { label: '발급기관', value: item.issuer ?? '' },
            { label: '자격번호', value: item.cert_number ?? '', mono: true },
            { label: '취득일', value: item.acquired_at ?? '', mono: true },
            { label: '만료일', value: item.expires_at ?? '', mono: true },
          ]
          return (
            <MyInfoItemRow
              key={item.id}
              emoji="📜"
              accent="brand"
              title={[item.name, item.grade].filter(Boolean).join(' · ')}
              meta={[item.issuer, item.acquired_at, item.file_url && '📎 파일'].filter(Boolean).join(' · ') || undefined}
              onClick={() => openEdit(item)}
              onEdit={() => openEdit(item)}
              detailFields={fields}
            />
          )
        })}
        {!isLoading && items.length > 0 && (
          <MyInfoEmptyAdd label="자격증 추가" compact onClick={openAdd} />
        )}
      </div>
      {modal && (
        <InfoModal
          title={modal === 'add' ? '자격증 추가' : '자격증 편집'}
          emoji="📜"
          accent="brand"
          subtitle={modal !== 'add' && typeof modal === 'object' ? modal.name : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
          saveLabel={modal === 'add' ? '추가' : '수정'}
        >
          <ModalSection title="자격증 정보" first>
            <div className="space-y-3">
              <div>
                <FieldLabel label="자격증명" required htmlFor={nameInputId} />
                <CertAutocomplete
                  id={nameInputId}
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  onSelect={handleCertSelect}
                  placeholder="예: 컴퓨터활용능력 1급"
                  inputClassName={FIELD_INPUT_CLASS}
                />
              </div>
              {certMeta && (
                <CertInfoCard
                  issuer={certMeta.issuer}
                  category={certMeta.category}
                  validYears={certMeta.validYears}
                />
              )}
              {/* 「기사」·「1급」처럼 자격증명과 별개로 등급을 묻는 폼이 있다 (≤40) */}
              <Field label="등급" value={form.grade} onChange={(v) => setForm(f => ({ ...f, grade: v }))} placeholder="예: 기사 · 1급" maxLength={40} />
              <Field label="발급기관" value={form.issuer} onChange={(v) => setForm(f => ({ ...f, issuer: v }))} placeholder={certMeta?.issuer ?? '한국산업인력공단'} />
              {showNumberField && (
                <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} placeholder={numberPlaceholder} spellCheck={false} />
              )}
            </div>
          </ModalSection>
          <ModalSection title="취득 · 만료">
            <div className="grid grid-cols-2 gap-2">
              <Field label="취득일" type="date" value={form.acquired_at} onChange={(v) => setForm(f => ({ ...f, acquired_at: v }))} />
              {certMeta && certMeta.validYears === null ? (
                <div className="flex items-end pb-3">
                  <p className="text-xs text-text-quaternary italic">평생 유효</p>
                </div>
              ) : (
                <Field label="만료일" type="date" value={form.expires_at} onChange={(v) => setForm(f => ({ ...f, expires_at: v }))} />
              )}
            </div>
          </ModalSection>
          <ModalSection title="증빙 파일">
            <FileUpload slot={slot} scope="myinfo/cert" onChange={setSlot} hint="예: 자격증, 합격증" disabled={saving} />
          </ModalSection>
        </InfoModal>
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); setModal(null) }}
        />
      )}
    </SectionCard>
  )
}

// ── 시험 일정 ─────────────────────────────────────────────
const EXAM_DDAY_VARIANT_CLASS: Record<string, string> = {
  danger:  'text-danger',
  warning: 'text-warning',
  info:    'text-violet',     // 일반 imminent → 시험 컨텍스트에선 violet로 표시
  muted:   'text-text-quaternary',
}

function ExamSchedulesSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [] } = useExamSchedules()
  const { mutate: remove } = useDeleteExamSchedule()
  const [modal, setModal] = useState<null | 'add' | ExamSchedule>(null)
  const [convertTarget, setConvertTarget] = useState<ExamSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExamSchedule | null>(null)

  return (
    <SectionCard id="exam-schedules" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {items.length === 0 && (
          <MyInfoEmptyAdd
            emoji="📚"
            label="첫 시험 일정 추가하기"
            example="예: 컴퓨터활용능력 1급 필기 · 2024.08.15 14:00"
            onClick={() => setModal('add')}
          />
        )}
        {items.map((item) => {
          const examDate = dayjs(item.exam_date)
          const dday = calcDday(item.exam_date)
          const isPassed = dday < 0
          const variant = getDdayVariant(dday)
          return (
            <MyInfoItemRow
              key={item.id}
              emoji="📚"
              accent="violet"
              title={item.name}
              meta={[
                examDate.format('M월 D일 (ddd) HH:mm'),
                item.location,
              ].filter(Boolean).join(' · ')}
              onClick={() => setModal(item)}
              rightSlot={
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPassed ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConvertTarget(item) }}
                      className="text-[10px] font-medium text-violet hover:text-text-primary px-2 py-1 rounded-md bg-violet/10 hover:bg-violet/20 border border-violet/30 transition-colors"
                    >
                      결과 입력
                    </button>
                  ) : (
                    <span className={`text-[11px] font-mono font-semibold ${EXAM_DDAY_VARIANT_CLASS[variant]}`}>
                      {getDdayLabel(dday)}
                    </span>
                  )}
                  <span className="text-text-quaternary text-lg leading-none" aria-hidden="true">›</span>
                </div>
              }
            />
          )
        })}
        {items.length > 0 && (
          <MyInfoEmptyAdd label="시험 일정 추가" compact onClick={() => setModal('add')} />
        )}
      </div>
      {modal && (
        <AddExamScheduleModal
          open={true}
          onClose={() => setModal(null)}
          initial={modal === 'add' ? null : modal}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
        />
      )}
      {convertTarget && (
        <ConvertExamToCertModal exam={convertTarget} onClose={() => setConvertTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); setModal(null) }}
        />
      )}
    </SectionCard>
  )
}

// ── 학력 ──────────────────────────────────────────────────
type EducationAccent = 'brand' | 'accent' | 'warning' | 'success' | 'info' | 'violet'
function degreeToStyle(degree?: string): { emoji: string; accent: EducationAccent } {
  switch (degree) {
    case '고등학교': return { emoji: '🏫', accent: 'warning' }
    case '전문대':   return { emoji: '🎓', accent: 'success' }
    case '대학교 (학사)': return { emoji: '🎓', accent: 'success' }
    case '대학원 (석사)': return { emoji: '📘', accent: 'info' }
    case '대학원 (박사)': return { emoji: '📚', accent: 'violet' }
    default: return { emoji: '🎓', accent: 'brand' }
  }
}


/**
 * 최종 학력 세그먼트 — 「고졸·전문학사·학사·석사·박사」.
 *
 * 왜 이게 학력 섹션의 첫 칸인가: 학력은 사람마다 **필요한 칸 수가 다르다**. 고졸에게
 * 대학원 칸을 보여주는 건 「나는 여기 해당 없음」을 매번 다시 판단하게 만드는 일이고,
 * 박사에게 학교 하나짜리 목록은 어디에 무엇을 넣어야 할지 알려 주지 않는다.
 */
const HIGHEST_DEGREE_OPTIONS: { value: HighestDegree; label: string }[] = [
  { value: 'high',      label: '고졸' },
  { value: 'associate', label: '전문학사' },
  { value: 'bachelor',  label: '학사' },
  { value: 'master',    label: '석사' },
  { value: 'doctor',    label: '박사' },
]

/** 한 카드가 맡는 학교 단계 — 카드 제목 · 그 카드가 인정하는 `degree` 값 · [추가] 프리셋 */
interface EducationStage {
  key: string
  label: string
  degrees: string[]
  modalDegree: string
}

const STAGE_HIGH: EducationStage = {
  key: 'high', label: '고등학교', degrees: ['고등학교'], modalDegree: '고등학교',
}
const stageUniv = (associate: boolean): EducationStage => ({
  // 전문대·대학교는 **한 카드**다 — 어느 쪽인지는 모달의 「학교 단계」가 이미 묻는다
  key: 'univ', label: '대학교', degrees: ['전문대', '대학교 (학사)'],
  modalDegree: associate ? '전문대' : '대학교 (학사)',
})
const STAGE_MASTER: EducationStage = {
  key: 'master', label: '대학원 석사', degrees: ['대학원 (석사)'], modalDegree: '대학원 (석사)',
}
const STAGE_DOCTOR: EducationStage = {
  key: 'doctor', label: '대학원 박사', degrees: ['대학원 (박사)'], modalDegree: '대학원 (박사)',
}

/** 고른 최종 학력까지 **거쳐 온 단계 전부** — 학사면 고등학교도 지원서가 묻는다 */
function stagesFor(highest: HighestDegree): EducationStage[] {
  switch (highest) {
    case 'high':      return [STAGE_HIGH]
    case 'associate': return [STAGE_HIGH, stageUniv(true)]
    case 'bachelor':  return [STAGE_HIGH, stageUniv(false)]
    case 'master':    return [STAGE_HIGH, stageUniv(false), STAGE_MASTER]
    case 'doctor':    return [STAGE_HIGH, stageUniv(false), STAGE_MASTER, STAGE_DOCTOR]
  }
}

/** 🔴 `export` 는 테스트 전용이다 — 페이지는 위 `MyInfo` 가 직접 조립한다 */
export function EducationsSection({ sectionRef, isActive, intent }: {
  sectionRef: (el: HTMLElement | null) => void; isActive?: boolean; intent?: SectionIntent | null
}) {
  const { data: items = [], isLoading } = useEducations()
  const { data: profile } = useProfile()
  const { mutate: updateProfile } = useUpdateProfile()
  const { saved, show } = useSaved()
  const { mutateAsync: create } = useCreateEducation()
  const { mutateAsync: update } = useUpdateEducation()
  const { mutate: remove } = useDeleteEducation()
  const [modal, setModal] = useState<null | 'add' | Education>(null)
  /** 추가 모드에서 미리 고를 단계 — 「+ 대학교 추가」가 왔다는 뜻 */
  const [addDegree, setAddDegree] = useState<string | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Education | null>(null)
  /** 최종 학력 — 누르면 바로 바뀌어야 한다 (재조회를 기다리면 단계 카드가 한 박자 늦게 움직인다) */
  const [highest, setHighest] = useState<HighestDegree | null>(null)
  const [loaded, setLoaded] = useState(false)

  if (profile && !loaded) {
    setHighest(profile.highest_degree ?? null)
    setLoaded(true)
  }

  const stages = highest ? stagesFor(highest) : []

  const openAdd = (degree?: string) => { setAddDegree(degree); setModal('add') }
  const openEdit = (item: Education) => { setAddDegree(undefined); setModal(item) }

  const handleHighestChange = (v: HighestDegree) => {
    if (v === highest) return
    setHighest(v)
    updateProfile({ highest_degree: v }, { onSuccess: show, onError: (err) => notifySaveError(err) })
  }

  /**
   * 게이지의 「최종 학력」 칩 — 고른 단계가 있으면 그 단계로 추가 모달을 연다.
   * 🔴 `highest` 를 deps 에 넣지 않는다 — 모달을 닫고 토글을 바꾸는 순간 모달이 다시 열린다.
   */
  const highestLabelId = useId()
  const highestHelpId = useId()
  const highestRef = useRef(highest)
  useEffect(() => { highestRef.current = highest })
  useEffect(() => {
    if (!intent?.opts.edit) return
    const h = highestRef.current
    setAddDegree(h ? HIGHEST_DEGREE_TO_EDU[h] : undefined)
    setModal('add')
  }, [intent])

  const handleSave = async (dto: Omit<Education, 'id'>) => {
    if (modal === 'add') {
      await create(dto)
    } else if (modal && typeof modal === 'object') {
      await update({ id: modal.id, dto: dto as Partial<Education> })
    }
  }

  const periodOf = (e: Education) => {
    const fmt = (d?: string) => (d ? d.slice(0, 7).replace('-', '.') : '')
    const s = fmt(e.start_at)
    const x = fmt(e.end_at)
    if (!s && !x) return ''
    return `${s} ~ ${x}`
  }

  /** 단계 카드가 인정하는 항목 / 어느 단계에도 안 들어가는 나머지(「추가 학력」) */
  const itemsOf = (s: EducationStage) => items.filter((e) => s.degrees.includes(e.degree ?? ''))
  const stagedIds = new Set(stages.flatMap((s) => itemsOf(s).map((e) => e.id)))
  const extras = items.filter((e) => !stagedIds.has(e.id))

  const renderItem = (item: Education) => {
    const gpa = item.gpa ? (item.gpa_max ? `${item.gpa}/${item.gpa_max}` : item.gpa) : ''
    const meta = [item.status, periodOf(item), gpa, item.file_url && '📎 파일']
      .filter(Boolean)
      .join(' · ')
    const style = degreeToStyle(item.degree)
    const fields = [
      { label: '학교명', value: item.school_name ?? '' },
      { label: '학교 단계', value: item.degree ?? '' },
      { label: '전공', value: item.major ?? '' },
      { label: '상태', value: item.status ?? '' },
      { label: '입학', value: item.start_at ?? '', mono: true },
      { label: '졸업 (예정)', value: item.end_at ?? '', mono: true },
      { label: '학점', value: gpa, mono: true },
      { label: '위치', value: item.location ?? '' },
    ]
    return (
      <MyInfoItemRow
        key={item.id}
        emoji={style.emoji}
        accent={style.accent}
        title={[item.school_name || '(학교명 미입력)', item.major].filter(Boolean).join(' · ')}
        meta={meta || undefined}
        onClick={() => openEdit(item)}
        onEdit={() => openEdit(item)}
        badge={item.degree || undefined}
        detailFields={fields}
      />
    )
  }

  return (
    <SectionCard id="education" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      <div className="space-y-5">
        {/* 최종 학력 먼저 — 사람마다 필요한 학교 칸 수가 다르다 (`HIGHEST_DEGREE_OPTIONS` 주석) */}
        <div>
          <FieldLabel label="최종 학력" id={highestLabelId} />
          <SegmentedToggle
            label="최종 학력"
            labelledBy={highestLabelId}
            describedBy={highest ? undefined : highestHelpId}
            value={highest}
            options={HIGHEST_DEGREE_OPTIONS}
            onChange={handleHighestChange}
          />
          {!highest && (
            <HelpPill label="먼저" id={highestHelpId}>최종 학력을 고르면 필요한 학교만 보여드려요</HelpPill>
          )}
        </div>

        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}

        {/* 골랐으면 거쳐 온 단계마다 한 묶음 — 빈 단계는 「+ {단계} 추가」가 그 단계 프리셋으로 연다 */}
        {!isLoading && highest && (
          <>
            {stages.map((s) => {
              const own = itemsOf(s)
              return (
                <div key={s.key} role="group" aria-label={s.label} className="pt-4 border-t border-line">
                  <p className="text-[13px] font-bold text-text-primary mb-2">{s.label}</p>
                  <div className="space-y-2">
                    {own.length === 0 ? (
                      <MyInfoEmptyAdd label={`${s.label} 추가`} compact onClick={() => openAdd(s.modalDegree)} />
                    ) : own.map(renderItem)}
                  </div>
                </div>
              )
            })}
            <div className="pt-4 border-t border-line">
              {extras.length > 0 && (
                <p className="text-[13px] font-bold text-text-primary mb-2">추가 학력</p>
              )}
              <div className="space-y-2">
                {extras.map(renderItem)}
                <MyInfoEmptyAdd label="학력 추가" compact onClick={() => openAdd()} />
              </div>
            </div>
          </>
        )}

        {/* 아직 안 골랐으면 예전처럼 목록 하나 — 토글 아래 안내가 다음 걸음을 말한다 */}
        {!isLoading && !highest && (
          <div className="space-y-2">
            {items.length === 0 && (
              <MyInfoEmptyAdd
                emoji="🎓"
                label="첫 학력 추가하기"
                example="예: 한양대학교 · 경영학과 · 2020-2024"
                onClick={() => openAdd()}
              />
            )}
            {items.map(renderItem)}
            {items.length > 0 && (
              <MyInfoEmptyAdd label="학력 추가" compact onClick={() => openAdd()} />
            )}
          </div>
        )}
      </div>
      {modal && (
        <EducationModal
          initial={modal === 'add' ? null : modal}
          initialDegree={modal === 'add' ? addDegree : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.school_name || '학력'}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); setModal(null) }}
        />
      )}
    </SectionCard>
  )
}


// ── 수상 내역 ─────────────────────────────────────────────
function AwardsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [], isLoading } = useAwards()
  const { mutateAsync: create } = useCreateAward()
  const { mutateAsync: update } = useUpdateAward()
  const { mutate: remove } = useDeleteAward()
  const [modal, setModal] = useState<null | 'add' | Award>(null)
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null)
  const emptyForm = { contest_name: '', award_name: '', org: '', awarded_at: '', content: '' }
  const [form, setForm] = useState(emptyForm)
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(emptyForm); setSlot(EMPTY_SLOT); setModal('add') }
  const openEdit = (item: Award) => {
    setForm({ contest_name: item.contest_name, award_name: item.award_name ?? '', org: item.org ?? '', awarded_at: item.awarded_at ?? '', content: item.content ?? '' })
    setSlot(slotFromExisting(item.file_url, item.file_size_bytes))
    setModal(item)
  }
  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const fileFields = await resolveFileForSubmit(slot, 'myinfo/award')
      const dto = { ...form, ...fileFields }
      if (modal === 'add') await create(dto as Omit<Award, 'id'>)
      else if (modal && typeof modal === 'object') await update({ id: modal.id, dto: dto as Partial<Award> })
      setModal(null)
    } catch (err) {
      notifySaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard id="awards" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}
        {!isLoading && items.length === 0 && (
          <MyInfoEmptyAdd
            emoji="🏆"
            label="첫 수상 내역 추가하기"
            example="예: 대학생 광고 공모전 · 우수상 · 2024.06"
            onClick={openAdd}
          />
        )}
        {items.map((item) => {
          const fields = [
            { label: '대회명', value: item.contest_name ?? '' },
            { label: '수상명', value: item.award_name ?? '' },
            { label: '수여기관', value: item.org ?? '' },
            { label: '수상일자', value: item.awarded_at ?? '', mono: true },
            { label: '수상내용', value: item.content ?? '' },
          ]
          return (
            <MyInfoItemRow
              key={item.id}
              emoji="🏆"
              accent="warning"
              title={[item.contest_name, item.award_name].filter(Boolean).join(' · ')}
              meta={[item.org, item.awarded_at, item.file_url && '📎 파일'].filter(Boolean).join(' · ') || undefined}
              onClick={() => openEdit(item)}
              onEdit={() => openEdit(item)}
              detailFields={fields}
            />
          )
        })}
        {!isLoading && items.length > 0 && (
          <MyInfoEmptyAdd label="수상 내역 추가" compact onClick={openAdd} />
        )}
      </div>
      {modal && (
        <InfoModal
          title={modal === 'add' ? '수상 내역 추가' : '수상 내역 편집'}
          emoji="🏆"
          accent="warning"
          subtitle={modal !== 'add' && typeof modal === 'object' ? [modal.contest_name, modal.award_name].filter(Boolean).join(' · ') : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
          saveLabel={modal === 'add' ? '추가' : '수정'}
        >
          <ModalSection title="대회 정보" first>
            <div className="space-y-3">
              <Field label="대회명" value={form.contest_name} onChange={(v) => setForm(f => ({ ...f, contest_name: v }))} placeholder="교내 프로그래밍 대회" required />
              <Field label="수상명" value={form.award_name} onChange={(v) => setForm(f => ({ ...f, award_name: v }))} placeholder="대상" />
              <Field label="수여기관" value={form.org} onChange={(v) => setForm(f => ({ ...f, org: v }))} />
              <Field label="수상일자" type="date" value={form.awarded_at} onChange={(v) => setForm(f => ({ ...f, awarded_at: v }))} />
            </div>
          </ModalSection>
          <ModalSection title="상세 내용">
            <Field label="수상 내용" value={form.content} onChange={(v) => setForm(f => ({ ...f, content: v }))} maxLength={200} as="textarea" placeholder="수상 내용을 간략히 적어주세요 (200자)" />
          </ModalSection>
          <ModalSection title="증빙 파일">
            <FileUpload slot={slot} scope="myinfo/award" onChange={setSlot} hint="예: 상장, 수상 증서" disabled={saving} />
          </ModalSection>
        </InfoModal>
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.contest_name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); setModal(null) }}
        />
      )}
    </SectionCard>
  )
}

// ── 경력·경험 = 활동(`Activity`) 경량 폼 ───────────────────
/**
 * 🔴 **저장소는 하나(`Activity`), 입구는 둘** (계획 A′).
 *
 * 예전엔 여기가 활동 일지를 **읽기만** 하고 「자세히 보기」로 떠넘겼다. 그런데 이력서에
 * 옮겨 적을 한 줄을 추가하려고 일지로 건너가 다른 폼을 쓰는 건 불편하다는 지적이 있었다
 * (2026-09-05). 그래서 여기서 바로 추가·편집하되 **저장은 같은 `Activity`** 로 간다 —
 * 로그·회고 같은 깊이는 계속 활동 일지의 몫이다.
 *
 * 🔴 화면은 다시 **둘로** 갈렸다 (CEO 2026-09-06 「경험이랑 경력은 분류해야지」). 지원서는
 * 「경력사항」과 「대외활동」을 다른 칸으로 묻는데 한 목록에 인턴과 동아리가 섞여 있으면
 * 옮겨 적을 때 매번 골라내야 한다. **저장은 그대로 `activities` 하나**, `type` 이 기준이다.
 *
 * 몸통을 하나로 둔 이유: 행·빈 상태·모달·삭제가 같은 흐름이라, 복사하면 한쪽만 고쳐지는
 * 버그가 생긴다. 다른 것은 아래 `MODE` 표에 모아 둔 말과 필터뿐이다.
 *
 * 옛 `myinfo experiences` API 는 더 이상 읽지도 쓰지도 않는다.
 */
const ACTIVITY_SECTION_MODE = {
  career: {
    id: 'career',
    emoji: '💼',
    /** 재직 중 = 끝나지 않은 경력. 「진행 중」은 동아리의 말이라 경력 칸에서는 어색하다 */
    ongoingLabel: '재직 중',
    emptyLabel: '첫 경력 추가하기',
    emptyExample: '예: ○○커머스 · 사원 · 2025.09 ~ 재직 중',
    addLabel: '경력 추가',
    orgLabel: '회사',
    roleLabel: '직위·직급',
    summaryLabel: '담당 업무',
  },
  experience: {
    id: 'experiences',
    emoji: '🌱',
    ongoingLabel: '진행 중',
    emptyLabel: '첫 경험 추가하기',
    emptyExample: '예: 마케팅 학회 · 운영진 · 2025.03 ~ 2025.06',
    addLabel: '경험 추가',
    orgLabel: '기관·회사',
    roleLabel: '역할',
    summaryLabel: '지원서용 요약',
  },
} as const

export function ActivitySection({ mode, sectionRef, isActive }: {
  mode: ExperienceFormMode; sectionRef: (el: HTMLElement | null) => void; isActive?: boolean
}) {
  const m = ACTIVITY_SECTION_MODE[mode]
  const link = useDemoLink()
  const { data: activities = [], isLoading } = useActivities(false)
  const { mutate: removeActivity } = useRemoveActivity()
  const [modal, setModal] = useState<null | 'add' | Activity>(null)
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null)
  const today = todayLocal()

  // 기본함(미분류)은 활동이 아니라 퀵캡처 수신함 — 목록에서 제외
  const items = activities.filter(
    (a) => !a.isInbox && !a.archivedAt && isCareerType(a.type) === (mode === 'career'),
  )
  const ongoingCount = items.filter((a) => !a.endedAt || a.endedAt >= today).length

  const periodOf = (a: Activity) => {
    const fmt = (d?: string | null) => (d ? d.slice(0, 7).replace('-', '.') : '')
    const s = fmt(a.startedAt)
    // 재직 중이면 끝이 없다 — 서버가 `endedAt` 을 비워 두므로 여기서 글자로 채운다
    if (a.isCurrent) return s ? `${s} ~ 재직 중` : '재직 중'
    const e = fmt(a.endedAt)
    if (!s && !e) return ''
    return s && e ? `${s} ~ ${e}` : (e || s)
  }

  return (
    <SectionCard
      id={m.id}
      sectionRef={sectionRef}
      isActive={isActive}
      headerRight={
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand/10 text-brand">
          {m.ongoingLabel} {ongoingCount}개
        </span>
      }
    >
      <div className="space-y-2">
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}

        {!isLoading && items.length === 0 && (
          <MyInfoEmptyAdd
            emoji={m.emoji}
            label={m.emptyLabel}
            example={m.emptyExample}
            onClick={() => setModal('add')}
          />
        )}

        {items.map((a) => {
          const type = a.type ?? 'other'
          const fields = [
            { label: '활동명', value: a.name },
            { label: '유형', value: TYPE_KO[type] },
            { label: m.orgLabel, value: a.org ?? '' },
            ...(a.orgDepartment ? [{ label: '부서', value: a.orgDepartment }] : []),
            { label: m.roleLabel, value: a.role ?? '' },
            { label: '기간', value: periodOf(a), mono: true },
            ...(a.country ? [{ label: '국가', value: a.country }] : []),
            // 성과는 이제 활동 일지에서만 쓴다 — 값이 남아 있는 항목에만 보여준다 (빈 줄을 만들지 않는다)
            ...(a.outcome ? [{ label: '성과', value: a.outcome }] : []),
            { label: m.summaryLabel, value: a.applicationSummary ?? '' },
          ]
          return (
            <MyInfoItemRow
              key={a.id}
              emoji={m.emoji}
              accent="success"
              title={a.name}
              badge={TYPE_KO[type]}
              // 부서는 회사 바로 뒤 — 지원서 경력 칸이 「회사 · 부서 · 직위」 순으로 묻는다
              meta={[a.org, a.orgDepartment, a.role, periodOf(a)].filter(Boolean).join(' · ') || undefined}
              onClick={() => setModal(a)}
              onEdit={() => setModal(a)}
              detailFields={fields}
            />
          )
        })}

        {!isLoading && items.length > 0 && (
          <MyInfoEmptyAdd label={m.addLabel} compact onClick={() => setModal('add')} />
        )}

        {/* 깊이는 계속 활동 일지의 몫 — 링크는 유지한다. 같은 링크를 두 섹션에 두면 잔소리라 경험 쪽에만 둔다 */}
        {mode === 'experience' && (
          <Link
            to={link('/activity')}
            className="flex items-center justify-center gap-1 w-full bg-brand/10 hover:bg-brand/20 active:bg-brand/30 text-brand text-xs font-semibold py-2.5 rounded-lg transition-colors border border-brand/20"
          >
            활동 일지에서 기록 쌓기 →
          </Link>
        )}
      </div>

      {modal && (
        <ExperienceFormModal
          mode={mode}
          editing={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onDelete={modal !== 'add' && typeof modal === 'object' ? () => setDeleteTarget(modal) : undefined}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            removeActivity(deleteTarget.id, {
              onError: () => toast.error('기록이 달린 활동은 활동 일지에서 정리해 주세요.'),
            })
            setDeleteTarget(null)
            setModal(null)
          }}
        />
      )}
    </SectionCard>
  )
}

// ── 우대·기타 (보훈 · 장애) ───────────────────────────────
function ExtrasSection({ sectionRef, isActive, intent }: {
  sectionRef: (el: HTMLElement | null) => void; isActive?: boolean; intent?: SectionIntent | null
}) {
  const { saved, show } = useSaved()
  return (
    <SectionCard id="extras" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      {/* 「보훈 여부」 칩은 섹션 위가 아니라 **그 토글**로 데려간다 */}
      <ExtrasSectionBody onSaved={show} focus={intent?.opts.focus} focusSeq={intent?.seq} />
    </SectionCard>
  )
}

// ── 논문 (석·박사 전용) ───────────────────────────────────
/**
 * 🔴 표시 조건은 **호출부**(`MyInfo`)가 판정한다 — 칩 목록과 본문이 같은 조건을 봐야 하고,
 * 그 조건(`showThesis`)은 사이드바를 그릴 때 이미 계산돼 있다.
 */
function ThesisSection({ sectionRef, isActive, fields }: {
  sectionRef: (el: HTMLElement | null) => void; isActive?: boolean; fields: FieldDictionaryEntry[]
}) {
  const { saved, show } = useSaved()
  return (
    <SectionCard id="thesis" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      <ThesisSectionBody fields={fields} onSaved={show} />
    </SectionCard>
  )
}

// ── 스펙 목표 (자유 입력) ─────────────────────────────────
function GoalsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()

  const [goals, setGoals] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newGoal, setNewGoal] = useState('')

  if (profile && !loaded) {
    const stored = profile.goal_other?.trim()
    setGoals(stored ? stored.split('\n').filter(Boolean) : [])
    setLoaded(true)
  }

  const persist = (list: string[], prev: string[]) => {
    update({ goal_other: list.join('\n') } as Partial<UserProfile>, {
      onSuccess: show,
      onError: () => {
        setGoals(prev)
        toast.error('저장에 실패했어요. 다시 시도해주세요')
      },
    })
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    const prev = goals
    const updated = [...goals, newGoal.trim()]
    setGoals(updated)
    persist(updated, prev)
    setNewGoal('')
    setAdding(false)
  }

  const removeGoal = (idx: number) => {
    const prev = goals
    const updated = goals.filter((_, i) => i !== idx)
    setGoals(updated)
    persist(updated, prev)
  }

  return (
    <SectionCard id="goals" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      <div className="space-y-2">
        {goals.length === 0 && !adding && (
          <p className="text-xs text-text-quaternary text-center py-3">목표를 추가해보세요. 대시보드에서도 볼 수 있어요 🎯</p>
        )}
        {goals.map((goal, i) => (
          <div key={i} className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-line bg-card">
            <span className="w-1.5 h-1.5 rounded-full bg-danger/60 flex-none mt-px" />
            <span className="flex-1 text-xs text-text-primary">{goal}</span>
            <button onClick={() => removeGoal(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-quaternary hover:text-danger w-7 h-7 flex items-center justify-center rounded">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
        {adding ? (
          <div className="flex gap-2">
            <input
              // eslint-disable-next-line chwippo/no-bare-autofocus -- 「목표 추가」를 눌러야(adding) 나타나는 칸 — 탭 뒤 등장
              autoFocus
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addGoal(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="목표 입력 후 Enter (예: TOEIC 900점 달성)"
              className="flex-1 bg-card border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-tertiary"
            />
            <button onClick={addGoal} disabled={!newGoal.trim()} className="shrink-0 whitespace-nowrap bg-brand hover:bg-accent active:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-bg text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">추가</button>
            <button onClick={() => setAdding(false)} className="shrink-0 whitespace-nowrap text-xs text-text-quaternary px-2 hover:text-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">취소</button>
          </div>
        ) : (
          <AddButton onClick={() => setAdding(true)} label="목표 추가" />
        )}
      </div>
    </SectionCard>
  )
}

// ── 자기소개서 소재 ────────────────────────────────────────
const COVER_FIELDS: { key: keyof import('@/api/myinfo').Coverletter; label: string; placeholder: string }[] = [
  { key: 'personality', label: '성격 장단점', placeholder: '성격의 장점과 단점, 단점을 극복하려는 노력을 사례와 함께...' },
  { key: 'background', label: '성장 배경', placeholder: '나를 형성한 경험이나 환경, 가치관에 영향을 준 사건...' },
  { key: 'job_competency', label: '직무 역량·핵심 경험', placeholder: '지원 직무와 연결되는 핵심 역량과 그것을 보여주는 경험...' },
  { key: 'own_strength', label: '나만의 강점', placeholder: '다른 지원자와 차별화되는 나만의 강점...' },
  { key: 'collaboration', label: '갈등 해결·협업 경험', placeholder: '팀에서 의견 충돌이나 갈등을 조율한 경험, 협업 과정에서의 역할...' },
  { key: 'challenge', label: '도전·실패 경험', placeholder: '실패하거나 어려움을 겪었던 경험과 거기서 배운 점...' },
]

function CoverletterSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data } = useCoverletter()
  const { mutate: updateCover } = useUpdateCoverletter()
  const { mutate: createCustom } = useCreateCustomItem()
  const { mutate: updateCustom } = useUpdateCustomItem()
  const { mutate: deleteCustom } = useDeleteCustomItem()
  const { saved, show } = useSaved()

  const [clForm, setClForm] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CoverletterCustom | null>(null)

  if (data && !loaded) {
    const init: Record<string, string> = {}
    COVER_FIELDS.forEach(({ key }) => { init[key] = (data.coverletter as Record<string, string | undefined> | null)?.[key] ?? '' })
    setClForm(init)
    setLoaded(true)
  }

  const saveCover = (key: string, val: string) =>
    updateCover({ [key]: val || null } as Partial<Coverletter>, { onSuccess: show })

  const handleAddCustom = () => {
    if (!newLabel.trim()) return
    createCustom({ label: newLabel.trim(), order_index: data?.custom.length ?? 0 })
    setNewLabel(''); setAddingLabel(false)
  }

  const coverFieldValue = (key: keyof Coverletter): string =>
    (data?.coverletter as Record<string, string | undefined> | undefined)?.[key] ?? ''

  const hasAny =
    COVER_FIELDS.some(({ key }) => coverFieldValue(key).trim().length > 0) ||
    (data?.custom ?? []).some((c) => (c.content ?? '').trim().length > 0) ||
    (data?.custom ?? []).length > 0

  return (
    <SectionCard id="coverletter" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      {!hasAny && !editing ? (
        <MyInfoEmptyAdd
          emoji="✍️"
          label="자소서 소재 작성하기"
          example="성격 장단점 · 성장 배경 · 직무 역량 등 6 영역"
          onClick={() => setEditing(true)}
        />
      ) : (
        <div>
          <div className="flex justify-end -mt-1 mb-2">
            <EditToggleButton editing={editing} onClick={() => setEditing((v) => !v)} />
          </div>
          {editing ? (
            <div className="space-y-5">
              {COVER_FIELDS.map(({ key, label, placeholder }) => (
                <CoverletterTextField
                  key={key}
                  label={label}
                  value={clForm[key] ?? ''}
                  placeholder={placeholder}
                  onChange={(v) => setClForm((f) => ({ ...f, [key]: v }))}
                  onBlur={() => saveCover(key, clForm[key] ?? '')}
                />
              ))}
              {(data?.custom ?? []).map((item) => (
                <CustomCoverItem
                  key={item.id}
                  item={item}
                  onUpdate={(content) => updateCustom({ id: item.id, dto: { content } }, { onSuccess: show })}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
              {addingLabel ? (
                <div className="flex gap-2">
                  <input
                    // eslint-disable-next-line chwippo/no-bare-autofocus -- 「항목 추가」를 눌러야(addingLabel) 나타나는 칸 — 탭 뒤 등장
                    autoFocus
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddCustom(); if (e.key === 'Escape') setAddingLabel(false) }}
                    placeholder="항목명 입력 후 Enter (예: 해외 경험)"
                    className="flex-1 bg-card border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-tertiary"
                  />
                  <button onClick={handleAddCustom} disabled={!newLabel.trim()} className="shrink-0 whitespace-nowrap bg-brand hover:bg-accent active:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-bg text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">추가</button>
                  <button onClick={() => setAddingLabel(false)} className="shrink-0 whitespace-nowrap text-xs text-text-quaternary px-2 hover:text-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg">취소</button>
                </div>
              ) : (
                <MyInfoEmptyAdd label="항목 직접 추가" compact onClick={() => setAddingLabel(true)} />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {COVER_FIELDS.map(({ key, label }) => (
                <CoverletterViewBlock key={key} label={label} value={coverFieldValue(key)} />
              ))}
              {(data?.custom ?? []).map((item) => (
                <CoverletterViewBlock key={item.id} label={item.label} value={item.content ?? ''} />
              ))}
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.label}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { deleteCustom(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}
    </SectionCard>
  )
}

function CoverletterViewBlock({ label, value }: { label: string; value: string }) {
  const trimmed = value.trim()
  const hasValue = trimmed.length > 0
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-bold text-text-primary">{label}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {hasValue && <span className="text-[10px] text-text-quaternary font-mono tabular-nums">{value.length}자</span>}
          {hasValue && <CopyButton value={value} />}
        </div>
      </div>
      {hasValue ? (
        <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">{value}</p>
      ) : (
        <p className="text-[11px] text-text-quaternary">비어있음 — 편집 버튼으로 작성하세요</p>
      )}
    </div>
  )
}

function CustomCoverItem({ item, onUpdate, onDelete }: { item: CoverletterCustom; onUpdate: (c: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(item.content ?? '')
  return (
    <CoverletterTextField
      label={item.label}
      value={value}
      placeholder={`${item.label}을 작성해보세요`}
      onChange={setValue}
      onBlur={() => onUpdate(value)}
      onDelete={onDelete}
    />
  )
}

/**
 * 자소서 소재 textarea — 베타 피드백 패턴.
 * auto-resize (min 200 / max 500) + lineHeight 1.6 + 글자수 카운터 색상 (success >= 200자).
 */
function CoverletterTextField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
  onDelete,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  onBlur: () => void
  onDelete?: () => void
}) {
  const { ref, autoResize } = useAutoResize(value, { min: 80, max: 500 })
  const counterColor =
    value.length >= 2000
      ? 'text-danger'
      : value.length >= 1800
      ? 'text-warning'
      : value.length >= 200
      ? 'text-success'
      : 'text-text-quaternary'
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-text-primary">{label}</label>
        <div className="flex items-center gap-1">
          <CopyButton value={value} />
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center text-text-quaternary hover:text-danger rounded-md hover:bg-danger/8 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          autoResize()
        }}
        onBlur={onBlur}
        maxLength={2000}
        placeholder={placeholder}
        style={{ minHeight: 80, lineHeight: 1.6 }}
        className="w-full bg-input border border-line rounded-xl px-4 py-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 resize-y transition-all"
      />
      <p className={`text-[10px] ${counterColor} text-right mt-1`}>{value.length} / 2000</p>
    </div>
  )
}

// ── 지원 서류 (고정 슬롯 + 항목 첨부 + 기타 파일) ─────────
// 슬롯 4행과 「항목에서 첨부한 서류」 묶음은 `DocumentSlotsBody` 가 그린다.
// 여기 남은 것은 **기타 파일** — 자유 업로드(슬롯 없는 document)다.
// 🔴 성적·졸업증명서는 **학력 항목 첨부가 원본**이다 (CEO 2026-09-05) — 자유 파일로도 고를 수
// 있게 두면 같은 서류가 두 군데 저장된다. 이력서·포트폴리오는 슬롯의 변형본(영문 이력서 등)
// 용도로 남긴다. 옛 문서에 남은 category 값은 이 목록과 무관하게 저장된 문자열 그대로 보인다.
const DOC_CATEGORIES = ['이력서', '포트폴리오', '자기소개서', '기타(직접입력)']

/** 바이트 → "1.2MB" / "340KB" 표시 */
function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function FilesSection({ sectionRef, isActive, onJump }: {
  sectionRef: (el: HTMLElement | null) => void
  isActive?: boolean
  onJump: (sectionId: string) => void
}) {
  // 🔴 고정 슬롯에 들어간 문서는 위 슬롯 행이 이미 보여준다 — 여기 또 나오면 같은 파일이 두 번 뜬다
  const { data: allDocuments = [] } = useDocuments()
  const documents = allDocuments.filter((d) => !d.slot)
  const { mutateAsync: createDoc } = useCreateDocument()
  const { mutate: deleteDoc } = useDeleteDocument()

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MyDocument | null>(null)

  const handleSave = async () => {
    if (!title.trim() || slot.kind === 'empty' || saving) return
    setSaving(true)
    try {
      const { file_url, file_size_bytes } = await resolveFileForSubmit(slot, 'myinfo/document')
      if (!file_url) {
        toast.error('파일이 필요합니다.')
        return
      }
      const finalCategory = category === '기타(직접입력)' ? customCategory.trim() : category
      await createDoc({
        title: title.trim(),
        category: finalCategory || undefined,
        file_url,
        file_size_bytes: file_size_bytes ?? undefined,
      })
      setShowUpload(false)
      setTitle(''); setCategory(''); setCustomCategory(''); setSlot(EMPTY_SLOT)
    } catch (err) {
      notifySaveError(err)
    } finally {
      setSaving(false)
    }
  }

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')

  const FileIcon = ({ url }: { url: string }) => (
    isPdf(url)
      ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-danger flex-none"><rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 5.5h4M5 8h3.5M5 10.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-brand flex-none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 11l4-3 3 2.5 2.5-2L15 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )

  return (
    <SectionCard id="files" sectionRef={sectionRef} isActive={isActive}>
      <DocumentSlotsBody onJump={onJump}>
      <div className="space-y-5">

        {/* 직접 올린 파일들 */}
        <div>
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-line bg-card hover:border-line-strong hover:bg-card active:bg-card-strong transition-all group"
              >
                <a
                  href={doc.file_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 min-w-0 items-center gap-3"
                >
                  <FileIcon url={doc.file_url ?? ''} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate group-hover:text-brand transition-colors">{doc.title}</p>
                  </div>
                  {doc.file_size_bytes != null && doc.file_size_bytes > 0 && (
                    <span className="text-[10px] text-text-quaternary flex-none">{formatBytes(doc.file_size_bytes)}</span>
                  )}
                  {doc.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-none bg-text-tertiary/12 text-text-tertiary">{doc.category}</span>
                  )}
                </a>
                <button
                  type="button"
                  aria-label={`${doc.title} 파일 삭제`}
                  onClick={() => setDeleteTarget(doc)}
                  className="flex-none w-8 h-8 flex items-center justify-center text-text-quaternary hover:text-danger transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* 업로드 폼 */}
          {showUpload ? (
            <div className="mt-3 p-4 rounded-xl border border-brand/30 bg-brand/4 space-y-3">
              <div>
                <FieldLabel label="파일 제목" required />
                <input
                  // eslint-disable-next-line chwippo/no-bare-autofocus -- 「파일 추가」를 눌러야(showUpload) 열리는 업로드 폼의 첫 칸 — 탭 뒤 등장
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2025 토익 성적표, 개인 포트폴리오"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div>
                <FieldLabel label="카테고리 (선택)" />
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="카테고리"
                    className={FIELD_SELECT_CLASS}
                  >
                    <option value="">선택 안함</option>
                    {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {category === '기타(직접입력)' && (
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="카테고리 직접 입력"
                    aria-label="카테고리 직접 입력"
                    className={`mt-2 ${FIELD_INPUT_CLASS}`}
                  />
                )}
              </div>
              <div>
                <FieldLabel label="파일" required />
                <FileUpload
                  slot={slot}
                  scope="myinfo/document"
                  onChange={setSlot}
                  disabled={saving}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowUpload(false); setTitle(''); setCategory(''); setCustomCategory(''); setSlot(EMPTY_SLOT) }}
                  disabled={saving}
                  className="flex-1 py-2 text-xs text-text-secondary border border-line rounded-lg hover:bg-card active:bg-card-strong transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || slot.kind === 'empty' || saving}
                  className="flex-1 py-2 text-xs font-semibold bg-brand hover:bg-accent active:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-bg rounded-lg transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-1.5 w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-line hover:border-brand/30 rounded-xl py-3 min-h-[44px] sm:min-h-0 transition-all flex items-center justify-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              파일 올리기
            </button>
          )}
        </div>

      </div>
      </DocumentSlotsBody>

      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { deleteDoc(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}
    </SectionCard>
  )
}
