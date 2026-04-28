import { useRef, useState } from 'react'
import { uploadFile } from '@/api/files'

interface FileUploadProps {
  value?: string
  scope: string
  onUploaded: (url: string) => void
  onRemove: () => void
}

export function FileUpload({ value, scope, onUploaded, onRemove }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      alert('PDF, JPG, PNG 파일만 업로드 가능합니다.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }
    setUploading(true)
    try {
      const url = await uploadFile(scope, file)
      onUploaded(url)
    } catch {
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const isPdf = value?.toLowerCase().includes('.pdf') || value?.toLowerCase().includes('pdf')

  if (value) {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-surface-2 border border-white/8 rounded-lg">
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
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-secondary hover:text-brand truncate flex-1 transition-colors"
        >
          파일 보기 ↗
        </a>
        <button
          onClick={onRemove}
          className="flex-none text-text-quaternary hover:text-danger transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 flex items-center gap-1.5 text-xs text-text-quaternary hover:text-text-secondary border border-dashed border-white/12 hover:border-white/20 rounded-lg px-3 py-2 w-full transition-colors"
      >
        {uploading ? (
          <span className="animate-pulse">업로드 중...</span>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 4l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 9v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            파일 첨부 (PDF / JPG / PNG, 10MB 이하)
          </>
        )}
      </button>
    </>
  )
}
