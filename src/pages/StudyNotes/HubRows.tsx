import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PrepHubGroup, StudyNoteFolder, StudyNoteListItem } from '@/api/studyNotes'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import {
  companyInitial,
  formatRelativeTime,
  isUntitled,
  noteTitleLabel,
  prepDeepLink,
} from './studyNotesModel'

/**
 * 허브의 줄들 — 폴더 머리 · 공부 노트 행 · 회사 준비 행 · 인라인 이름 입력 · ⋯ 메뉴.
 *
 * ## 🔴 모바일에는 hover 가 없다
 *
 * 데스크탑은 `⋯` 를 hover 로 꺼내지만 터치에는 그 상태가 아예 없다 — 상시 노출로 바꾸지
 * 않으면 **모바일에서 폴더 이름을 바꾸거나 노트를 옮길 길이 없다** (준비 노트 시트 탭의
 * 연필을 상시 노출한 것과 같은 판단). `max-lg:opacity-100` 이 그 한 줄이다.
 *
 * ## 좌측 스트라이프 = 유형
 *
 * 공부 노트 = brand(sage) · 회사 준비 = accent(coral). 목록이 섞여 보일 때 아이콘보다
 * 먼저 읽히는 신호고, 준비 행은 ↗ 로 "여기서 편집하는 게 아니라 저기로 간다" 를 말한다.
 */

const ROW_BASE =
  'group flex items-center gap-3 px-4 py-3 rounded-lg bg-card-solid shadow-sm hover:bg-surface-3 transition-colors'

const ROW_LINK =
  'flex-1 min-w-0 flex items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg'

/** hover 로 꺼내되 모바일·키보드 포커스에서는 항상 보인다 */
const HOVER_ACTION =
  'shrink-0 w-8 h-8 lg:w-6 lg:h-6 rounded flex items-center justify-center text-text-quaternary hover:bg-card-hover hover:text-text-secondary transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
    </svg>
  )
}

/**
 * 백링크 수 — **0이면 아무 것도 그리지 않는다.** 대부분의 노트가 0이라 「🔗 0」을 달면
 * 목록 전체가 의미 없는 뱃지로 덮이고, 정작 참조가 있는 노트가 안 튄다.
 * 숫자만 두면 옆의 수정 시각과 구분이 안 가므로 이름은 `aria-label`·툴팁이 진다.
 */
function BacklinkCount({ count }: { count: number }) {
  if (count <= 0) return null
  const label = `이 노트를 참조한 노트 ${count}개`
  return (
    <span
      data-testid="hub-backlink-count"
      aria-label={label}
      title={label}
      className="shrink-0 inline-flex items-center gap-1 text-[11px] text-text-quaternary"
    >
      <LinkIcon />
      {count}
    </span>
  )
}

function ExternalIcon() {
  return (
    <svg
      className="shrink-0 text-text-quaternary group-hover:text-accent transition-colors"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  )
}

// ── ⋯ 메뉴 ───────────────────────────────────────────────────

/**
 * 작은 드롭다운. 바깥 클릭·ESC 로 닫힌다 — ESC 는 `stopPropagation` 해서 **뒤의 모달까지
 * 같이 닫히지 않게** 한다 (시트 이름 입력이 쓰는 것과 같은 규약).
 */
