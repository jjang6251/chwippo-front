import { useRef, useState } from 'react'
import { deleteOwnFile } from '@/api/files'
import { toast } from '@/stores/toastStore'
import type { FileSlot } from '@/utils/fileSlot'

/** 바이트 → "1.2MB" / "340KB" 식 사람 친화 포맷 */
function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

interface FileUploadProps {
  slot: FileSlot
  /** 저장 시점에 부모가 resolveFileForSubmit(slot, scope)로 사용. FileUpload 내부에선 직접 PUT 안 함. */
  scope: string
  onChange: (slot: FileSlot) => void
  hint?: string
  /** true면 X 버튼·파일 추가 버튼 비활성화 (저장 중 등) */
  disabled?: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

/**
 * 지연 업로드 패턴.
 * - empty/pending 상태에서 X·취소·페이지 이탈은 R2에 아무 영향 없음 (아직 PUT 전).
 * - existing 상태(이미 DB에 저장된 파일) X는 확인 모달 + deleteOwnFile 즉시 호출 (기존 동작).
 * - 부모(폼)는 저장 시점에 resolveFileForSubmit(slot)으로 R2 PUT을 발동.
 */
export function FileUpload({ slot, scope: _scope, onChange, hint, disabled }: FileUploadProps) {
  void _scope
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmingExistingRemove, setConfirmingExistingRemove] = useState(false)

  const handlePick = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('PDF, JPG, PNG 파일만 업로드 가능합니다.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('파일 크기는 10MB 이하여야 합니다.')
      return
    }
    if (file.size <= 0) {
      toast.error('빈 파일은 업로드할 수 없습니다.')
      return
    }
    onChange({ kind: 'pending', file })
  }

  // ── pending: 파일 선택됨, 아직 업로드 전 ──────────────────
  if (slot.kind === 'pending') {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-surface-2 border border-line rounded-lg">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-tertiary flex-none">
          <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 5.5h4M5 8h4M5 10.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-xs text-text-secondary truncate flex-1">
          {slot.file.name}
        </span>
        <span className="text-[10px] text-text-quaternary flex-none">
          {formatFileSize(slot.file.size)} · 저장 시 업로드
        </span>
        <button
          onClick={() => onChange({ kind: 'empty' })}
          aria-label="선택한 파일 취소"
          disabled={disabled}
          className="flex-none w-8 h-8 flex items-center justify-center -mr-1.5 text-text-quaternary hover:text-danger transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    )
  }

  // ── existing: 이미 R2에 있는 파일 (편집 모드) ────────────
  if (slot.kind === 'existing') {
    const isPdf = slot.url.toLowerCase().includes('.pdf')
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-surface-2 border border-line rounded-lg">
        {isPdf ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-danger flex-none">
            <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 5.5h4M5 8h4M5 10.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-brand flex-none">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 11l4-3 3 2.5 2.5-2L15 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
        <a
          href={slot.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-secondary hover:text-brand truncate flex-1 transition-colors"
        >
          파일 보기 ↗
        </a>
        {slot.size != null && slot.size > 0 && (
          <span className="text-[10px] text-text-quaternary flex-none">
            {formatFileSize(slot.size)}
          </span>
        )}
        <button
          onClick={() => setConfirmingExistingRemove(true)}
          aria-label="첨부 파일 제거"
          disabled={disabled}
          className="flex-none w-8 h-8 flex items-center justify-center -mr-1.5 text-text-quaternary hover:text-danger transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {confirmingExistingRemove && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmingExistingRemove(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="파일 첨부 해제 확인"
              className="bg-surface border border-line rounded-xl w-full max-w-xs p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-sm text-text-primary font-medium">첨부 파일을 제거하시겠습니까?</p>
                <p className="text-xs text-text-tertiary mt-1.5 leading-relaxed">
                  제거하면 즉시 삭제되며 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingExistingRemove(false)}
                  className="flex-1 py-2 text-xs text-text-secondary border border-line rounded-lg hover:bg-card active:bg-card-strong transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    setConfirmingExistingRemove(false)
                    void deleteOwnFile(slot.url).catch(() => {
                      /* best-effort */
                    })
                    onChange({ kind: 'empty' })
                  }}
                  className="flex-1 py-2 text-xs font-semibold bg-danger/15 text-danger hover:bg-danger/25 rounded-lg transition-colors"
                >
                  제거
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── empty: 비어있음, 파일 첨부 버튼 ────────────────────────
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handlePick(e.target.files[0])
          // 같은 파일 재선택 가능하도록 reset
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="mt-2 flex items-center gap-1.5 text-xs text-text-quaternary hover:text-text-secondary border border-dashed border-line hover:border-line-strong rounded-lg px-3 py-2 w-full transition-colors disabled:opacity-50"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1v7M3 4l3-3 3 3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M1 9v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V9"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        파일 첨부 (PDF / JPG / PNG, 10MB 이하)
      </button>
      {hint && <p className="text-[11px] text-text-quaternary mt-1.5 pl-1">{hint}</p>}
    </>
  )
}
