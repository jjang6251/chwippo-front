import { AxiosError } from 'axios'
import { useCompanyDetails } from '@/hooks/useCompanyDetails'

/**
 * W2 — BoardDetail "회사 정보" 섹션 (DART OpenAPI 기반).
 *
 * 렌더 정책:
 *   - 404 (비상장사·매핑 안 됨) → 섹션 미렌더 (silent — 사용자 인식 = "원래 정보 없는 회사")
 *   - 503 (DART 한도 초과·일시 오류) → 작은 회색 안내 박스 (사용자 인식 = "잠시 후 다시")
 *   - 그 외 에러 → silent 미렌더
 *   - 로딩 → 스켈레톤
 *   - 정상 → 프로필 + 재무 + 공시
 *   - data.isStale=true → "OO시간 전 정보" 라벨 (stale-while-error)
 */
interface Props {
  companyName: string
}

export function CompanyInfoSection({ companyName }: Props) {
  const { data, isLoading, error } = useCompanyDetails(companyName)

  if (isLoading) return <Skeleton />

  if (error instanceof AxiosError && error.response?.status === 503) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-5 py-4 flex items-center gap-2">
        <span className="text-text-quaternary text-xs">DART 공시 정보를 잠시 후 다시 불러올게요.</span>
      </div>
    )
  }

  if (!data) return null

  const { profile, financials, disclosures } = data

  return (
    <section
      aria-labelledby="company-info-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="company-info-heading" className="text-text-primary text-sm font-semibold">
          회사 정보
        </h2>
        <div className="flex items-center gap-2">
          {data.isStale && (
            <span
              className="text-warning text-[10px] font-mono"
              aria-label={`마지막 갱신 ${formatRelativeTime(data.fetchedAt)}. DART 일시 오류로 옛 정보가 표시되고 있어요.`}
              title={`마지막 갱신: ${formatRelativeTime(data.fetchedAt)}. DART 일시 오류로 옛 정보를 보여드려요.`}
            >
              {formatRelativeTime(data.fetchedAt)} 정보
            </span>
          )}
          <span className="text-text-quaternary text-[10px] font-mono">DART 공시</span>
        </div>
      </div>

      {/* 프로필 */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs mb-4">
        {profile.ceoName && (
          <Field label="대표이사" value={profile.ceoName} />
        )}
        {profile.estDate && (
          <Field label="설립일" value={formatDate(profile.estDate)} />
        )}
        {profile.induty && (
          <Field label="업종" value={profile.induty} />
        )}
        {profile.homepage && (
          <Field
            label="홈페이지"
            value={
              <a
                href={normalizeUrl(profile.homepage)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline inline-flex items-baseline gap-0.5 max-w-[180px]"
              >
                <span className="truncate">{profile.homepage}</span>
                <span aria-hidden="true" className="text-text-quaternary text-[9px] shrink-0">↗</span>
              </a>
            }
          />
        )}
        {profile.address && (
          <div className="col-span-2">
            <Field label="본점" value={profile.address} />
          </div>
        )}
      </dl>

      {/* 재무 */}
      {financials && financials.items.length > 0 && (
        <div className="border-t border-line pt-4 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-text-secondary text-xs font-semibold">최근 재무</h3>
            <span className="text-text-quaternary text-[10px] font-mono">{financials.reportName}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {pickKeyFinancials(financials.items).map((f, i) => (
              <div
                key={`${f.sjNm}-${f.accountNm}-${i}`}
                className="flex items-baseline justify-between bg-card border border-line rounded-md px-3 py-2"
              >
                <span className="text-text-tertiary text-[11px]">{f.accountNm}</span>
                <span className="text-text-primary text-xs font-mono">{formatAmount(f.thstrmAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 공시 */}
      {disclosures.length > 0 && (
        <div className="border-t border-line pt-4">
          <h3 className="text-text-secondary text-xs font-semibold mb-2.5">최근 공시</h3>
          <ul className="space-y-1">
            {disclosures.slice(0, 5).map((d) => (
              <li key={d.receiptNo} className="flex items-center justify-between gap-3 text-[11px]">
                <a
                  href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.receiptNo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary hover:text-brand truncate flex-1 inline-flex items-baseline gap-0.5"
                >
                  <span className="truncate">{d.reportName}</span>
                  <span aria-hidden="true" className="text-text-quaternary text-[9px] shrink-0">↗</span>
                </a>
                <span className="text-text-quaternary font-mono shrink-0">{formatDate(d.receiptDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-quaternary text-[10px] uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-card animate-pulse rounded mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 w-12 bg-card animate-pulse rounded" />
            <div className="h-3 w-24 bg-card animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  const hours = Math.floor(diff / (60 * 60 * 1000))
  if (hours < 1) return '방금 전'
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd) return ''
  // DART 는 YYYYMMDD 또는 YYYY-MM-DD 혼재
  const digits = yyyymmdd.replace(/-/g, '')
  if (digits.length !== 8) return yyyymmdd
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

/** DART 응답 중 신입 취준생에게 의미있는 5개 핵심 지표만 추출 */
function pickKeyFinancials(
  items: Array<{ sjNm: string; accountNm: string; thstrmAmount: string }>,
) {
  const TARGETS = ['매출액', '영업이익', '당기순이익', '자산총계', '자본총계']
  const result: Array<{ sjNm: string; accountNm: string; thstrmAmount: string }> = []
  for (const t of TARGETS) {
    const found = items.find((i) => i.accountNm.includes(t))
    if (found) result.push(found)
  }
  return result
}

function formatAmount(raw: string): string {
  // DART 는 콤마 포함 string. 음수는 "-1,234" 또는 "(1,234)" 형식
  const cleaned = raw.replace(/,/g, '').replace(/[()]/g, '')
  const num = Number(cleaned)
  if (Number.isNaN(num)) return raw
  const isNegative = /^[-(]/.test(raw)
  const abs = Math.abs(num)
  let display: string
  if (abs >= 1_000_000_000_000) display = `${(abs / 1_000_000_000_000).toFixed(1)}조`
  else if (abs >= 100_000_000) display = `${Math.round(abs / 100_000_000).toLocaleString('ko')}억`
  else if (abs >= 10_000) display = `${Math.round(abs / 10_000).toLocaleString('ko')}만`
  else display = abs.toLocaleString('ko')
  return isNegative ? `-${display}` : display
}
