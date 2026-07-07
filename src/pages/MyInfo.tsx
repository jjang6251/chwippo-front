import { useRef, useState, useEffect, createContext, useContext } from 'react'
import { useAutoResize } from '@/hooks/useAutoResize'
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
import { useActivities } from '@/hooks/useActivities'
// 경험 섹션의 type-badge (.intern·.club ...) 스타일이 활동 일지 진입 전에도 보이도록
import '@/pages/Activity/activity-mock.css'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'
import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'
import type { UserProfile, LanguageCert, Cert, Award, Coverletter, CoverletterCustom, MyDocument, Education } from '@/api/myinfo'
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
import { clearFileBySource } from '@/utils/myinfoFileActions'
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

// ── 섹션 메타데이터 ────────────────────────────────────────
const SECTIONS = [
  { id: 'profile',        label: '기본 인적사항', icon: '👤', accent: 'brand'   },
  { id: 'education',      label: '학력',         icon: '🎓', accent: 'success' },
  { id: 'military',       label: '병역사항',     icon: '🪖', accent: 'warning' },
  { id: 'coverletter',    label: '자소서 소재',   icon: '✍️', accent: 'brand'   },
  { id: 'experiences',    label: '경험',         icon: '💼', accent: 'success' },
  { id: 'awards',         label: '수상 내역',     icon: '🏆', accent: 'warning' },
  { id: 'language-certs', label: '어학 자격증',   icon: '🌐', accent: 'success' },
  { id: 'certs',          label: '자격증',       icon: '📜', accent: 'brand'   },
  // ─── 게이지 미포함 ───
  { id: 'exam-schedules', label: '시험 일정',     icon: '📚', accent: 'violet'  },
  { id: 'goals',          label: '스펙 목표',     icon: '🎯', accent: 'danger'  },
  { id: 'files',          label: '파일 보관함',   icon: '📁', accent: 'success' },
] as const

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
const MILITARY_TYPES = ['만기전역', '의병전역', '불명예전역', '복무 중']

// ── 자동저장 상태 ──────────────────────────────────────────
function useSaved() {
  const [saved, setSaved] = useState(false)
  const show = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  return { saved, show }
}

// ── 공통 인풋 ──────────────────────────────────────────────
/** 필수 입력 라벨 — ui-specs.md "필수 입력 필드" 규칙 따름 */
// InfoModal 안 body section 그룹핑 (Education 톤과 통일)
function ModalSection({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? '' : 'pt-6 border-t border-line/50'}>
      <p className="text-[13px] font-bold text-text-primary mb-3.5">{title}</p>
      {children}
    </div>
  )
}

/** 자동완성 선택 후 자격증 정보 카드 (issuer · category · validYears) */
function CertInfoCard({ issuer, category, categoryColor, validYears }: {
  issuer: string; category?: string; categoryColor?: string; validYears?: number | null
}) {
  return (
    <div className="bg-card/60 border border-line/50 rounded-xl px-4 py-3 space-y-1.5">
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

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-sm text-text-secondary mb-2 font-medium">
      {label}
      {required && <span className="text-danger ml-1" aria-label="필수 입력">*</span>}
    </label>
  )
}

