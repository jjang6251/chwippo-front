import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/api/announcements'
import type { Announcement, AnnouncementKind, CreateAnnouncementDto } from '@/types/announcement'
import { toast } from '@/stores/toastStore'

const TYPE_LABEL: Record<string, string> = { banner: '배너', modal: '모달' }
const TYPE_COLOR: Record<string, string> = {
  banner: 'text-brand bg-brand/10 border-brand/20',
  modal: 'text-warning bg-warning/10 border-warning/20',
}

const KIND_OPTIONS: { value: AnnouncementKind; label: string }[] = [
  { value: 'notice', label: '안내' },
  { value: 'feature', label: '새 기능' },
  { value: 'improvement', label: '개선' },
  { value: 'fix', label: '수정' },
]
const KIND_LABEL: Record<AnnouncementKind, string> = {
  notice: '안내',
  feature: '새 기능',
  improvement: '개선',
  fix: '수정',
}
const KIND_COLOR: Record<AnnouncementKind, string> = {
  notice: 'text-text-quaternary bg-card border-line',
  feature: 'text-accent bg-accent/10 border-accent/20',
  improvement: 'text-info bg-info/10 border-info/20',
  fix: 'text-success bg-success/10 border-success/20',
}

/**
 * 종류가 정하는 **형태 기본값** — 새 기능만 모달이다.
 * 새 기능은 「한 번 제대로 읽히고 눌러야」 의미가 있고, 나머지는 띠로 붙어 있으면 충분하다.
 * 🔴 사용자가 형태를 직접 고른 뒤엔 종류를 바꿔도 그 선택을 안 덮는다.
 */
const DEFAULT_TYPE_FOR_KIND = (kind: AnnouncementKind): 'banner' | 'modal' =>
  kind === 'feature' ? 'modal' : 'banner'

const CTA_LABEL_MAX = 30

/** NestJS 검증 실패는 `message` 가 배열로 온다 — 뭉개지 말고 그대로 읽힌다 */
function readServerMessage(err: unknown): string | null {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message
  if (Array.isArray(msg)) return msg.join(' · ')
  return msg ?? null
}

