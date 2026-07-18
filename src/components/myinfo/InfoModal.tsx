/**
 * MyInfo 도메인 공용 모달 프레임.
 * - EducationModal 톤과 통일 — 큰 emoji 헤더 + subtitle accent 색 + close X + section-friendly body + brand CTA
 * - **모바일 = vaul Drawer (Bottom Sheet)** — drag handle · snap points · 자판 대응 native 감정
 * - **데스크탑 = 기존 중앙 modal** — max-w-lg 중앙 정렬
 * - 사용처: LangCerts · Certs · Awards · ExamSchedules (교체) · Education (별도 파일)
 */
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsMobile } from '@/hooks/useMediaQuery'

type ModalAccent = 'brand' | 'success' | 'warning' | 'info' | 'violet' | 'accent'

const ACCENT_TONE: Record<ModalAccent, { ring: string; bg: string; text: string }> = {
  brand:   { ring: 'ring-brand/30',   bg: 'bg-brand/10',   text: 'text-brand' },
  success: { ring: 'ring-success/30', bg: 'bg-success/10', text: 'text-success' },
  warning: { ring: 'ring-warning/30', bg: 'bg-warning/10', text: 'text-warning' },
  info:    { ring: 'ring-info/30',    bg: 'bg-info/10',    text: 'text-info' },
  violet:  { ring: 'ring-violet/30',  bg: 'bg-violet/10',  text: 'text-violet' },
  accent:  { ring: 'ring-accent/30',  bg: 'bg-accent/10',  text: 'text-accent' },
}

interface Props {
  title: string
  emoji: string
  accent: ModalAccent
  subtitle?: string
  children: ReactNode
  onClose: () => void
  onSave: () => void
  saving?: boolean
  onDelete?: () => void
  /** 저장 버튼 라벨 (기본 저장) */
  saveLabel?: string
  /** 저장 버튼 disabled (form validation) */
  saveDisabled?: boolean
}

export function InfoModal({
  title, emoji, accent, subtitle, children, onClose, onSave, saving, onDelete, saveLabel, saveDisabled,
}: Props) {
  const tone = ACCENT_TONE[accent]
  const isMobile = useIsMobile()

  const header = (
    <div className="relative px-8 pt-6 pb-5 shrink-0">
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        disabled={saving}
        className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-primary hover:bg-card transition-colors disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-3 ring-1 ${tone.ring} ${tone.bg}`} aria-hidden="true">
        {emoji}
      </div>
      <h3 className="text-xl font-bold text-text-primary leading-tight">{title}</h3>
      {subtitle && (
        <p className={`text-xs mt-1 truncate font-medium ${tone.text}`}>{subtitle}</p>
      )}
    </div>
  )

  const body = (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-8 pt-2 pb-4 space-y-3">
      {children}
    </div>
  )

  const footer = (
    <div className="flex items-center gap-2 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-line bg-surface shrink-0">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          aria-label="삭제"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-text-quaternary hover:text-danger w-11 h-11 sm:w-auto sm:h-12 sm:px-3 justify-center transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">삭제</span>
        </button>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="flex-1 sm:flex-none sm:min-w-[6rem] h-12 px-4 sm:px-5 text-sm font-medium text-text-secondary border border-line/70 rounded-xl hover:bg-card active:bg-card-strong transition-colors disabled:opacity-50"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || saveDisabled}
        className="flex-1 sm:flex-none sm:min-w-[7rem] h-12 px-4 sm:px-6 text-sm font-bold bg-brand hover:bg-accent active:bg-accent-hover text-bg rounded-xl shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {saving ? '저장 중...' : saveLabel ?? '저장'}
      </button>
    </div>
  )

  // 모바일 = vaul Drawer (Bottom Sheet)
  if (isMobile) {
    return (
      <Drawer.Root
        open
        onOpenChange={(open) => { if (!open && !saving) onClose() }}
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Drawer.Content
            aria-label={title}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[92dvh] flex flex-col shadow-2xl outline-none"
          >
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line shrink-0" aria-hidden="true" />
            {header}
            {body}
            {footer}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  // 데스크탑 = 중앙 modal (기존 톤)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => { if (!saving) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-surface border border-line rounded-2xl w-full max-w-lg max-h-[calc(100vh-4rem)] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        {body}
        {footer}
      </div>
    </div>
  )
}
