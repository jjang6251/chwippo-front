/**
 * 「지원 서류」 — 고정 슬롯 4종 + 항목에서 첨부한 서류 + 기타 파일.
 *
 * 왜 자유 업로드가 아니라 자리를 미리 만드나: 실측 11곳 중 5곳이 파일을 요구하는데
 * (`company/01_product/autofill-census-2026-09.md`) **요구하는 종류가 거의 같다**
 * — 증명사진 · 이력서 · 포트폴리오 · 경력기술서.
 * 자리를 비워 두면 「무엇을 올려야 하나」를 사용자가 매번 다시 판단한다.
 *
 * 🔴 **항목이 있는 서류는 슬롯이 아니라 항목에 붙는다** (CEO 2026-09-05). 어학 성적표는
 * 어학 항목, 성적·졸업증명서는 학력 항목이 원본이다. 그래도 「내 서류 어디 있지」는 한 자리에서
 * 답해야 하므로, 항목에 붙은 파일을 **읽기 전용 목록**으로 여기 모아 보여준다 — 저장은 한 군데,
 * 보이는 곳은 두 군데. 고치려면 [항목으로] 가 원본 자리로 데려간다.
 *
 * 규칙(형식·크기)은 **파일을 고르기 전에** 보여주고, 어긋나면 업로드 전에 막는다 —
 * R2 에 올린 뒤 서버가 400 을 주면 고아 파일과 낭비된 대기 시간만 남는다.
 *
 * 프레임(`SectionCard`)은 `MyInfo.tsx` 가 씌운다 — 여기는 본문만 그린다.
 */
import { useId, useRef, useState } from 'react'
import { uploadFile } from '@/api/files'
import type { DocumentSlot, MyDocument } from '@/api/myinfo'
import { HelpPill } from '@/components/common/HelpPill'
import { Modal } from '@/components/common/Modal'
import { SegmentedToggle } from '@/components/common/SegmentedToggle'
import {
  useAwards, useCerts, useDeleteDocument, useDocuments, useEducations, useLangCerts,
  usePutDocumentSlot, useUpdateAward, useUpdateCert, useUpdateEducation, useUpdateLangCert,
} from '@/hooks/useMyinfo'
import { toast } from '@/stores/toastStore'
import { toLocalDateString } from '@/utils/datetime'
import {
  SLOT_SPECS, formatBytes, maxLabel, validateSlotFile, type SlotSpec,
} from '@/utils/documentSlots'
import {
  clearFileBySource, type EducationFileField, type FileSourceKind,
} from '@/utils/myinfoFileActions'

/** 업로드 scope — 기존 「파일 보관함」과 같은 통을 쓴다 (저장용량 집계가 하나여야 한다) */
const UPLOAD_SCOPE = 'myinfo/document'