export function OpsAnnouncements() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const qc = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: getAdminAnnouncements,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateAnnouncement(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      qc.invalidateQueries({ queryKey: ['announcements', 'active'] })
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      qc.invalidateQueries({ queryKey: ['announcements', 'active'] })
      toast.success('공지를 삭제했어요.')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(a: Announcement) { setEditing(a); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditing(null) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ops" className="text-text-tertiary hover:text-text-primary text-sm">← 관리자</Link>
        <h1 className="text-xl font-bold">공지 관리</h1>
        <span className="ml-auto text-xs text-text-tertiary">총 {data.length}건</span>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 bg-brand text-bg text-xs font-medium rounded-lg hover:bg-accent active:bg-accent-hover transition-colors"
        >
          + 새 공지
        </button>
      </div>

      {isLoading && data.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">불러오는 중...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          <p>등록된 공지가 없어요.</p>
          <button type="button" onClick={openCreate} className="mt-3 text-brand text-sm hover:underline">
            새 공지 작성하기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((item) => (
            <AnnouncementRow
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleteTarget(item)}
              onToggle={(active) => toggleMutation.mutate({ id: item.id, active })}
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {formOpen && (
        <AnnouncementFormModal
          initial={editing}
          onClose={closeForm}
          onSaved={() => {
            closeForm()
            qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
            qc.invalidateQueries({ queryKey: ['announcements', 'active'] })
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div role="dialog" aria-modal="true" aria-label="공지 삭제 확인" className="bg-surface border border-line rounded-xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">공지를 삭제할까요?</h3>
            <p className="text-sm text-text-tertiary mb-1 truncate">"{deleteTarget.title}"</p>
            <p className="text-sm text-text-quaternary mb-6">삭제하면 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-line text-sm text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-danger/15 text-danger border border-danger/25 text-sm font-medium hover:bg-danger/25 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AnnouncementRow({
  item,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  item: Announcement
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
  toggling: boolean
}) {
  const isExpired = !!item.ends_at && dayjs(item.ends_at).isBefore(dayjs())

  return (
    <div className={`border rounded-xl px-5 py-4 transition-colors ${
      isExpired
        ? 'bg-surface-2/30 border-line opacity-50'
        : item.active
          ? 'bg-surface-2 border-line'
          : 'bg-surface-2/40 border-line opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${KIND_COLOR[item.kind]}`}>
              {KIND_LABEL[item.kind]}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOR[item.type]}`}>
              {TYPE_LABEL[item.type]}
            </span>
            {isExpired ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-text-quaternary bg-card border-line">
                만료
              </span>
            ) : item.active ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-success bg-success/10 border-success/20">
                활성
              </span>
            ) : null}
            <span className="text-[11px] text-text-quaternary ml-auto">
              {dayjs(item.created_at).format('MM.DD HH:mm')}
            </span>
          </div>
          <p className="text-sm font-semibold truncate">{item.title}</p>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">{item.body}</p>
          {(item.starts_at || item.ends_at) && (
            <p className="text-[11px] text-text-quaternary mt-1">
              {item.starts_at ? dayjs(item.starts_at).format('MM.DD HH:mm') : '즉시'}
              {' → '}
              {item.ends_at ? dayjs(item.ends_at).format('MM.DD HH:mm') : '무기한'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-none">
          <button
            type="button"
            onClick={() => onToggle(!item.active)}
            disabled={toggling}
            title={item.active ? '비활성으로 전환' : '활성으로 전환'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors ${
              item.active
                ? 'text-success hover:bg-success/10'
                : 'text-text-quaternary hover:bg-card active:bg-card-strong'
            }`}
          >
            {item.active ? '●' : '○'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors text-xs"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-danger hover:bg-danger/8 transition-colors text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

function AnnouncementFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Announcement | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [kind, setKind] = useState<AnnouncementKind>(initial?.kind ?? 'notice')
  const [type, setType] = useState<'banner' | 'modal'>(
    initial?.type ?? DEFAULT_TYPE_FOR_KIND(initial?.kind ?? 'notice'),
  )
  /** 형태를 사람이 직접 골랐나 — 수정 화면은 이미 고른 값이 있으므로 처음부터 true */
  const [typeTouched, setTypeTouched] = useState(!!initial)
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? '')
  const [ctaPath, setCtaPath] = useState(initial?.cta_path ?? '')
  const [active, setActive] = useState(initial?.active ?? false)
  const [startsAt, setStartsAt] = useState(
    initial?.starts_at ? dayjs(initial.starts_at).format('YYYY-MM-DDTHH:mm') : ''
  )
  const [endsAt, setEndsAt] = useState(
    initial?.ends_at ? dayjs(initial.ends_at).format('YYYY-MM-DDTHH:mm') : ''
  )
  /** 서버가 거절한 이유 — 폼 검사와 규칙이 같아도 **서버 문구를 그대로** 보여준다 */
  const [serverError, setServerError] = useState<string | null>(null)

  function changeKind(next: AnnouncementKind) {
    setKind(next)
    if (!typeTouched) setType(DEFAULT_TYPE_FOR_KIND(next))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const label = ctaLabel.trim()
      const path = ctaPath.trim()
      const dto: CreateAnnouncementDto = {
        title: title.trim(),
        body: body.trim(),
        type,
        kind,
        active,
        cta_label: label || null,
        cta_path: path || null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      }
      return initial
        ? updateAnnouncement(initial.id, dto)
        : createAnnouncement(dto)
    },
    onSuccess: () => {
      toast.success(initial ? '공지를 수정했어요.' : '공지를 등록했어요.')
      onSaved()
    },
    onError: (err) => {
      setServerError(readServerMessage(err))
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    },
  })

  const timeRangeError = (() => {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
      return '시작 시간이 종료 시간보다 같거나 뒤에 있어요.'
    if (endsAt && new Date(endsAt) <= new Date())
      return '종료 시간이 이미 지난 시간이에요. 등록해도 공지가 표시되지 않아요.'
    return null
  })()

  /*
    🔴 서버 규칙과 **같은 규칙**을 폼에도 둔다. 서버가 400 으로 막아 주긴 하지만, 거절을
    받고 나서야 아는 것과 쓰는 동안 아는 건 다르다 (라벨만 채우고 저장을 누르는 게 흔하다).
  */
  const ctaError = (() => {
    const label = ctaLabel.trim()
    const path = ctaPath.trim()
    if (!!label !== !!path) return '버튼 글자와 이동 경로는 둘 다 채우거나 둘 다 비워주세요.'
    if (path && !path.startsWith('/')) return '경로는 앱 안 주소여야 해요. / 로 시작해주세요.'
    return null
  })()

  const isValid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    ctaError === null &&
    timeRangeError !== '시작 시간이 종료 시간보다 같거나 뒤에 있어요.'

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-6 sm:pb-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? '공지 수정' : '새 공지 작성'}
        className="bg-surface border border-line rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
          <h2 className="text-base font-bold flex-1">{initial ? '공지 수정' : '새 공지 작성'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-primary hover:bg-card active:bg-card-strong transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* 제목 */}
          <div>
            <label className="text-xs text-text-tertiary mb-1.5 block">
              제목 <span className="text-text-quaternary">({title.length}/100)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="공지 제목"
              className="w-full bg-bg border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary"
            />
          </div>

          {/* 본문 */}
          <div>
            <label className="text-xs text-text-tertiary mb-1.5 block">
              본문 <span className="text-text-quaternary">({body.length}/500)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="공지 내용을 입력하세요"
              className="w-full bg-bg border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary resize-none"
            />
          </div>

          {/* 종류 — 사용자 화면의 칩과 형태 기본값을 함께 정한다 */}
          <div>
            <label htmlFor="announcement-kind" className="text-xs text-text-tertiary mb-1.5 block">
              종류
            </label>
            <div className="relative">
              <select
                id="announcement-kind"
                value={kind}
                onChange={(e) => changeKind(e.target.value as AnnouncementKind)}
                className="w-full appearance-none bg-bg border border-line rounded-lg pl-3 pr-9 py-2.5 text-sm text-text-primary outline-none focus:border-brand/50 transition-colors cursor-pointer"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="mt-1.5 text-[11px] text-text-quaternary leading-relaxed">
              {kind === 'notice'
                ? '안내는 칩 없이 제목만 나가요.'
                : `사용자 화면 제목 앞에 「${KIND_LABEL[kind]}」 칩이 붙어요.`}
            </p>
          </div>

          {/* 타입 */}
          <div>
            <label className="text-xs text-text-tertiary mb-1.5 block">타입</label>
            <div className="flex gap-3">
              {(['banner', 'modal'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => { setTypeTouched(true); setType(t) }}
                    className="accent-brand"
                  />
                  <span className="text-sm text-text-secondary">
                    {t === 'banner' ? '배너 (상단 띠)' : '모달 (큰 발표)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 「지금 해보기」 버튼 — 읽고 닫는 글을 눌러 보는 글로 바꾸는 자리 */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="announcement-cta-label" className="text-xs text-text-tertiary mb-1.5 block">
                  버튼 글자 (선택) <span className="text-text-quaternary">({ctaLabel.length}/{CTA_LABEL_MAX})</span>
                </label>
                <input
                  id="announcement-cta-label"
                  value={ctaLabel}
                  onChange={(e) => { setServerError(null); setCtaLabel(e.target.value.slice(0, CTA_LABEL_MAX)) }}
                  placeholder="지금 해보기"
                  className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary ${
                    ctaError ? 'border-danger/50' : 'border-line'
                  }`}
                />
              </div>
              <div>
                <label htmlFor="announcement-cta-path" className="text-xs text-text-tertiary mb-1.5 block">
                  이동 경로 (선택)
                </label>
                <input
                  id="announcement-cta-path"
                  value={ctaPath}
                  onChange={(e) => { setServerError(null); setCtaPath(e.target.value) }}
                  placeholder="/board?add=posting"
                  className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary ${
                    ctaError ? 'border-danger/50' : 'border-line'
                  }`}
                />
              </div>
            </div>
            {ctaError ? (
              <p role="alert" className="text-xs text-danger">⚠ {ctaError}</p>
            ) : (
              <p className="text-[11px] text-text-quaternary leading-relaxed">
                앱 안 경로만 돼요. 예: <code>/board?add=posting</code>
              </p>
            )}
          </div>

          {/* 활성 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-brand w-4 h-4"
            />
            <span className="text-sm text-text-secondary">즉시 활성화</span>
          </label>

          {/* 시간 범위 */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-tertiary mb-1.5 block">시작 (선택)</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors text-text-secondary ${
                    timeRangeError === '시작 시간이 종료 시간보다 같거나 뒤에 있어요.' ? 'border-danger/50' : 'border-line'
                  }`}
                />
              </div>
              <div>
                <label className="text-xs text-text-tertiary mb-1.5 block">종료 (선택)</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors text-text-secondary ${
                    timeRangeError ? 'border-danger/50' : 'border-line'
                  }`}
                />
              </div>
            </div>
            {timeRangeError && (
              <p className={`text-xs ${timeRangeError.includes('이미 지난') ? 'text-warning' : 'text-danger'}`}>
                ⚠ {timeRangeError}
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line">
          {/* 🔴 서버가 거절한 문구를 **그대로** 보여준다 — 폼 검사와 규칙이 갈렸을 때
              「저장이 안 되는데 왜인지 모르는」 상태가 안 생기게 */}
          {serverError && (
            <p role="alert" className="mb-3 text-xs text-danger leading-relaxed break-keep">
              ⚠ {serverError}
            </p>
          )}
          <button
            type="button"
            onClick={() => { setServerError(null); mutation.mutate() }}
            disabled={!isValid || mutation.isPending}
            className="w-full py-2.5 bg-brand text-bg text-sm font-medium rounded-lg hover:bg-accent active:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? '저장 중...' : initial ? '수정 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
