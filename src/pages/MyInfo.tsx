import { useRef, useState, useEffect } from 'react'
import {
  useProfile, useUpdateProfile,
  useLangCerts, useCreateLangCert, useUpdateLangCert, useDeleteLangCert,
  useCerts, useCreateCert, useUpdateCert, useDeleteCert,
  useAwards, useCreateAward, useUpdateAward, useDeleteAward,
  useExperiences, useCreateExperience, useUpdateExperience, useDeleteExperience,
  useCoverletter, useUpdateCoverletter, useCreateCustomItem, useUpdateCustomItem, useDeleteCustomItem,
  useDocuments, useCreateDocument, useDeleteDocument,
} from '@/hooks/useMyinfo'
import type { LanguageCert, Cert, Award, Experience, CoverletterCustom, MyDocument } from '@/api/myinfo'
import { CopyButton } from '@/components/myinfo/CopyButton'
import { FileUpload } from '@/components/myinfo/FileUpload'

// ── 섹션 메타데이터 ────────────────────────────────────────
const SECTIONS = [
  { id: 'profile',        label: '기본 인적사항', icon: '👤', accent: 'brand'   },
  { id: 'military',       label: '병역사항',     icon: '🪖', accent: 'warning' },
  { id: 'language-certs', label: '어학 자격증',   icon: '🌐', accent: 'success' },
  { id: 'certs',          label: '자격증',       icon: '📜', accent: 'brand'   },
  { id: 'awards',         label: '수상 내역',     icon: '🏆', accent: 'warning' },
  { id: 'experiences',    label: '경험',         icon: '💼', accent: 'success' },
  { id: 'goals',          label: '스펙 목표',     icon: '🎯', accent: 'danger'  },
  { id: 'coverletter',    label: '자소서 소재',   icon: '✍️', accent: 'brand'   },
  { id: 'files',          label: '파일 보관함',   icon: '📁', accent: 'success' },
] as const

const ACCENT_STYLE = {
  brand:   { icon: 'bg-brand/15 text-brand',    border: 'border border-brand/25',   activeBorder: 'border-2 border-brand',   activeGlow: 'shadow-lg'   },
  warning: { icon: 'bg-warning/15 text-warning', border: 'border border-warning/25', activeBorder: 'border-2 border-warning', activeGlow: 'shadow-lg' },
  success: { icon: 'bg-success/15 text-success', border: 'border border-success/25', activeBorder: 'border-2 border-success', activeGlow: 'shadow-lg' },
  danger:  { icon: 'bg-danger/15 text-danger',   border: 'border border-danger/25',  activeBorder: 'border-2 border-danger',  activeGlow: 'shadow-lg'  },
}

const LANG_CERT_TYPES = ['TOEIC', 'TOEIC Speaking', 'OPIC', 'TEPS', 'JLPT', 'HSK', '기타']
const MILITARY_BRANCHES = ['육군', '해군', '공군', '해병대', '사회복무요원', '산업기능요원', '전문연구요원']
const MILITARY_TYPES = ['만기전역', '의병전역', '불명예전역', '복무 중']

// ── 자동저장 상태 ──────────────────────────────────────────
function useSaved() {
  const [saved, setSaved] = useState(false)
  const show = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  return { saved, show }
}

// ── 공통 인풋 ──────────────────────────────────────────────
function Field({
  label, value, onChange, onBlur, type = 'text',
  placeholder, maxLength, copyable, as, span,
}: {
  label: string; value: string; onChange: (v: string) => void
  onBlur?: () => void; type?: string; placeholder?: string
  maxLength?: number; copyable?: boolean; as?: 'textarea'; span?: boolean
}) {
  const cls = 'w-full bg-[#111213] border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/15 transition-all'
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs text-text-tertiary mb-1.5 font-medium">{label}</label>
      <div className="flex items-start gap-1.5">
        {as === 'textarea'
          ? <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} rows={4} className={cls + ' resize-none'} />
          : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} className={cls} />
        }
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-1.5 font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#111213] border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/50 transition-all appearance-none">
        <option value="">선택</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── 모달 ──────────────────────────────────────────────────