/** 인터셉터가 이미 서버 문구를 띄웠으면 덮어쓰지 않는다 (서버 문구 우선) */
function notifySaveError(err: unknown, fallback = '저장에 실패했어요.') {
  const shown = (err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown
  if (!shown) toast.error(fallback)
}

// ────────────────────────────────────────────────────────────
/**
 * 항목(어학·학력·자격증·수상)에 붙은 파일 한 건 — 원본 파일명이 없으므로
 * 「{항목 라벨} · {종류}」로 스스로를 설명한다.
 */
interface AttachedFile {
  /** 같은 항목이 파일을 둘 이상 가질 수 있어 (학력) id 만으로는 안 된다 */
  key: string
  itemId: string
  itemLabel: string
  kind: string
  /** 원본을 고치러 갈 곳 */
  sectionId: string
  source: FileSourceKind
  educationField?: EducationFileField
  /** 데모는 메타만 있고 실제 파일이 없다 — 그때는 [열기] 를 감춘다 */
  url: string | null
  size: number | null
  suggestedName: string | null
}

interface AttachedInput {
  educations: { id: string; school_name: string; file_url?: string; file_size_bytes?: number | null
    transcript_file_url?: string | null; transcript_file_size_bytes?: number | null
    graduation_file_url?: string | null; graduation_file_size_bytes?: number | null
    transcript_suggested_file_name?: string | null; graduation_suggested_file_name?: string | null }[]
  langCerts: { id: string; cert_type: string; file_url?: string; file_size_bytes?: number | null; suggested_file_name?: string | null }[]
  certs: { id: string; name: string; file_url?: string; file_size_bytes?: number | null; suggested_file_name?: string | null }[]
  awards: { id: string; contest_name: string; file_url?: string; file_size_bytes?: number | null; suggested_file_name?: string | null }[]
}

/** url 이 없어도 크기 메타만 있으면 「자리는 찼다」 — 데모가 그 상태다 */
const attachedExists = (url?: string | null, size?: number | null) => !!url || !!size

function collectAttachedFiles(input: AttachedInput): AttachedFile[] {
  const rows: AttachedFile[] = []

  for (const c of input.langCerts) {
    if (!attachedExists(c.file_url, c.file_size_bytes)) continue
    rows.push({
      key: `lang-${c.id}`, itemId: c.id, itemLabel: c.cert_type, kind: '성적표',
      sectionId: 'language-certs', source: '어학 자격증',
      url: c.file_url ?? null, size: c.file_size_bytes ?? null,
      suggestedName: c.suggested_file_name ?? null,
    })
  }

  for (const e of input.educations) {
    if (attachedExists(e.transcript_file_url, e.transcript_file_size_bytes)) {
      rows.push({
        key: `edu-${e.id}-transcript`, itemId: e.id, itemLabel: e.school_name, kind: '성적증명서',
        sectionId: 'education', source: '학력', educationField: 'transcript',
        url: e.transcript_file_url ?? null, size: e.transcript_file_size_bytes ?? null,
        suggestedName: e.transcript_suggested_file_name ?? null,
      })
    }
    if (attachedExists(e.graduation_file_url, e.graduation_file_size_bytes)) {
      rows.push({
        key: `edu-${e.id}-graduation`, itemId: e.id, itemLabel: e.school_name, kind: '졸업(예정)증명서',
        sectionId: 'education', source: '학력', educationField: 'graduation',
        url: e.graduation_file_url ?? null, size: e.graduation_file_size_bytes ?? null,
        suggestedName: e.graduation_suggested_file_name ?? null,
      })
    }
    // 옛 데이터 — 새로 올릴 수는 없고 여기서 열어 보고 지우기만 된다
    if (attachedExists(e.file_url, e.file_size_bytes)) {
      rows.push({
        key: `edu-${e.id}-legacy`, itemId: e.id, itemLabel: e.school_name, kind: '기타 증빙',
        sectionId: 'education', source: '학력', educationField: 'legacy',
        url: e.file_url ?? null, size: e.file_size_bytes ?? null, suggestedName: null,
      })
    }
  }

  for (const c of input.certs) {
    if (!attachedExists(c.file_url, c.file_size_bytes)) continue
    rows.push({
      key: `cert-${c.id}`, itemId: c.id, itemLabel: c.name, kind: '자격증',
      sectionId: 'certs', source: '자격증',
      url: c.file_url ?? null, size: c.file_size_bytes ?? null,
      suggestedName: c.suggested_file_name ?? null,
    })
  }

  for (const a of input.awards) {
    if (!attachedExists(a.file_url, a.file_size_bytes)) continue
    rows.push({
      key: `award-${a.id}`, itemId: a.id, itemLabel: a.contest_name, kind: '상장',
      sectionId: 'awards', source: '수상 내역',
      url: a.file_url ?? null, size: a.file_size_bytes ?? null,
      suggestedName: a.suggested_file_name ?? null,
    })
  }

  return rows
}

interface BodyProps {
  /** 원본 항목 자리로 데려간다 (해당 섹션을 펴고 스크롤) */
  onJump: (sectionId: string) => void
  children?: React.ReactNode
}

export function DocumentSlotsBody({ onJump, children }: BodyProps) {
  const { data: documents = [], isLoading: docsLoading, isError: docsError } = useDocuments()
  const { data: langCerts = [] } = useLangCerts()
  const { data: educations = [] } = useEducations()
  const { data: certs = [] } = useCerts()
  const { data: awards = [] } = useAwards()
  const { mutateAsync: putSlot } = usePutDocumentSlot()
  const { mutate: deleteDoc } = useDeleteDocument()
  const { mutate: updateEducation } = useUpdateEducation()
  const { mutate: updateLangCert } = useUpdateLangCert()
  const { mutate: updateCert } = useUpdateCert()
  const { mutate: updateAward } = useUpdateAward()

  const [busySlot, setBusySlot] = useState<DocumentSlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyDocument | null>(null)
  const [attachedTarget, setAttachedTarget] = useState<AttachedFile | null>(null)
  /** 업로드 전 차단에 걸린 자리와 이유 — 그 행 안에 남는다 */
  const [slotError, setSlotError] = useState<{ slot: DocumentSlot; message: string } | null>(null)
  const nameHelpId = useId()

  const bySlot = new Map<DocumentSlot, MyDocument>()
  for (const d of documents) if (d.slot) bySlot.set(d.slot, d)

  const attached = collectAttachedFiles({ educations, langCerts, certs, awards })

  const upload = async (spec: SlotSpec, file: File) => {
    const problem = validateSlotFile(spec, file)
    if (problem) {
      // 🔴 토스트는 5초 뒤 사라진다 — 어느 자리가 왜 막혔는지는 그 행에 남아 있어야 한다
      toast.error(problem)
      setSlotError({ slot: spec.slot, message: problem })
      return
    }
    setSlotError(null)
    setBusySlot(spec.slot)
    try {
      const { fileUrl, fileSize } = await uploadFile(UPLOAD_SCOPE, file)
      await putSlot({
        slot: spec.slot,
        dto: { fileUrl, fileSize, originalName: file.name, mime: file.type },
      })
    } catch (err) {
      notifySaveError(err)
    } finally {
      setBusySlot(null)
    }
  }

  const saveLink = async (spec: SlotSpec, linkUrl: string) => {
    setBusySlot(spec.slot)
    try {
      await putSlot({ slot: spec.slot, dto: { linkUrl } })
    } catch (err) {
      notifySaveError(err)
    } finally {
      setBusySlot(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* 이름의 **실물**은 각 행 첫 줄이 보여준다 — 여기서 예시를 또 들면 같은 말이 두 번이다 */}
      <HelpPill label="이름" id={nameHelpId}>
        파일 이름은 신경 쓰지 마세요 — 지원서엔 아래 이름으로 들어가요
      </HelpPill>

      {/*
        🔴 불러오는 중에 「없어요」를 보여주면 **없다고 읽는다** — 방금 올린 사람이 다시 올린다.
        자리 수(4)와 톤을 그대로 둔 스켈레톤이 「아직 모른다」를 말한다.
      */}
      <div role="group" aria-label="지원 서류 자리" aria-describedby={nameHelpId} className="space-y-1.5">
        {docsError ? (
          <p className="text-[13px] text-text-tertiary">서류를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        ) : docsLoading ? (
          SLOT_SPECS.map((spec) => (
            <div key={spec.slot} className="rounded-xl border border-line bg-card px-4 py-3 animate-pulse">
              <div className="h-4 w-40 rounded bg-card-strong" />
            </div>
          ))
        ) : (
          SLOT_SPECS.map((spec) => (
            <SlotRow
              key={spec.slot}
              spec={spec}
              doc={bySlot.get(spec.slot)}
              busy={busySlot === spec.slot}
              error={slotError?.slot === spec.slot ? slotError.message : undefined}
              onUpload={(file) => void upload(spec, file)}
              onSaveLink={(url) => void saveLink(spec, url)}
              onDelete={(doc) => setDeleteTarget(doc)}
            />
          ))
        )}
      </div>

      <div className="pt-5 border-t border-line">
        <p className="text-[13px] font-bold text-text-primary mb-1">항목에서 첨부한 서류</p>
        <p className="text-sm text-text-tertiary mb-3.5">
          원본은 각 항목에 있어요 — 여기서는 열어 보고 지울 수만 있어요.
        </p>
        {attached.length === 0 ? (
          <p className="text-sm text-text-quaternary">
            어학·학력·자격증·수상 항목에서 파일을 붙이면 여기 모여요
          </p>
        ) : (
          <div className="space-y-1.5">
            {attached.map((file) => (
              <AttachedRow
                key={file.key}
                file={file}
                onOpenItem={() => onJump(file.sectionId)}
                onDelete={() => setAttachedTarget(file)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pt-5 border-t border-line">
        <p className="text-[13px] font-bold text-text-primary mb-1">기타 파일</p>
        <p className="text-sm text-text-tertiary mb-3.5">
          위 자리에도, 항목에도 없는 서류예요.
        </p>
        {children}
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="지원 서류를 삭제할까요?"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-5">
          {deleteTarget?.original_name || deleteTarget?.title}을(를) 삭제하면 되돌릴 수 없어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteTarget) deleteDoc(deleteTarget.id)
              setDeleteTarget(null)
            }}
            className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors"
          >
            삭제
          </button>
        </div>
      </Modal>

      {/* 항목 첨부 삭제 — 파일만 지우고 **항목 row 는 남긴다** */}
      <Modal
        open={!!attachedTarget}
        onClose={() => setAttachedTarget(null)}
        title="첨부 파일을 삭제할까요?"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-5">
          {attachedTarget && `${attachedTarget.itemLabel} · ${attachedTarget.kind}`}을(를) 삭제하면
          되돌릴 수 없어요. 항목 자체는 그대로 남아요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAttachedTarget(null)}
            className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (attachedTarget) {
                clearFileBySource(
                  attachedTarget.source,
                  attachedTarget.itemId,
                  { updateEducation, updateLangCert, updateCert, updateAward },
                  attachedTarget.educationField,
                )
              }
              setAttachedTarget(null)
            }}
            className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors"
          >
            삭제
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
/** 항목에 붙은 파일 한 행 — 올리기·교체가 없다 (원본은 항목 쪽이다) */
function AttachedRow({ file, onOpenItem, onDelete }: {
  file: AttachedFile
  onOpenItem: () => void
  onDelete: () => void
}) {
  const actionClass =
    'min-h-[44px] sm:min-h-[36px] px-3 inline-flex items-center rounded-lg border border-line bg-card text-[13px] font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:bg-card-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg'

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      {/*
        제안 이름이 있으면 그게 주인공이다 — 회사가 받을 이름을 사용자가 궁금해한다.
        학력의 옛 「기타 증빙」은 서버가 이름을 짓지 않으므로 「{항목} · {종류}」가 그대로 첫 줄이다.
      */}
      <div className="flex-1 min-w-0">
        {file.suggestedName ? (
          <>
            {/* 🔴 파일명은 번역되면 안 된다 — 브라우저 번역이 바꿔 놓으면 실제로 받는 이름과 달라진다 */}
            <p translate="no" className="text-[13px] font-medium text-text-primary truncate">
              {file.suggestedName}
            </p>
            <p className="text-[11px] text-text-quaternary mt-0.5 truncate">
              {file.itemLabel} · {file.kind}{file.size ? ` · ${formatBytes(file.size)}` : ''}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-text-primary truncate">
            {file.itemLabel}
            <span className="text-text-quaternary"> · {file.kind}</span>
            {file.size ? <span className="text-text-quaternary"> · {formatBytes(file.size)}</span> : null}
          </p>
        )}
      </div>

      <div className="flex flex-none gap-1.5">
        {file.url && (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${file.itemLabel} ${file.kind} 열기 (새 탭)`}
            className={actionClass}
          >
            열기
          </a>
        )}
        <button
          type="button"
          onClick={onOpenItem}
          aria-label={`${file.itemLabel} ${file.kind} 항목으로`}
          className={actionClass}
        >
          항목으로
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${file.itemLabel} ${file.kind} 삭제`}
          className="min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border border-line bg-card text-[13px] font-medium text-text-tertiary hover:text-danger hover:border-danger/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
interface RowProps {
  spec: SlotSpec
  doc?: MyDocument
  busy: boolean
  /** 업로드 전 차단 사유 — 토스트와 **같은 문장**을 이 행에 남긴다 */
  error?: string
  onUpload: (file: File) => void
  onSaveLink: (url: string) => void
  onDelete: (doc: MyDocument) => void
}

function SlotRow({ spec, doc, busy, error, onUpload, onSaveLink, onDelete }: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  /** 사용자가 세그먼트를 손으로 바꾸기 전에는 **저장된 모습**을 따른다 */
  const [modeOverride, setModeOverride] = useState<'file' | 'link' | null>(null)
  const [linkDraft, setLinkDraft] = useState<string | null>(null)
  const linkNoteId = useId()

  const mode = modeOverride ?? (doc?.link_url ? 'link' : 'file')
  const linkValue = linkDraft ?? doc?.link_url ?? ''
  const openUrl = doc?.link_url || doc?.file_url || ''

  return (
    // 모바일은 세로로 쌓는다 — 320px 에서 라벨·상태·버튼 3단이 한 줄에 들어가지 않는다
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="sm:w-36 flex-none">
        <p className="text-[13px] font-medium text-text-primary">{spec.label}</p>
        <p className="text-[11px] text-text-quaternary mt-0.5">
          {spec.formats} · {maxLabel(spec.maxBytes)} 이하
        </p>
      </div>

      <div className="flex-1 min-w-0">
        {spec.linkable && (
          <SegmentedToggle
            label={`${spec.label} 등록 방식`}
            value={mode}
            options={[{ value: 'file', label: '파일' }, { value: 'link', label: '링크' }] as const}
            onChange={(v) => setModeOverride(v)}
            className="mb-2"
          />
        )}

        {spec.linkable && mode === 'link' ? (
          <div>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkValue}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://…"
                aria-label={`${spec.label} 링크`}
                aria-describedby={spec.linkNote ? linkNoteId : undefined}
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 min-w-0 bg-input border border-line rounded-xl px-4 h-12 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]"
              />
              <button
                type="button"
                disabled={busy || !linkValue.trim()}
                onClick={() => onSaveLink(linkValue.trim())}
                className="flex-none h-12 px-4 rounded-xl bg-brand text-bg text-[13px] font-bold hover:bg-accent active:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                저장
              </button>
            </div>
            {/* 이력서·경력기술서는 파일이 여전히 기본이다 — 링크를 고른 사람에게만 그 사실을 말한다 */}
            {spec.linkNote && <HelpPill label="파일" id={linkNoteId}>{spec.linkNote}</HelpPill>}
          </div>
        ) : doc && (doc.file_url || doc.link_url) ? (
          <div className="min-w-0">
            {doc.suggested_file_name ? (
              <>
                {/* 🔴 파일명은 번역되면 안 된다 — 브라우저 번역이 바꿔 놓으면 실제로 받는 이름과 달라진다 */}
                <p translate="no" className="text-[13px] font-medium text-text-primary truncate">
                  {doc.suggested_file_name}
                </p>
                <p className="text-[11px] text-text-quaternary mt-0.5 truncate">
                  {doc.original_name ? `원본 ${doc.original_name} · ` : ''}
                  {doc.file_size_bytes ? `${formatBytes(doc.file_size_bytes)} · ` : ''}
                  {toLocalDateString(new Date(doc.created_at))}
                </p>
                {/*
                  이름 칸이 비면 서버가 접두를 못 붙인다 — 그때 제안 이름은 `이력서.pdf` 처럼 `_` 없이 시작한다.
                  프로필을 따로 조회하지 않고 **결과물 자체**로 판정한다 (한 화면이 두 곳을 묻지 않는다).
                */}
                {!doc.suggested_file_name.includes('_') && (
                  <HelpPill label="이름">
                    기본 인적사항에 이름을 채우면{' '}
                    <code translate="no" className="font-mono">홍길동_{doc.suggested_file_name}</code>{' '}
                    처럼 붙어요
                  </HelpPill>
                )}
              </>
            ) : (
              <p className="text-[13px] text-text-secondary truncate">
                {doc.original_name || doc.title}
                {doc.file_size_bytes ? (
                  <span className="text-text-quaternary"> · {formatBytes(doc.file_size_bytes)}</span>
                ) : null}
                <span className="text-text-quaternary"> · {toLocalDateString(new Date(doc.created_at))}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary">없어요</p>
        )}

        {spec.note && <p className="text-[11px] text-text-quaternary mt-1">{spec.note}</p>}
        {error && <p role="alert" className="text-[11px] text-danger mt-1">{error}</p>}
      </div>

      {/* 액션 — 링크 모드에서는 [저장] 이 그 자리를 대신한다 */}
      {!(spec.linkable && mode === 'link') && (
        <div className="flex flex-none gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={spec.accept}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            data-testid={`slot-input-${spec.slot}`}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
          {/* 🔴 버튼 4행이 전부 「올리기」면 스크린리더 목록에서 어느 자리인지 알 수 없다 — 삭제와 같은 관례 */}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label={`${spec.label} ${busy ? '올리는 중…' : doc ? '교체' : '올리기'}`}
            className="min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border border-line bg-card text-[13px] font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:bg-card-strong transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            {busy ? '올리는 중…' : doc ? '교체' : '올리기'}
          </button>
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${spec.label} 열기 (새 탭)`}
              className="min-h-[44px] sm:min-h-[36px] px-3 inline-flex items-center rounded-lg border border-line bg-card text-[13px] font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary transition-colors"
            >
              열기
            </a>
          )}
          {doc && (
            <button
              type="button"
              onClick={() => onDelete(doc)}
              aria-label={`${spec.label} 삭제`}
              className="min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border border-line bg-card text-[13px] font-medium text-text-tertiary hover:text-danger hover:border-danger/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              삭제
            </button>
          )}
        </div>
      )}
    </div>
  )
}
