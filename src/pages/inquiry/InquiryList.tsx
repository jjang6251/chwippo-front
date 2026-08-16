import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMyInquiries, type Inquiry } from '@/api/inquiries'
import dayjs from 'dayjs'

const STATUS_LABEL = { OPEN: '답변 대기', IN_PROGRESS: '답변 중', CLOSED: '완료' }
const STATUS_COLOR = {
  OPEN: 'text-warning bg-warning/10 border-warning/20',
  IN_PROGRESS: 'text-brand bg-brand/10 border-brand/20',
  CLOSED: 'text-text-quaternary bg-card border-line',
}

const CATEGORIES = ['전체', '버그 신고', '기능 추가 요청', '기능 개선', '알림 문의', '계정·개인정보', '사용 방법 문의', '기타']

export function InquiryList() {
  const [catFilter, setCatFilter] = useState('전체')
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['inquiries', 'my'],
    queryFn: getMyInquiries,
    refetchOnWindowFocus: true,
  })

  const filtered = catFilter === '전체'
    ? inquiries
    : inquiries.filter((i) => i.category === catFilter)

  const open = filtered.filter((i) => i.status !== 'CLOSED')
  const closed = filtered.filter((i) => i.status === 'CLOSED')
  const sorted = [...open, ...closed]

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">문의 내역</h1>
          <p className="text-xs text-text-quaternary mt-0.5">답변은 앱 안에서 확인할 수 있어요</p>
        </div>
        <Link
          to="/inquiry/new"
          className="px-4 py-2 bg-brand text-bg text-sm font-semibold rounded-lg hover:bg-accent active:bg-accent-hover transition-colors"
        >
          + 새 문의
        </Link>
      </div>

      {/* 카테고리 필터 드롭다운 */}
      <div className="mb-5">
        <div className="relative inline-block">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="appearance-none bg-input border border-line rounded-lg pl-3 pr-8 py-2 text-sm text-text-secondary cursor-pointer outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-quaternary text-xs">▾</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-line rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="text-4xl">💬</span>
          <p className="text-sm text-text-quaternary">아직 문의 내역이 없어요</p>
          <Link to="/inquiry/new" className="text-sm text-brand hover:underline">
            첫 문의 남기기 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <InquiryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function InquiryCard({ item }: { item: Inquiry }) {
  const isClosed = item.status === 'CLOSED'
  const statusLabel = STATUS_LABEL[item.status as keyof typeof STATUS_LABEL] ?? item.status
  const statusColor = STATUS_COLOR[item.status as keyof typeof STATUS_COLOR] ?? 'text-text-quaternary bg-card border-line'

  return (
    <Link
      to={`/inquiry/${item.id}`}
      className={`block border rounded-xl px-5 py-4 transition-colors hover:border-line-strong relative ${
        isClosed ? 'bg-surface-2/50 border-line opacity-60' : 'bg-surface-2 border-line'
      }`}
    >
      {/* 미읽음 뱃지 */}
      {item.user_unread > 0 && (
        <span className="absolute top-3 right-4 min-w-[18px] h-[18px] px-1 bg-danger text-text-primary text-[10px] font-bold rounded-full flex items-center justify-center">
          {item.user_unread}
        </span>
      )}

      <div className="flex items-center gap-2 mb-1.5 pr-6">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="text-xs text-text-quaternary">{item.category}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${isClosed ? 'text-text-quaternary' : ''}`}>{item.title}</p>
      <p className="text-xs text-text-quaternary mt-0.5">{dayjs(item.created_at).format('YYYY.MM.DD')}</p>
    </Link>
  )
}
