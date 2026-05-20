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
import type { Announcement, CreateAnnouncementDto } from '@/types/announcement'
import { toast } from '@/stores/toastStore'

const TYPE_LABEL: Record<string, string> = { banner: '배너', modal: '모달' }
const TYPE_COLOR: Record<string, string> = {
  banner: 'text-brand bg-brand/10 border-brand/20',
  modal: 'text-warning bg-warning/10 border-warning/20',
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
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ops" className="text-text-tertiary hover:text-text-primary text-sm">← 관리자</Link>
        <h1 className="text-xl font-bold">공지 관리</h1>
        <span className="ml-auto text-xs text-text-tertiary">총 {data.length}건</span>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 bg-brand text-text-primary text-xs font-medium rounded-lg hover:bg-accent transition-colors"
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
          <div role="dialog" aria-modal="true" aria-label="공지 삭제 확인" className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">공지를 삭제할까요?</h3>
            <p className="text-sm text-text-tertiary mb-1 truncate">"{deleteTarget.title}"</p>
            <p className="text-sm text-text-quaternary mb-6">삭제하면 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-text-secondary hover:bg-white/4 transition-colors"
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
        ? 'bg-surface-2/30 border-white/4 opacity-50'
        : item.active
          ? 'bg-surface-2 border-white/8'
          : 'bg-surface-2/40 border-white/5 opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOR[item.type]}`}>
              {TYPE_LABEL[item.type]}
            </span>
            {isExpired ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-text-quaternary bg-white/4 border-white/8">
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
                : 'text-text-quaternary hover:bg-white/5'
            }`}
          >
            {item.active ? '●' : '○'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-secondary hover:bg-white/5 transition-colors text-xs"
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
  const [type, setType] = useState<'banner' | 'modal'>(initial?.type ?? 'banner')
  const [active, setActive] = useState(initial?.active ?? false)
  const [startsAt, setStartsAt] = useState(
    initial?.starts_at ? dayjs(initial.starts_at).format('YYYY-MM-DDTHH:mm') : ''
  )
  const [endsAt, setEndsAt] = useState(
    initial?.ends_at ? dayjs(initial.ends_at).format('YYYY-MM-DDTHH:mm') : ''
  )

  const mutation = useMutation({
    mutationFn: () => {
      const dto: CreateAnnouncementDto = {
        title: title.trim(),
        body: body.trim(),
        type,
        active,
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
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const timeRangeError = (() => {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
      return '시작 시간이 종료 시간보다 같거나 뒤에 있어요.'
    if (endsAt && new Date(endsAt) <= new Date())
      return '종료 시간이 이미 지난 시간이에요. 등록해도 공지가 표시되지 않아요.'
    return null
  })()

  const isValid = title.trim().length > 0 && body.trim().length > 0 && timeRangeError !== '시작 시간이 종료 시간보다 같거나 뒤에 있어요.'

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-6 sm:pb-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? '공지 수정' : '새 공지 작성'}
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-bold flex-1">{initial ? '공지 수정' : '새 공지 작성'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-primary hover:bg-white/5 transition-colors"
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
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-quaternary"
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
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-quaternary resize-none"
            />
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
                    onChange={() => setType(t)}
                    className="accent-brand"
                  />
                  <span className="text-sm text-text-secondary">
                    {t === 'banner' ? '배너 (상단 띠)' : '모달 (큰 발표)'}
                  </span>
                </label>
              ))}
            </div>
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
                    timeRangeError === '시작 시간이 종료 시간보다 같거나 뒤에 있어요.' ? 'border-danger/50' : 'border-white/10'
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
                    timeRangeError ? 'border-danger/50' : 'border-white/10'
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

        <div className="px-6 py-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="w-full py-2.5 bg-brand text-text-primary text-sm font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? '저장 중...' : initial ? '수정 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