function Modal({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1011] border border-white/12 rounded-t-2xl sm:rounded-xl w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-text-secondary border border-white/10 rounded-lg hover:bg-white/5 transition-colors">취소</button>
          <button onClick={onSave} className="flex-1 py-2.5 text-xs font-semibold bg-brand hover:bg-accent text-white rounded-lg transition-colors">저장</button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ label = '이 항목', onClose, onConfirm }: { label?: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1011] border border-white/12 rounded-xl w-full max-w-xs p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold text-text-primary mb-1">삭제할까요?</p>
          <p className="text-xs text-text-quaternary">{label}을(를) 삭제하면 복구할 수 없어요.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs border border-white/10 text-text-secondary rounded-lg hover:bg-white/5 transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 text-xs font-semibold bg-danger/90 hover:bg-danger text-white rounded-lg transition-colors">삭제</button>
        </div>
      </div>
    </div>
  )
}

// ── 섹션 카드 ─────────────────────────────────────────────
function SectionCard({ id, sectionRef, saved, isActive, children }: {
  id: string; sectionRef: (el: HTMLElement | null) => void; saved?: boolean; isActive?: boolean; children: React.ReactNode
}) {
  const meta = SECTIONS.find(s => s.id === id)!
  const ac = ACCENT_STYLE[meta.accent as keyof typeof ACCENT_STYLE]
  return (
    <section id={id} ref={sectionRef as React.RefCallback<HTMLElement>} className={`rounded-2xl transition-all duration-300 bg-gradient-to-b from-[#131415] to-[#0f1011] overflow-hidden
      ${isActive ? `${ac.activeBorder} ${ac.activeGlow}` : ac.border}`}>
      <div className="px-6 py-4 border-b border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${ac.icon}`}>{meta.icon}</span>
          <h2 className="text-sm font-semibold text-text-primary">{meta.label}</h2>
        </div>
        {saved && (
          <span className="text-[10px] font-medium text-success flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            저장됨
          </span>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

// ── 확장형 아이템 카드 ────────────────────────────────────
function ExpandableItem({ title, subtitle, badge, onEdit, onDelete, children }: {
  title: string; subtitle?: string; badge?: string; onEdit: () => void; onDelete: () => void; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-xl border transition-all duration-200 ${open ? 'border-brand/30 bg-brand/4' : 'border-white/8 bg-[#111213] hover:border-white/14'}`}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-text-quaternary truncate mt-0.5">{subtitle}</p>}
        </div>
        {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-text-tertiary border border-white/8">{badge}</span>}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`text-text-quaternary flex-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/6">
          <div className="pt-4 space-y-3">{children}</div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-white/6">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-white/8 border border-white/8 transition-colors">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7.5 1.5L9.5 3.5L4 9H2V7L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              편집
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 text-[11px] text-text-quaternary hover:text-danger px-3 py-1.5 rounded-lg hover:bg-danger/8 border border-white/8 hover:border-danger/20 transition-colors">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3">
      <span className="text-[11px] text-text-quaternary w-20 flex-none">{label}</span>
      <span className="text-[11px] text-text-secondary flex-1">{value}</span>
    </div>
  )
}

function AddButton({ onClick, label = '추가' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-white/10 hover:border-brand/30 rounded-xl py-3 transition-all flex items-center justify-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────
export function MyInfo() {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeSection, setActiveSection] = useState('profile')
  const isProgrammaticScroll = useRef(false)
  const scrollLockTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return
      const OFFSET = 160
      const tops = SECTIONS.map(({ id }) => ({
        id,
        top: (sectionRefs.current[id]?.getBoundingClientRect().top ?? Infinity) + window.scrollY,
      }))
      const scrollPos = window.scrollY + OFFSET
      const active = [...tops].reverse().find((s) => s.top <= scrollPos)
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-text-primary text-xl font-bold">내 정보 창고</h1>
        <p className="text-text-quaternary text-xs mt-1">필드를 벗어나면 자동 저장 · 복사 버튼으로 자소서 작성 시 바로 활용</p>
      </div>

      <div className="flex gap-8">
        {/* 좌측 섹션 네비 */}
        <aside className="hidden lg:block w-44 flex-none sticky top-8 self-start">
          <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-3 px-3">섹션</p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const ac = ACCENT_STYLE[s.accent as keyof typeof ACCENT_STYLE]
              const isActive = activeSection === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150
                    ${isActive
                      ? 'bg-white/8 text-text-primary border-l-2 border-brand pl-[10px]'
                      : 'text-text-quaternary hover:text-text-secondary hover:bg-white/4 border-l-2 border-transparent pl-[10px]'
                    }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm flex-none transition-colors ${isActive ? ac.icon : 'bg-white/6 opacity-70'}`}>{s.icon}</span>
                  <span className="text-[11px] font-medium truncate">{s.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* 우측 섹션들 */}
        <div className="flex-1 space-y-5 min-w-0">
          <ProfileSection     sectionRef={(el) => { sectionRefs.current['profile'] = el }}        isActive={activeSection === 'profile'} />
          <MilitarySection    sectionRef={(el) => { sectionRefs.current['military'] = el }}       isActive={activeSection === 'military'} />
          <LangCertsSection   sectionRef={(el) => { sectionRefs.current['language-certs'] = el }} isActive={activeSection === 'language-certs'} />
          <CertsSection       sectionRef={(el) => { sectionRefs.current['certs'] = el }}          isActive={activeSection === 'certs'} />
          <AwardsSection      sectionRef={(el) => { sectionRefs.current['awards'] = el }}         isActive={activeSection === 'awards'} />
          <ExperiencesSection sectionRef={(el) => { sectionRefs.current['experiences'] = el }}    isActive={activeSection === 'experiences'} />
          <GoalsSection       sectionRef={(el) => { sectionRefs.current['goals'] = el }}          isActive={activeSection === 'goals'} />
          <CoverletterSection sectionRef={(el) => { sectionRefs.current['coverletter'] = el }}    isActive={activeSection === 'coverletter'} />
          <FilesSection       sectionRef={(el) => { sectionRefs.current['files'] = el }}           isActive={activeSection === 'files'} />
        </div>
      </div>
    </div>
  )
}

// ── 기본 인적사항 ─────────────────────────────────────────
function ProfileSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()

  const init = { name: '', name_hanja: '', gender: '', birthdate: '', phone: '', email_personal: '' }
  const [form, setForm] = useState(init)
  const [loaded, setLoaded] = useState(false)

  if (profile && !loaded) {
    setForm({
      name: profile.name ?? '', name_hanja: profile.name_hanja ?? '',
      gender: profile.gender ?? '', birthdate: profile.birthdate ?? '',
      phone: profile.phone ?? '', email_personal: profile.email_personal ?? '',
    })
    setLoaded(true)
  }

  const save = (key: string, val: string) =>
    update({ [key]: val || null } as any, { onSuccess: show })

  return (
    <SectionCard id="profile" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="이름" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} onBlur={() => save('name', form.name)} placeholder="홍길동" copyable />
        <Field label="이름 (한자)" value={form.name_hanja} onChange={(v) => setForm(f => ({ ...f, name_hanja: v }))} onBlur={() => save('name_hanja', form.name_hanja)} placeholder="洪吉童" copyable />
        <SelectField label="성별" value={form.gender} onChange={(v) => { setForm(f => ({ ...f, gender: v })); save('gender', v) }} options={['MALE', 'FEMALE']} />
        <Field label="생년월일" type="date" value={form.birthdate} onChange={(v) => setForm(f => ({ ...f, birthdate: v }))} onBlur={() => save('birthdate', form.birthdate)} />
        <Field label="연락처" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} onBlur={() => save('phone', form.phone)} placeholder="010-0000-0000" copyable />
        <Field label="이메일" value={form.email_personal} onChange={(v) => setForm(f => ({ ...f, email_personal: v }))} onBlur={() => save('email_personal', form.email_personal)} placeholder="example@email.com" copyable />
      </div>
    </SectionCard>
  )
}

// ── 병역사항 ──────────────────────────────────────────────
function MilitarySection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: profile } = useProfile()
  const { mutate: update } = useUpdateProfile()
  const { saved, show } = useSaved()
  const init = { military_branch: '', military_type: '', military_start: '', military_end: '', military_unit: '' }
  const [form, setForm] = useState(init)
  const [loaded, setLoaded] = useState(false)

  if (profile && !loaded) {
    setForm({
      military_branch: profile.military_branch ?? '', military_type: profile.military_type ?? '',
      military_start: profile.military_start ?? '', military_end: profile.military_end ?? '',
      military_unit: profile.military_unit ?? '',
    })
    setLoaded(true)
  }

  const isMale = profile?.gender === 'MALE'
  const save = (key: string, val: string) => update({ [key]: val || null } as any, { onSuccess: show })

  return (
    <SectionCard id="military" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      {!isMale
        ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <span className="text-2xl">🪖</span>
            <p className="text-xs text-text-quaternary text-center">기본 인적사항에서 성별을 <span className="text-text-tertiary">남성</span>으로 설정하면 입력할 수 있어요</p>
          </div>
        )
        : (
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="군별" value={form.military_branch} onChange={(v) => { setForm(f => ({ ...f, military_branch: v })); save('military_branch', v) }} options={MILITARY_BRANCHES} />
            <SelectField label="전역 구분" value={form.military_type} onChange={(v) => { setForm(f => ({ ...f, military_type: v })); save('military_type', v) }} options={MILITARY_TYPES} />
            <Field label="입대일" type="date" value={form.military_start} onChange={(v) => setForm(f => ({ ...f, military_start: v }))} onBlur={() => save('military_start', form.military_start)} />
            <Field label="전역일" type="date" value={form.military_end} onChange={(v) => setForm(f => ({ ...f, military_end: v }))} onBlur={() => save('military_end', form.military_end)} />
            <Field label="병과" value={form.military_unit} onChange={(v) => setForm(f => ({ ...f, military_unit: v }))} onBlur={() => save('military_unit', form.military_unit)} placeholder="보병, 통신 등" span />
          </div>
        )
      }
    </SectionCard>
  )
}

// ── 어학 자격증 ───────────────────────────────────────────
function LangCertsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [] } = useLangCerts()
  const { mutate: create } = useCreateLangCert()
  const { mutate: update } = useUpdateLangCert()
  const { mutate: remove } = useDeleteLangCert()
  const [modal, setModal] = useState<null | 'add' | LanguageCert>(null)
  const [deleteTarget, setDeleteTarget] = useState<LanguageCert | null>(null)
  const emptyForm = { cert_type: '', score_grade: '', issuer: '', cert_number: '', acquired_at: '', file_url: '' }
  const [form, setForm] = useState(emptyForm)

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (item: LanguageCert) => { setForm({ cert_type: item.cert_type, score_grade: item.score_grade ?? '', issuer: item.issuer ?? '', cert_number: item.cert_number ?? '', acquired_at: item.acquired_at ?? '', file_url: item.file_url ?? '' }); setModal(item) }
  const handleSave = () => {
    if (modal === 'add') create(form as any)
    else if (modal && typeof modal === 'object') update({ id: modal.id, dto: form as any })
    setModal(null)
  }

  return (
    <SectionCard id="language-certs" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {items.map((item) => (
          <ExpandableItem
            key={item.id}
            title={item.cert_type}
            subtitle={[item.score_grade, item.acquired_at].filter(Boolean).join(' · ')}
            badge={item.file_url ? '파일첨부' : undefined}
            onEdit={() => openEdit(item)}
            onDelete={() => setDeleteTarget(item)}
          >
            <DetailRow label="종류" value={item.cert_type} />
            <DetailRow label="점수·등급" value={item.score_grade} />
            <DetailRow label="발급기관" value={item.issuer} />
            <DetailRow label="자격증번호" value={item.cert_number} />
            <DetailRow label="취득일" value={item.acquired_at} />
            {item.file_url && (
              <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-brand hover:underline">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 8V9.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                첨부 파일 보기
              </a>
            )}
          </ExpandableItem>
        ))}
        <AddButton onClick={openAdd} label="어학 자격증 추가" />
      </div>
      {modal && (
        <Modal title={modal === 'add' ? '어학 자격증 추가' : '어학 자격증 편집'} onClose={() => setModal(null)} onSave={handleSave}>
          <SelectField label="종류" value={form.cert_type} onChange={(v) => setForm(f => ({ ...f, cert_type: v }))} options={LANG_CERT_TYPES} />
          <Field label="점수·등급" value={form.score_grade} onChange={(v) => setForm(f => ({ ...f, score_grade: v }))} placeholder="990 / 1+" />
          <Field label="발급기관" value={form.issuer} onChange={(v) => setForm(f => ({ ...f, issuer: v }))} placeholder="ETS" />
          <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} />
          <Field label="취득일" type="date" value={form.acquired_at} onChange={(v) => setForm(f => ({ ...f, acquired_at: v }))} />
          <FileUpload value={form.file_url} scope="myinfo/language-cert" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} onRemove={() => setForm(f => ({ ...f, file_url: '' }))} />
        </Modal>
      )}
      {deleteTarget && <DeleteModal label={deleteTarget.cert_type} onClose={() => setDeleteTarget(null)} onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null) }} />}
    </SectionCard>
  )
}

// ── 자격증 ────────────────────────────────────────────────
function CertsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [] } = useCerts()
  const { mutate: create } = useCreateCert()
  const { mutate: update } = useUpdateCert()
  const { mutate: remove } = useDeleteCert()
  const [modal, setModal] = useState<null | 'add' | Cert>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cert | null>(null)
  const emptyForm = { name: '', issuer: '', cert_number: '', acquired_at: '', file_url: '' }
  const [form, setForm] = useState(emptyForm)

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (item: Cert) => { setForm({ name: item.name, issuer: item.issuer ?? '', cert_number: item.cert_number ?? '', acquired_at: item.acquired_at ?? '', file_url: item.file_url ?? '' }); setModal(item) }
  const handleSave = () => {
    if (modal === 'add') create(form as any)
    else if (modal && typeof modal === 'object') update({ id: modal.id, dto: form as any })
    setModal(null)
  }

  return (
    <SectionCard id="certs" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {items.map((item) => (
          <ExpandableItem key={item.id} title={item.name} subtitle={[item.issuer, item.acquired_at].filter(Boolean).join(' · ')} badge={item.file_url ? '파일첨부' : undefined} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)}>
            <DetailRow label="자격증명" value={item.name} />
            <DetailRow label="발급기관" value={item.issuer} />
            <DetailRow label="자격증번호" value={item.cert_number} />
            <DetailRow label="취득일" value={item.acquired_at} />
            {item.file_url && (
              <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-brand hover:underline">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 8V9.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                첨부 파일 보기
              </a>
            )}
          </ExpandableItem>
        ))}
        <AddButton onClick={openAdd} label="자격증 추가" />
      </div>
      {modal && (
        <Modal title={modal === 'add' ? '자격증 추가' : '자격증 편집'} onClose={() => setModal(null)} onSave={handleSave}>
          <Field label="자격증명" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="정보처리기사" />
          <Field label="발급기관" value={form.issuer} onChange={(v) => setForm(f => ({ ...f, issuer: v }))} placeholder="한국산업인력공단" />
          <Field label="자격증번호" value={form.cert_number} onChange={(v) => setForm(f => ({ ...f, cert_number: v }))} />
          <Field label="취득일" type="date" value={form.acquired_at} onChange={(v) => setForm(f => ({ ...f, acquired_at: v }))} />
          <FileUpload value={form.file_url} scope="myinfo/cert" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} onRemove={() => setForm(f => ({ ...f, file_url: '' }))} />
        </Modal>
      )}
      {deleteTarget && <DeleteModal label={deleteTarget.name} onClose={() => setDeleteTarget(null)} onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null) }} />}
    </SectionCard>
  )
}

// ── 수상 내역 ─────────────────────────────────────────────
function AwardsSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [] } = useAwards()
  const { mutate: create } = useCreateAward()
  const { mutate: update } = useUpdateAward()
  const { mutate: remove } = useDeleteAward()
  const [modal, setModal] = useState<null | 'add' | Award>(null)
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null)
  const emptyForm = { contest_name: '', award_name: '', org: '', awarded_at: '', content: '', file_url: '' }
  const [form, setForm] = useState(emptyForm)

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (item: Award) => { setForm({ contest_name: item.contest_name, award_name: item.award_name ?? '', org: item.org ?? '', awarded_at: item.awarded_at ?? '', content: item.content ?? '', file_url: item.file_url ?? '' }); setModal(item) }
  const handleSave = () => {
    if (modal === 'add') create(form as any)
    else if (modal && typeof modal === 'object') update({ id: modal.id, dto: form as any })
    setModal(null)
  }

  return (
    <SectionCard id="awards" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {items.map((item) => (
          <ExpandableItem key={item.id} title={item.contest_name} subtitle={[item.award_name, item.awarded_at].filter(Boolean).join(' · ')} badge={item.file_url ? '파일첨부' : undefined} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)}>
            <DetailRow label="대회명" value={item.contest_name} />
            <DetailRow label="수상명" value={item.award_name} />
            <DetailRow label="수여기관" value={item.org} />
            <DetailRow label="수상일자" value={item.awarded_at} />
            {item.content && <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-line">{item.content}</p>}
            {item.file_url && (
              <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-brand hover:underline">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 8V9.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                첨부 파일 보기
              </a>
            )}
          </ExpandableItem>
        ))}
        <AddButton onClick={openAdd} label="수상 내역 추가" />
      </div>
      {modal && (
        <Modal title={modal === 'add' ? '수상 내역 추가' : '수상 내역 편집'} onClose={() => setModal(null)} onSave={handleSave}>
          <Field label="대회명" value={form.contest_name} onChange={(v) => setForm(f => ({ ...f, contest_name: v }))} placeholder="교내 프로그래밍 대회" />
          <Field label="수상명" value={form.award_name} onChange={(v) => setForm(f => ({ ...f, award_name: v }))} placeholder="대상" />
          <Field label="수여기관" value={form.org} onChange={(v) => setForm(f => ({ ...f, org: v }))} />
          <Field label="수상일자" type="date" value={form.awarded_at} onChange={(v) => setForm(f => ({ ...f, awarded_at: v }))} />
          <Field label="수상내용 (200자)" value={form.content} onChange={(v) => setForm(f => ({ ...f, content: v }))} maxLength={200} as="textarea" placeholder="수상 내용을 간략히 적어주세요" />
          <FileUpload value={form.file_url} scope="myinfo/award" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} onRemove={() => setForm(f => ({ ...f, file_url: '' }))} />
        </Modal>
      )}
      {deleteTarget && <DeleteModal label={deleteTarget.contest_name} onClose={() => setDeleteTarget(null)} onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null) }} />}
    </SectionCard>
  )
}

// ── 경험 ──────────────────────────────────────────────────
function ExperiencesSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: items = [] } = useExperiences()
  const { mutate: create } = useCreateExperience()
  const { mutate: update } = useUpdateExperience()
  const { mutate: remove } = useDeleteExperience()
  const [modal, setModal] = useState<null | 'add' | Experience>(null)
  const [deleteTarget, setDeleteTarget] = useState<Experience | null>(null)
  const emptyForm = { activity_name: '', org: '', start_at: '', end_at: '', content: '' }
  const [form, setForm] = useState(emptyForm)

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (item: Experience) => { setForm({ activity_name: item.activity_name, org: item.org ?? '', start_at: item.start_at ?? '', end_at: item.end_at ?? '', content: item.content ?? '' }); setModal(item) }
  const handleSave = () => {
    if (modal === 'add') create(form as any)
    else if (modal && typeof modal === 'object') update({ id: modal.id, dto: form as any })
    setModal(null)
  }

  return (
    <SectionCard id="experiences" sectionRef={sectionRef} isActive={isActive}>
      <div className="space-y-2">
        {items.map((item) => (
          <ExpandableItem key={item.id} title={item.activity_name} subtitle={[item.org, item.start_at ? `${item.start_at.slice(0, 7)} ~` : ''].filter(Boolean).join(' · ')} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)}>
            <DetailRow label="활동명" value={item.activity_name} />
            <DetailRow label="기관" value={item.org} />
            <DetailRow label="기간" value={[item.start_at?.slice(0, 7), item.end_at?.slice(0, 7)].filter(Boolean).join(' ~ ')} />
            {item.content && <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-line">{item.content}</p>}
          </ExpandableItem>
        ))}
        <AddButton onClick={openAdd} label="경험 추가" />
      </div>
      {modal && (
        <Modal title={modal === 'add' ? '경험 추가' : '경험 편집'} onClose={() => setModal(null)} onSave={handleSave}>
          <Field label="활동명" value={form.activity_name} onChange={(v) => setForm(f => ({ ...f, activity_name: v }))} placeholder="교내 개발 동아리" />
          <Field label="활동기관" value={form.org} onChange={(v) => setForm(f => ({ ...f, org: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일" type="date" value={form.start_at} onChange={(v) => setForm(f => ({ ...f, start_at: v }))} />
            <Field label="종료일" type="date" value={form.end_at} onChange={(v) => setForm(f => ({ ...f, end_at: v }))} />
          </div>
          <Field label="활동내용 (500자)" value={form.content} onChange={(v) => setForm(f => ({ ...f, content: v }))} maxLength={500} as="textarea" placeholder="어떤 역할을 했는지 적어주세요" />
        </Modal>
      )}
      {deleteTarget && <DeleteModal label={deleteTarget.activity_name} onClose={() => setDeleteTarget(null)} onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null) }} />}
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

  const persist = (list: string[]) => {
    update({ goal_other: list.join('\n') } as any, { onSuccess: show })
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
          <div key={i} className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/8 bg-[#111213]">
            <span className="w-1.5 h-1.5 rounded-full bg-danger/60 flex-none mt-px" />
            <span className="flex-1 text-xs text-text-primary">{goal}</span>
            <button onClick={() => removeGoal(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-quaternary hover:text-danger">
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
              className="flex-1 bg-[#111213] border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-quaternary"
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
  { key: 'personality_strength', label: '성격 장점', placeholder: '나의 성격 장점을 구체적인 사례와 함께...' },
  { key: 'personality_weakness', label: '성격 단점', placeholder: '단점과 함께 극복 노력을...' },
  { key: 'background', label: '성장 배경', placeholder: '나를 형성한 경험이나 환경...' },
  { key: 'job_competency', label: '직무 역량·핵심 경험', placeholder: '지원 직무와 연결되는 핵심 역량...' },
  { key: 'aspiration', label: '입사 후 포부', placeholder: '입사 후 이루고 싶은 목표...' },
  { key: 'own_strength', label: '나만의 강점', placeholder: '다른 지원자와 차별화되는 나만의 강점...' },
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
  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CoverletterCustom | null>(null)

  if (data && !loaded) {
    const init: Record<string, string> = {}
    COVER_FIELDS.forEach(({ key }) => { init[key] = (data.coverletter as any)?.[key] ?? '' })
    setClForm(init)
    setLoaded(true)
  }

  const saveCover = (key: string, val: string) =>
    updateCover({ [key]: val || null } as any, { onSuccess: show })

  const handleAddCustom = () => {
    if (!newLabel.trim()) return
    createCustom({ label: newLabel.trim(), order_index: data?.custom.length ?? 0 })
    setNewLabel(''); setAddingLabel(false)
  }

  return (
    <SectionCard id="coverletter" sectionRef={sectionRef} saved={saved} isActive={isActive}>
      <div className="space-y-5">
        {COVER_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-secondary">{label}</label>
              <CopyButton value={clForm[key]} />
            </div>
            <textarea
              value={clForm[key] ?? ''}
              onChange={(e) => setClForm(f => ({ ...f, [key]: e.target.value }))}
              onBlur={() => saveCover(key, clForm[key] ?? '')}
              maxLength={2000}
              rows={3}
              placeholder={placeholder}
              className="w-full bg-[#111213] border border-white/10 rounded-xl px-4 py-3 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/15 resize-none transition-all"
            />
            <p className="text-[10px] text-text-quaternary text-right mt-1">{(clForm[key] ?? '').length} / 2000</p>
          </div>
        ))}

        {/* 커스텀 항목들 */}
        {(data?.custom ?? []).map((item) => (
          <CustomCoverItem
            key={item.id}
            item={item}
            onUpdate={(content) => updateCustom({ id: item.id, dto: { content } }, { onSuccess: show })}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}

        {/* 항목 추가 */}
        {addingLabel ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddCustom(); if (e.key === 'Escape') setAddingLabel(false) }}
              placeholder="항목명 입력 (예: 해외 경험)"
              className="flex-1 bg-[#111213] border border-brand/40 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none ring-1 ring-brand/15 placeholder:text-text-quaternary"
            />
            <button onClick={() => setAddingLabel(false)} className="text-xs text-text-quaternary px-2 hover:text-text-secondary">취소</button>
          </div>
        ) : (
          <button onClick={() => setAddingLabel(true)} className="w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-white/10 hover:border-brand/30 rounded-xl py-3 transition-all flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            항목 직접 추가
          </button>
        )}
      </div>

      {deleteTarget && <DeleteModal label={deleteTarget.label} onClose={() => setDeleteTarget(null)} onConfirm={() => { deleteCustom(deleteTarget.id); setDeleteTarget(null) }} />}
    </SectionCard>
  )
}

function CustomCoverItem({ item, onUpdate, onDelete }: { item: CoverletterCustom; onUpdate: (c: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(item.content ?? '')
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-text-secondary">{item.label}</label>
        <div className="flex items-center gap-1">
          <CopyButton value={value} />
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-text-quaternary hover:text-danger rounded-md hover:bg-danger/8 transition-colors">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onUpdate(value)}
        maxLength={2000}
        rows={3}
        placeholder={`${item.label}을 작성해보세요`}
        className="w-full bg-[#111213] border border-white/10 rounded-xl px-4 py-3 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/15 resize-none transition-all"
      />
      <p className="text-[10px] text-text-quaternary text-right mt-1">{value.length} / 2000</p>
    </div>
  )
}

// ── 파일 보관함 ───────────────────────────────────────────
const DOC_CATEGORIES = ['이력서', '포트폴리오', '성적증명서', '졸업증명서', '자기소개서', '기타(직접입력)']

function FilesSection({ sectionRef, isActive }: { sectionRef: (el: HTMLElement | null) => void; isActive?: boolean }) {
  const { data: langCerts = [] } = useLangCerts()
  const { data: certs = [] } = useCerts()
  const { data: awards = [] } = useAwards()
  const { data: documents = [] } = useDocuments()
  const { mutate: createDoc } = useCreateDocument()
  const { mutate: deleteDoc } = useDeleteDocument()

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MyDocument | null>(null)

  // 기존 섹션에서 올라간 파일 집계
  const existingFiles = [
    ...langCerts.filter(i => i.file_url).map(i => ({ label: i.cert_type, source: '어학 자격증', file_url: i.file_url! })),
    ...certs.filter(i => i.file_url).map(i => ({ label: i.name, source: '자격증', file_url: i.file_url! })),
    ...awards.filter(i => i.file_url).map(i => ({ label: i.contest_name, source: '수상 내역', file_url: i.file_url! })),
  ]

  const SOURCE_STYLE: Record<string, string> = {
    '어학 자격증': 'bg-success/12 text-success',
    '자격증':     'bg-brand/12 text-brand',
    '수상 내역':   'bg-warning/12 text-warning',
  }

  const handleSave = () => {
    if (!title.trim() || !fileUrl) return
    const finalCategory = category === '기타(직접입력)' ? customCategory.trim() : category
    createDoc({ title: title.trim(), category: finalCategory || undefined, file_url: fileUrl })
    setShowUpload(false)
    setTitle(''); setCategory(''); setCustomCategory(''); setFileUrl('')
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
            <p className="text-[11px] text-text-quaternary font-semibold mb-2">자격증 · 수상 내역에서 등록한 파일</p>
            <div className="space-y-1.5">
              {existingFiles.map((f, i) => (
                <a
                  key={i}
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/8 bg-[#111213] hover:border-white/16 hover:bg-[#161718] transition-all group"
                >
                  <FileIcon url={f.file_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate group-hover:text-brand transition-colors">{f.label}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-none ${SOURCE_STYLE[f.source] ?? 'bg-white/8 text-text-tertiary'}`}>{f.source}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-quaternary flex-none group-hover:text-brand transition-colors">
                    <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 구분선 */}
        {existingFiles.length > 0 && (
          <div className="border-t border-white/6" />
        )}

        {/* 직접 올린 파일들 */}
        <div>
          {existingFiles.length > 0 && (
            <p className="text-[11px] text-text-quaternary font-semibold mb-2">직접 올린 파일</p>
          )}
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div key={doc.id} className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/8 bg-[#111213] hover:border-white/16 transition-all">
                <FileIcon url={doc.file_url} />
                <div className="flex-1 min-w-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-text-primary hover:text-brand transition-colors truncate block">{doc.title}</a>
                  {doc.category && <p className="text-[10px] text-text-quaternary mt-0.5">{doc.category}</p>}
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-quaternary flex-none">
                  <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <button
                  onClick={() => setDeleteTarget(doc)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-quaternary hover:text-danger w-6 h-6 flex items-center justify-center rounded"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>

          {/* 업로드 폼 */}
          {showUpload ? (
            <div className="mt-3 p-4 rounded-xl border border-brand/30 bg-brand/4 space-y-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5 font-medium">파일 제목</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2025 토익 성적표, 개인 포트폴리오"
                  className="w-full bg-[#111213] border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5 font-medium">카테고리 (선택)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#111213] border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/50 transition-all appearance-none"
                >
                  <option value="">선택 안함</option>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {category === '기타(직접입력)' && (
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="카테고리 직접 입력"
                    className="mt-2 w-full bg-[#111213] border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 transition-all"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1.5 font-medium">파일</label>
                <FileUpload
                  value={fileUrl}
                  scope="documents"
                  onUploaded={setFileUrl}
                  onRemove={() => setFileUrl('')}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowUpload(false); setTitle(''); setCategory(''); setCustomCategory(''); setFileUrl('') }} className="flex-1 py-2 text-xs text-text-secondary border border-white/10 rounded-lg hover:bg-white/5 transition-colors">취소</button>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || !fileUrl}
                  className="flex-1 py-2 text-xs font-semibold bg-brand hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-1.5 w-full text-xs text-text-quaternary hover:text-brand border border-dashed border-white/10 hover:border-brand/30 rounded-xl py-3 transition-all flex items-center justify-center gap-1.5"
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
    </SectionCard>
  )
}