export function DotsMenu({
  label,
  children,
  footnote,
}: {
  label: string
  children: (close: () => void) => ReactNode
  footnote?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as globalThis.Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`${HOVER_ACTION} ${open ? 'opacity-100 bg-card-hover text-text-secondary' : ''}`}
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-8 z-20 w-44 rounded-lg bg-surface-2 border border-line-strong shadow-xl py-1 text-[13px]"
        >
          {children(() => setOpen(false))}
          {footnote && (
            <div className="px-3 pt-1.5 pb-1 mt-1 text-[10px] text-text-quaternary border-t border-line">
              {footnote}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-card-hover transition-colors ${
        danger ? 'text-danger' : 'text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

// ── 인라인 이름 입력 (시트 탭과 같은 규약) ────────────────────

/** 서버 캡(`MAX_FOLDER_NAME`)과 같은 값 — 넘으면 400 이라 입력에서 막는다 */
export const FOLDER_NAME_MAX = 50

/**
 * 폴더 이름 인라인 입력.
 *
 * - Enter 확정 · ESC 취소 · blur 확정 (엑셀 = 준비 노트 시트 탭과 같은 문법)
 * - 🔴 ESC 는 blur 보다 먼저 도착하고 그 blur 가 다시 확정을 부른다 — 취소 플래그로 막는다
 * - 🔴 한글 조합 중의 Enter 는 **글자 확정**이지 이름 확정이 아니다 (`isComposing`)
 * - 모바일 16px(`text-base`) — 미만이면 iOS 사파리가 포커스에서 화면을 확대한다
 */
export function InlineNameInput({
  initial,
  ariaLabel,
  onCommit,
  onCancel,
}: {
  initial: string
  ariaLabel: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const cancelledRef = useRef(false)

  return (
    <input
      autoFocus
      value={value}
      maxLength={FOLDER_NAME_MAX}
      aria-label={ariaLabel}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          e.currentTarget.blur() // blur 핸들러가 확정한다 (경로 하나)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancelledRef.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        if (cancelledRef.current) {
          onCancel()
          return
        }
        // 공백만 남기면 서버가 400 이다 — 되돌리는 게 사용자가 기대하는 결과다
        const next = value.trim()
        if (next) onCommit(next)
        else onCancel()
      }}
      className="h-9 lg:h-7 px-2 w-44 rounded-md bg-input border border-brand/60 text-base lg:text-[13px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    />
  )
}

// ── 폴더 머리 ────────────────────────────────────────────────

export function FolderHeader({
  folder,
  count,
  collapsed,
  renaming,
  onToggle,
  onStartRename,
  onRename,
  onCancelRename,
  onRequestDelete,
  onCreateNote,
}: {
  folder: StudyNoteFolder
  count: number
  collapsed: boolean
  renaming: boolean
  onToggle: () => void
  onStartRename: () => void
  onRename: (name: string) => void
  onCancelRename: () => void
  onRequestDelete: () => void
  /** 이 폴더 안에 바로 새 노트 (2026-08-19 실사용 — 만들고 일일이 옮기는 동선 제거) */
  onCreateNote: () => void
}) {
  if (renaming) {
    return (
      <div className="flex items-center gap-1.5 mb-2">
        <CollapsibleChevron open={!collapsed} />
        <span className="text-[13px]" aria-hidden="true">
          📁
        </span>
        <InlineNameInput
          initial={folder.name}
          ariaLabel="폴더 이름"
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1.5 mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1.5 text-left text-base font-semibold text-text-primary hover:text-brand transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <CollapsibleChevron open={!collapsed} />
        <span aria-hidden="true">📁</span>
        <span>{folder.name}</span>
        <span className="text-[11px] text-text-quaternary font-normal">{count}</span>
      </button>
      <button
        type="button"
        onClick={onCreateNote}
        aria-label={`'${folder.name}' 폴더에 새 노트`}
        title="이 폴더에 새 노트"
        className="min-w-[32px] min-h-[32px] max-lg:min-w-[44px] max-lg:min-h-[44px] max-lg:-my-2 inline-flex items-center justify-center rounded-md text-text-quaternary hover:text-brand hover:bg-card transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <PlusSmallIcon />
      </button>
      <DotsMenu label={`'${folder.name}' 폴더 메뉴`} footnote="삭제해도 노트는 미분류로 남아요">
        {(close) => (
          <>
            <MenuItem
              onClick={() => {
                close()
                onStartRename()
              }}
            >
              이름 바꾸기
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                close()
                onRequestDelete()
              }}
            >
              삭제
            </MenuItem>
          </>
        )}
      </DotsMenu>
    </div>
  )
}

function PlusSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── 공부 노트 행 ─────────────────────────────────────────────

export function StudyNoteRow({
  note,
  folders,
  now,
  onMove,
  onRequestDelete,
}: {
  note: StudyNoteListItem
  folders: StudyNoteFolder[]
  now: Date
  onMove: (folderId: string | null) => void
  onRequestDelete: () => void
}) {
  return (
    /*
      🔴 `⋯` 를 **링크 밖에** 둔다. 링크 안의 버튼은 무효 마크업이고 브라우저마다 클릭
      판정이 갈린다 (시트 탭에서 같은 이유로 role 을 쓴 것과 짝). 카드 면·hover 는 바깥
      컨테이너가 지고, 링크는 제목·시각만 덮는다 — 행의 거의 전부라 체감 차이는 없다.
    */
    <div className={`${ROW_BASE} border-l-[3px] border-brand`}>
      <Link to={`/study-notes/${note.id}`} className={ROW_LINK}>
        <span
          className={`flex-1 min-w-0 truncate text-sm ${
            isUntitled(note.title) ? 'text-text-quaternary' : ''
          }`}
        >
          {noteTitleLabel(note.title)}
        </span>
        {/* 서버가 아직 안 실어 보내는 응답도 있다 — 화면은 언제나 0으로 받는다 */}
        <BacklinkCount count={note.backlinkCount ?? 0} />
        <span className="shrink-0 text-[11px] text-text-quaternary font-mono">
          {formatRelativeTime(note.updatedAt, now)}
        </span>
      </Link>
      <DotsMenu label={`'${noteTitleLabel(note.title)}' 노트 메뉴`}>
        {(close) => (
          <>
            <div className="px-3 pt-1 pb-1.5 text-[10px] text-text-quaternary">폴더 이동</div>
            <MenuItem
              onClick={() => {
                close()
                onMove(null)
              }}
            >
              <span className={note.folderId === null ? 'text-brand' : ''}>미분류</span>
            </MenuItem>
            {folders.map((f) => (
              <MenuItem
                key={f.id}
                onClick={() => {
                  close()
                  onMove(f.id)
                }}
              >
                <span className={note.folderId === f.id ? 'text-brand' : ''}>📁 {f.name}</span>
              </MenuItem>
            ))}
            <div className="border-t border-line mt-1 pt-1">
              <MenuItem
                danger
                onClick={() => {
                  close()
                  onRequestDelete()
                }}
              >
                삭제
              </MenuItem>
            </div>
          </>
        )}
      </DotsMenu>
    </div>
  )
}

// ── 회사 준비 행 (읽기 전용 — 클릭 = 스텝 딥링크) ──────────────

export function PrepNoteRow({ group, now }: { group: PrepHubGroup; now: Date }) {
  return (
    <Link
      to={prepDeepLink(group)}
      className={`${ROW_BASE} border-l-[3px] border-accent`}
      aria-label={`${group.companyName} ${group.stepName} 준비 노트로 이동`}
    >
      <span
        aria-hidden="true"
        className="w-5 h-5 rounded-[5px] bg-card-strong text-text-tertiary text-[10px] font-bold flex items-center justify-center shrink-0"
      >
        {companyInitial(group.companyName)}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm">
        {group.companyName} — {group.stepName}
      </span>
      <span className="shrink-0 text-[11px] text-text-quaternary">
        <span className="hidden sm:inline">준비 노트 </span>
        {group.sheetCount}장
      </span>
      <span className="shrink-0 text-[11px] text-text-quaternary font-mono hidden sm:inline">
        {formatRelativeTime(group.lastUpdatedAt, now)}
      </span>
      <ExternalIcon />
    </Link>
  )
}