function Field({
  label, value, onChange, onBlur, type = 'text',
  placeholder, maxLength, copyable, as, span, required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void
  onBlur?: () => void; type?: string; placeholder?: string
  maxLength?: number; copyable?: boolean; as?: 'textarea'; span?: boolean
  required?: boolean; disabled?: boolean
}) {
  // Toss 톤 — h-12 (48px), text-base, rounded-xl, focus 4px halo
  const base = 'w-full bg-input border border-line/70 rounded-xl text-base text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all'
  const cls = `${base} px-4 h-12 ${copyable ? 'pr-12' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  const textareaCls = `${base} px-4 py-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  // 자소서 소재 textarea — 베타 피드백 패턴 (auto-resize 200~500 + lineHeight 1.6)
  const { ref: textareaRef, autoResize } = useAutoResize(value, { min: 80, max: 500 })
  return (
    <div className={span ? 'col-span-2' : ''}>
      <FieldLabel label={label} required={required} />
      {as === 'textarea' ? (
        <div className="flex items-start gap-1.5">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                autoResize()
              }}
              onBlur={onBlur}
              placeholder={placeholder}
              maxLength={maxLength}
              style={{ minHeight: 80, lineHeight: 1.6 }}
              className={textareaCls + ' resize-y'}
            />
            {maxLength && (
              <p
                className={`text-xs text-right mt-1 ${
                  value.length >= maxLength
                    ? 'text-danger'
                    : value.length >= maxLength * 0.9
                    ? 'text-warning'
                    : value.length >= 200
                    ? 'text-success'
                    : 'text-text-quaternary'
                }`}
              >
                {value.length} / {maxLength}
              </p>
            )}
          </div>
          {copyable && <CopyButton value={value} />}
        </div>
      ) : (
        <div className="relative">
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className={cls}
          />
          {copyable && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2">
              <CopyButton value={value} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-input border border-line/70 rounded-xl pl-4 pr-11 h-12 text-base text-text-primary cursor-pointer focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all">
          <option value="">선택</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}


function DeleteModal({ label = '이 항목', onClose, onConfirm }: { label?: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${label} 삭제 확인`} className="bg-surface border border-line rounded-xl w-full max-w-xs p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold text-text-primary mb-1">삭제할까요?</p>
          <p className="text-xs text-text-quaternary">{label}을(를) 삭제하면 복구할 수 없어요.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs border border-line text-text-secondary rounded-lg hover:bg-card active:bg-card-strong transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 text-xs font-semibold bg-danger/90 hover:bg-danger text-text-primary rounded-lg transition-colors">삭제</button>
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
    <section id={id} ref={sectionRef as React.RefCallback<HTMLElement>} className={`rounded-xl transition-all duration-300 bg-card overflow-hidden
      ${isActive ? `${ac.activeBorder} ${ac.activeGlow}` : ac.border}`}>
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={!closed}
        aria-controls={`${id}-body`}
        className={`w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-2/40 transition-colors ${closed ? '' : 'border-b border-line'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${ac.icon}`}>{meta.icon}</span>
          <h2 className="text-sm font-semibold text-text-primary">{meta.label}</h2>
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
      {!closed && <div id={`${id}-body`} className="px-6 py-5">{children}</div>}
    </section>
  )
}

function AddButton({ onClick, label = '추가' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-line hover:border-brand/30 rounded-xl py-3 transition-all flex items-center justify-center gap-1.5">
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

  return (
    <CollapseCtx.Provider value={{ isCollapsed: collapse.isCollapsed, toggle: collapse.toggle }}>
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-text-primary text-xl font-bold">내 정보 창고</h1>
          <p className="text-text-tertiary text-xs mt-1.5">이력서·자소서 작성 시 한 번 쓰면 평생 재활용하는 데이터 창고예요</p>
          <p className="text-text-quaternary text-[11px] mt-0.5">필드를 벗어나면 자동 저장 · 복사 버튼으로 자소서 작성 시 바로 활용</p>
        </div>
        <button
          type="button"
          onClick={() => collapse.allCollapsed ? collapse.expandAll() : collapse.collapseAll()}
          className="shrink-0 text-[11px] font-medium text-text-tertiary hover:text-text-primary px-2.5 py-1.5 rounded-md border border-line hover:bg-card-strong transition-colors"
        >
          {collapse.allCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>
      </div>

      <div className="mb-6 space-y-3">
        <MyinfoProgressGauge />
        <StorageUsageBar />
      </div>

      {/* 모바일 섹션 점프 칩 — lg 이상에서는 좌측 사이드바로 대체 */}
      <div className="lg:hidden sticky top-12 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-bg/95 backdrop-blur-sm border-b border-line mb-4">
        <div
          className="flex gap-1.5 overflow-x-auto py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id
            const status = progressSections.find((p) => p.id === s.id)
            return (
              <button
                key={s.id}
                ref={(el) => { tabRefs.current[s.id] = el }}
                onClick={() => scrollTo(s.id)}
                className={`flex-none flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 border
                  ${isActive
                    ? 'bg-brand/15 text-brand border-brand/30'
                    : 'bg-card text-text-quaternary border-line hover:text-text-secondary hover:bg-card active:bg-card-strong'
                  }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                {status && status.active && (
                  status.kind === 'multi'
                    ? <span className={`text-[10px] font-mono tabular-nums ${status.count > 0 ? 'text-brand/70' : 'text-text-quaternary/50'}`}>({status.count})</span>
                    : status.filled
                      ? <span className="text-success text-[10px]">✓</span>
                      : null
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-8">
        {/* 좌측 섹션 네비 */}
        <aside className="hidden lg:block w-44 flex-none sticky top-8 self-start">
          <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-3 px-3">섹션</p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const ac = ACCENT_STYLE[s.accent as keyof typeof ACCENT_STYLE]
              const isActive = activeSection === s.id
              const status = progressSections.find((p) => p.id === s.id)
              const isFirstExcluded = s.id === 'exam-schedules'
              return (
                <div key={s.id}>
                  {isFirstExcluded && (
                    <div className="my-2 px-3">
                      <div className="h-px bg-card-strong" />
                      <p className="text-[10px] text-text-quaternary/70 font-medium uppercase tracking-wider mt-2">기타</p>
                    </div>
                  )}
                <button
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
                      ? <span className={`text-[10px] font-mono tabular-nums flex-none ${status.count > 0 ? 'text-brand' : 'text-text-quaternary/70'}`}>({status.count})</span>
                      : status.filled
                        ? <span className="text-success text-[10px] flex-none" aria-label="채움 완료">✓</span>
                        : <span className="text-text-quaternary/70 text-[10px] flex-none" aria-label="미입력">○</span>
                  )}
                </button>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* 우측 섹션들 — SECTIONS 배열 순서와 동일 */}
        <div className="flex-1 space-y-5 min-w-0">
          <ProfileSection       sectionRef={(el) => { sectionRefs.current['profile'] = el }}          isActive={activeSection === 'profile'} />
          <EducationsSection    sectionRef={(el) => { sectionRefs.current['education'] = el }}        isActive={activeSection === 'education'} />
          <MilitarySection      sectionRef={(el) => { sectionRefs.current['military'] = el }}         isActive={activeSection === 'military'} />
          <CoverletterSection   sectionRef={(el) => { sectionRefs.current['coverletter'] = el }}      isActive={activeSection === 'coverletter'} />
          <ExperiencesSection   sectionRef={(el) => { sectionRefs.current['experiences'] = el }}      isActive={activeSection === 'experiences'} />
          <AwardsSection        sectionRef={(el) => { sectionRefs.current['awards'] = el }}           isActive={activeSection === 'awards'} />
          <LangCertsSection     sectionRef={(el) => { sectionRefs.current['language-certs'] = el }}   isActive={activeSection === 'language-certs'} />
          <CertsSection         sectionRef={(el) => { sectionRefs.current['certs'] = el }}            isActive={activeSection === 'certs'} />
          <ExamSchedulesSection sectionRef={(el) => { sectionRefs.current['exam-schedules'] = el }}   isActive={activeSection === 'exam-schedules'} />
          <GoalsSection         sectionRef={(el) => { sectionRefs.current['goals'] = el }}            isActive={activeSection === 'goals'} />
          <FilesSection         sectionRef={(el) => { sectionRefs.current['files'] = el }}            isActive={activeSection === 'files'} />
        </div>
      </div>
    </div>
    </CollapseCtx.Provider>
  )
}

// ── 기본 인적사항 ─────────────────────────────────────────
const GENDER_KO: Record<string, string> = { MALE: '남성', FEMALE: '여성' }
const PROFILE_FIELDS: Array<keyof Pick<UserProfile, 'name' | 'name_hanja' | 'gender' | 'birthdate' | 'phone' | 'email_personal'>> =
  ['name', 'name_hanja', 'gender', 'birthdate', 'phone', 'email_personal']

function ProfileSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()

  const init = { name: '', name_hanja: '', gender: '', birthdate: '', phone: '', email_personal: '' }
  const [form, setForm] = useState(init)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)

  if (profile && !loaded) {
    setForm({
      name: profile.name ?? '', name_hanja: profile.name_hanja ?? '',
      gender: profile.gender ?? '', birthdate: profile.birthdate ?? '',
      phone: profile.phone ?? '', email_personal: profile.email_personal ?? '',
    })
    setLoaded(true)
  }

  const save = (key: string, val: string) =>
    update({ [key]: val || null } as Partial<UserProfile>, { onSuccess: show })

  const hasAny = !!profile && PROFILE_FIELDS.some((k) => (profile[k] ?? '').toString().trim().length > 0)

  return (
    <SectionCard id="profile" sectionRef={sectionRef} saved={saved} isActive={isActive}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <Field label="이름" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} onBlur={() => save('name', form.name)} placeholder="홍길동" copyable required />
              <Field label="이름 (한자)" value={form.name_hanja} onChange={(v) => setForm(f => ({ ...f, name_hanja: v }))} onBlur={() => save('name_hanja', form.name_hanja)} placeholder="洪吉童" copyable />
              <SelectField label="성별" value={form.gender} onChange={(v) => { setForm(f => ({ ...f, gender: v })); save('gender', v) }} options={['MALE', 'FEMALE']} />
              <Field label="생년월일" type="date" value={form.birthdate} onChange={(v) => { setForm(f => ({ ...f, birthdate: v })); save('birthdate', v) }} />
              <Field label="연락처" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} onBlur={() => save('phone', form.phone)} placeholder="010-0000-0000" copyable />
              <Field label="이메일" value={form.email_personal} onChange={(v) => setForm(f => ({ ...f, email_personal: v }))} onBlur={() => save('email_personal', form.email_personal)} placeholder="example@email.com" copyable />
            </div>
          ) : (
            <div>
              <MyInfoViewRow label="이름" value={profile?.name} copyable />
              <MyInfoViewRow label="이름 (한자)" value={profile?.name_hanja} copyable />
              <MyInfoViewRow label="성별" value={profile?.gender ? GENDER_KO[profile.gender] : ''} />
              <MyInfoViewRow label="생년월일" value={profile?.birthdate} />
              <MyInfoViewRow label="연락처" value={profile?.phone} copyable />
              <MyInfoViewRow label="이메일" value={profile?.email_personal} copyable />
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
const MILITARY_FIELDS: Array<keyof Pick<UserProfile, 'military_branch' | 'military_type' | 'military_start' | 'military_end' | 'military_unit'>> =
  ['military_branch', 'military_type', 'military_start', 'military_end', 'military_unit']

function MilitarySection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()
  const init = { military_branch: '', military_type: '', military_start: '', military_end: '', military_unit: '' }
  const [form, setForm] = useState(init)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)

  if (profile && !loaded) {
    setForm({
      military_branch: profile.military_branch ?? '', military_type: profile.military_type ?? '',
      military_start: profile.military_start ?? '', military_end: profile.military_end ?? '',
      military_unit: profile.military_unit ?? '',
    })
    setLoaded(true)
  }

  const isMale = profile?.gender === 'MALE'
  const hasAny = !!profile && MILITARY_FIELDS.some((k) => (profile[k] ?? '').toString().trim().length > 0)
  const isServing = form.military_type === '복무 중'
  const save = (key: string, val: string) => update({ [key]: val || null } as Partial<UserProfile>, { onSuccess: show })

  const handleEndChange = (v: string) => {
    if (v && form.military_start && v < form.military_start) {
      toast.error('전역일은 입대일 이후여야 해요.')
      return
    }
    setForm(f => ({ ...f, military_end: v }))
    save('military_end', v)
  }
  const handleStartChange = (v: string) => {
    if (v && form.military_end && v > form.military_end) {
      toast.error('입대일은 전역일 이전이어야 해요.')
      return
    }
    setForm(f => ({ ...f, military_start: v }))
    save('military_start', v)
  }
  const handleTypeChange = (v: string) => {
    setForm(f => ({ ...f, military_type: v, military_end: v === '복무 중' ? '' : f.military_end }))
    save('military_type', v)
    if (v === '복무 중' && form.military_end) save('military_end', '')
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <SelectField label="군별" value={form.military_branch} onChange={(v) => { setForm(f => ({ ...f, military_branch: v })); save('military_branch', v) }} options={MILITARY_BRANCHES} />
              <SelectField label="전역 구분" value={form.military_type} onChange={handleTypeChange} options={MILITARY_TYPES} />
              <Field label="입대일" type="date" value={form.military_start} onChange={handleStartChange} />
              <Field
                label={isServing ? '전역일 (복무 중)' : '전역일'}
                type="date"
                value={isServing ? '' : form.military_end}
                onChange={handleEndChange}
                disabled={isServing}
              />
              <Field label="병과" value={form.military_unit} onChange={(v) => setForm(f => ({ ...f, military_unit: v }))} onBlur={() => save('military_unit', form.military_unit)} placeholder="보병, 통신 등" span />
            </div>
          ) : (
            <div>
              <MyInfoViewRow label="군별" value={profile?.military_branch} />
              <MyInfoViewRow label="전역 구분" value={profile?.military_type} />
              <MyInfoViewRow label="입대일" value={profile?.military_start} />
              <MyInfoViewRow label="전역일" value={isServing ? '복무 중' : profile?.military_end} />
              <MyInfoViewRow label="병과" value={profile?.military_unit} />
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
      const acq = new Date(form.acquired_at)
      acq.setFullYear(acq.getFullYear() + c.validYears)
      setForm((f) => ({ ...f, expires_at: acq.toISOString().slice(0, 10) }))
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
                <FieldLabel label="종류" required />
                <LangCertAutocomplete
                  value={form.cert_type}
                  onChange={(v) => setForm(f => ({ ...f, cert_type: v }))}
                  onSelect={handleLangCertSelect}
                  placeholder="예: TOEIC · JLPT · HSK"
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
              <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} />
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
function CertsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [], isLoading } = useCerts()
  const { mutateAsync: create } = useCreateCert()
  const { mutateAsync: update } = useUpdateCert()
  const { mutate: remove } = useDeleteCert()
  const [modal, setModal] = useState<null | 'add' | Cert>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cert | null>(null)
  const emptyForm = { name: '', issuer: '', cert_number: '', acquired_at: '', expires_at: '' }
  const [form, setForm] = useState(emptyForm)
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)
  /** 자격증 정적 카탈로그 메타 (자동완성 선택 후 hasNumber/validYears 등 조건부 표시 위해) */
  const [certMeta, setCertMeta] = useState<CertSuggestion | null>(null)
  /** 자격증번호 placeholder (선택된 자격증의 numberExample) */
  const numberPlaceholder = certMeta?.numberExample ?? '자격번호'
  /** hasNumber=false 시 자격번호 필드 hide */
  const showNumberField = certMeta ? certMeta.hasNumber : true

  const openAdd = () => { setForm(emptyForm); setSlot(EMPTY_SLOT); setCertMeta(null); setModal('add') }
  const openEdit = (item: Cert) => {
    setForm({ name: item.name, issuer: item.issuer ?? '', cert_number: item.cert_number ?? '', acquired_at: item.acquired_at ?? '', expires_at: item.expires_at ?? '' })
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
      const acq = new Date(form.acquired_at)
      acq.setFullYear(acq.getFullYear() + c.validYears)
      setForm((f) => ({ ...f, expires_at: acq.toISOString().slice(0, 10) }))
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
            example="예: 정보처리기사 · 한국산업인력공단 · 2024.05"
            onClick={openAdd}
          />
        )}
        {items.map((item) => {
          const fields = [
            { label: '자격증명', value: item.name ?? '' },
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
              title={item.name}
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
                <FieldLabel label="자격증명" required />
                <CertAutocomplete
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  onSelect={handleCertSelect}
                  placeholder="예: 정보처리기사"
                />
              </div>
              {certMeta && (
                <CertInfoCard
                  issuer={certMeta.issuer}
                  category={certMeta.category}
                  validYears={certMeta.validYears}
                />
              )}
              <Field label="발급기관" value={form.issuer} onChange={(v) => setForm(f => ({ ...f, issuer: v }))} placeholder={certMeta?.issuer ?? '한국산업인력공단'} />
              {showNumberField && (
                <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} placeholder={numberPlaceholder} />
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
            example="예: 정보처리기사 필기 · 2024.08.15 14:00"
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


function EducationsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [], isLoading } = useEducations()
  const { mutateAsync: create } = useCreateEducation()
  const { mutateAsync: update } = useUpdateEducation()
  const { mutate: remove } = useDeleteEducation()
  const [modal, setModal] = useState<null | 'add' | Education>(null)
  const [deleteTarget, setDeleteTarget] = useState<Education | null>(null)

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

  return (
    <SectionCard id="education" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}
        {!isLoading && items.length === 0 && (
          <MyInfoEmptyAdd
            emoji="🎓"
            label="첫 학력 추가하기"
            example="예: 서울대학교 · 컴퓨터공학 · 2020-2024"
            onClick={() => setModal('add')}
          />
        )}
        {items.map((item) => {
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
              onClick={() => setModal(item)}
              onEdit={() => setModal(item)}
              badge={item.degree || undefined}
              detailFields={fields}
            />
          )
        })}
        {!isLoading && items.length > 0 && (
          <MyInfoEmptyAdd label="학력 추가" compact onClick={() => setModal('add')} />
        )}
      </div>
      {modal && (
        <EducationModal
          initial={modal === 'add' ? null : modal}
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
            example="예: 교내 프로그래밍 대회 · 대상 · 2024.06"
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

// ── 경험 (활동 일지로 이전됨 — mock #page-myinfo summary-card 1:1) ──
function ExperiencesSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: activities = [] } = useActivities(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  // 기본함(미분류) 은 활동이 아니라 퀵캡처 수신함 — 경험 카드에서 제외
  const visibleActs = activities.filter((a) => !a.isInbox)
  const ongoing = visibleActs.filter((a) => !a.archivedAt && (!a.endedAt || a.endedAt >= today))
  const completed = visibleActs.filter((a) => !a.archivedAt && a.endedAt && a.endedAt < today)
  const allLogs = activities.flatMap((a) => a.logs ?? [])
  // 이번주 KST 월요일
  const monday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  })()
  const weekLogCount = (activityId: string) =>
    allLogs.filter((l) => l.activityId === activityId && l.occurredAt >= monday).length

  return (
    <SectionCard
      id="experiences"
      sectionRef={sectionRef}
      isActive={isActive}
      headerRight={
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand/10 text-brand">
          진행 중 {ongoing.length}개
        </span>
      }
    >
      <div className="space-y-3">
        {/* 부제 — mock 의 summary-card 부제 */}
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          활동 일지에서 일별 기록·회고와 함께 관리되고 있어요.
        </p>

        {/* 진행 중 활동 mini list */}
        <div className="space-y-1.5">
          {ongoing.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-text-tertiary">
              진행 중인 활동이 없어요. 활동 일지에서 시작해보세요.
            </div>
          ) : (
            ongoing.map((a) => (
              <Link
                key={a.id}
                to="/activity"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-line bg-card hover:bg-card-hover active:bg-card-strong transition-colors"
              >
                <span className={`type-badge ${a.type ?? 'other'} text-[9.5px] px-2 py-0.5 rounded shrink-0`}>
                  {a.type ? (ACTIVITY_TYPE_KO[a.type] ?? a.type) : '기타'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-primary truncate">{a.name}</div>
                  {(a.role || a.org) && (
                    <div className="text-[10.5px] text-text-tertiary truncate">
                      {a.role ?? ''}{a.role && a.org ? ' · ' : ''}{a.org ?? ''}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                  {weekLogCount(a.id)} 이번주
                </span>
              </Link>
            ))
          )}
        </div>

        {/* 완료 활동 토글 */}
        {completed.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="w-full flex items-center justify-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-secondary py-1.5"
            >
              완료 활동 {completed.length}개 보기 {showCompleted ? '▴' : '▾'}
            </button>
            {showCompleted && (
              <div className="space-y-1.5">
                {completed.map((a) => {
                  const logCount = allLogs.filter((l) => l.activityId === a.id).length
                  const period = (() => {
                    if (!a.startedAt && !a.endedAt) return ''
                    const start = a.startedAt?.slice(0, 7).replace('-', '.') ?? ''
                    const end = a.endedAt?.slice(0, 7).replace('-', '.') ?? ''
                    return start && end ? `${start} ~ ${end}` : (end || start)
                  })()
                  return (
                    <Link
                      key={a.id}
                      to="/activity"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-line bg-card hover:bg-card-hover active:bg-card-strong transition-colors"
                    >
                      <span className={`type-badge ${a.type ?? 'other'} text-[9.5px] px-2 py-0.5 rounded shrink-0`}>
                        {a.type ? (ACTIVITY_TYPE_KO[a.type] ?? a.type) : '기타'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text-primary truncate">{a.name}</div>
                        {(a.role || period) && (
                          <div className="text-[10.5px] text-text-tertiary truncate">
                            {a.role ?? ''}{a.role && period ? ' · ' : ''}{period}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-text-quaternary/15 text-text-tertiary">
                        {logCount}건
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 활동 일지로 이동 */}
        <Link
          to="/activity"
          className="flex items-center justify-center gap-1 w-full bg-brand/10 hover:bg-brand/20 active:bg-brand/30 text-brand text-xs font-semibold py-2.5 rounded-lg transition-colors border border-brand/20"
        >
          → 활동 일지에서 자세히 보기
        </Link>
      </div>
    </SectionCard>
  )
}

const ACTIVITY_TYPE_KO: Record<string, string> = {
  intern: '인턴',
  club: '동아리',
  study: '스터디',
  project: '팀 프로젝트',
  sideproject: '사이드 프로젝트',
  contest: '공모전·해커톤',
  research: '연구·학술',
  parttime: '알바',
  volunteer: '봉사',
  overseas: '해외 경험',
  bootcamp: '부트캠프·교육',
  other: '기타',
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

  const persist = (list: string[]) => {
    update({ goal_other: list.join('\n') } as Partial<UserProfile>, { onSuccess: show })
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    const updated = [...goals, newGoal.trim()]
    setGoals(updated)
    persist(updated)
    setNewGoal('')
    setAdding(false)
  }

  const removeGoal = (idx: number) => {
    const updated = goals.filter((_, i) => i !== idx)
    setGoals(updated)
    persist(updated)
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
              autoFocus
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addGoal(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="목표를 입력하세요 (예: TOEIC 900점 달성)"
              className="flex-1 bg-card border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-tertiary"
            />
            <button onClick={() => setAdding(false)} className="text-xs text-text-quaternary px-2 hover:text-text-secondary">취소</button>
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
                    autoFocus
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddCustom(); if (e.key === 'Escape') setAddingLabel(false) }}
                    placeholder="항목명 입력 (예: 해외 경험)"
                    className="flex-1 bg-card border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-tertiary"
                  />
                  <button onClick={() => setAddingLabel(false)} className="text-xs text-text-quaternary px-2 hover:text-text-secondary">취소</button>
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

// ── 파일 보관함 ───────────────────────────────────────────
const DOC_CATEGORIES = ['이력서', '포트폴리오', '성적증명서', '졸업증명서', '자기소개서', '기타(직접입력)']

type ExistingFileSource = '학력' | '어학 자격증' | '자격증' | '수상 내역'
interface ExistingFile {
  id: string
  label: string
  source: ExistingFileSource
  file_url: string
  file_size_bytes: number | null
}

/** 바이트 → "1.2MB" / "340KB" 표시 */
function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function FilesSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: langCerts = [] } = useLangCerts()
  const { data: certs = [] } = useCerts()
  const { data: awards = [] } = useAwards()
  const { data: educations = [] } = useEducations()
  const { data: documents = [] } = useDocuments()
  const { mutateAsync: createDoc } = useCreateDocument()
  const { mutate: deleteDoc } = useDeleteDocument()
  // 보관함 X 버튼은 "파일만" 비움 — 항목 row는 남김. file_url=''로 PATCH → 백엔드 EmptyToNull + R2 cascade.
  const { mutate: updateEdu } = useUpdateEducation()
  const { mutate: updateLangCert } = useUpdateLangCert()
  const { mutate: updateCert } = useUpdateCert()
  const { mutate: updateAward } = useUpdateAward()

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MyDocument | null>(null)
  const [existingDeleteTarget, setExistingDeleteTarget] = useState<ExistingFile | null>(null)

  // 기존 섹션에서 올라간 파일 집계
  const existingFiles: ExistingFile[] = [
    ...educations.filter(i => i.file_url).map((i): ExistingFile => ({ id: i.id, label: i.school_name, source: '학력', file_url: i.file_url!, file_size_bytes: i.file_size_bytes ?? null })),
    ...langCerts.filter(i => i.file_url).map((i): ExistingFile => ({ id: i.id, label: i.cert_type, source: '어학 자격증', file_url: i.file_url!, file_size_bytes: i.file_size_bytes ?? null })),
    ...certs.filter(i => i.file_url).map((i): ExistingFile => ({ id: i.id, label: i.name, source: '자격증', file_url: i.file_url!, file_size_bytes: i.file_size_bytes ?? null })),
    ...awards.filter(i => i.file_url).map((i): ExistingFile => ({ id: i.id, label: i.contest_name, source: '수상 내역', file_url: i.file_url!, file_size_bytes: i.file_size_bytes ?? null })),
  ]

  // 보관함에서 X 버튼 = "파일만" 제거 (utils/myinfoFileActions에서 단위 테스트됨)
  const updaters = {
    updateEducation: updateEdu as never,
    updateLangCert: updateLangCert as never,
    updateCert: updateCert as never,
    updateAward: updateAward as never,
  }

  const SOURCE_STYLE: Record<string, string> = {
    '학력':       'bg-success/12 text-success',
    '어학 자격증': 'bg-success/12 text-success',
    '자격증':     'bg-brand/10 text-brand',
    '수상 내역':   'bg-warning/12 text-warning',
  }

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
      <div className="space-y-5">

        {/* 기존 섹션 파일 */}
        {existingFiles.length > 0 && (
          <div>
            <p className="text-[11px] text-text-quaternary font-semibold mb-2">학력 · 자격증 · 수상 내역에서 등록한 파일</p>
            <div className="space-y-1.5">
              {existingFiles.map((f) => (
                <div
                  key={`${f.source}-${f.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-line bg-card hover:border-line-strong hover:bg-card active:bg-card-strong transition-all group"
                >
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 min-w-0 items-center gap-3"
                  >
                    <FileIcon url={f.file_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate group-hover:text-brand transition-colors">{f.label}</p>
                    </div>
                    {f.file_size_bytes != null && f.file_size_bytes > 0 && (
                      <span className="text-[10px] text-text-quaternary flex-none">{formatBytes(f.file_size_bytes)}</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-none ${SOURCE_STYLE[f.source] ?? 'bg-card-strong text-text-tertiary'}`}>{f.source}</span>
                  </a>
                  <button
                    type="button"
                    aria-label={`${f.label} 항목 삭제`}
                    onClick={() => setExistingDeleteTarget(f)}
                    className="flex-none w-8 h-8 flex items-center justify-center text-text-quaternary hover:text-danger transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 구분선 */}
        {existingFiles.length > 0 && (
          <div className="border-t border-line" />
        )}

        {/* 직접 올린 파일들 */}
        <div>
          {existingFiles.length > 0 && (
            <p className="text-[11px] text-text-quaternary font-semibold mb-2">직접 올린 파일</p>
          )}
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-line bg-card hover:border-line-strong hover:bg-card active:bg-card-strong transition-all group"
              >
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 min-w-0 items-center gap-3"
                >
                  <FileIcon url={doc.file_url} />
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
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2025 토익 성적표, 개인 포트폴리오"
                  className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5 font-medium">카테고리 (선택)</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-input border border-line rounded-lg px-3 py-2 pr-8 text-xs text-text-primary cursor-pointer focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all appearance-none"
                  >
                    <option value="">선택 안함</option>
                    {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {category === '기타(직접입력)' && (
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="카테고리 직접 입력"
                    className="mt-2 w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
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
                  className="flex-1 py-2 text-xs font-semibold bg-brand hover:bg-accent active:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-primary rounded-lg transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-1.5 w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-line hover:border-brand/30 rounded-xl py-3 transition-all flex items-center justify-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              파일 올리기
            </button>
          )}
        </div>

        {existingFiles.length === 0 && documents.length === 0 && !showUpload && (
          <p className="text-xs text-text-quaternary text-center py-2">자격증·수상 내역에서 첨부한 파일과 직접 올린 파일이 여기에 모여요</p>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          label={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { deleteDoc(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}

      {/* 보관함 X 버튼 → "파일만" 제거. 항목 row는 그대로, file_url=null + R2 cascade로 정리 */}
      {existingDeleteTarget && (
        <DeleteModal
          label={`${existingDeleteTarget.label}의 첨부 파일`}
          onClose={() => setExistingDeleteTarget(null)}
          onConfirm={() => {
            clearFileBySource(existingDeleteTarget.source, existingDeleteTarget.id, updaters)
            setExistingDeleteTarget(null)
          }}
        />
      )}
    </SectionCard>
  )
}
