import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDateTime } from '@/utils/datetime'
import { toast } from '@/stores/toastStore'
import {
  cellCount,
  FEATURE_USAGE_QUERY_KEY,
  getAdminFeatureUsage,
  type FeatureStat,
  type FeatureUsageData,
  type FeatureUsageUserRow,
  type RetentionRow,
} from '@/api/adminFeatureUsage'

/**
 * `/ops/feature-usage` — 기능 사용 실태.
 *
 * ## 왜 독립 페이지인가
 *
 * `/ops/reach` 는 *"가입 후 어디까지 갔나"*(자소서 퍼널 한 줄), `/ops/card-fields` 는
 * *"카드에 무엇을 채우나"*(카드 한 종류)를 본다. **「공부 노트는 아무도 안 쓰나」**·
 * **「내정보를 채운 사람이 자소서도 쓰나」** 는 두 화면 어디에도 답이 없었다.
 * 질문이 다르면 화면을 나누고, `/ops` 첫 화면에서 **이름으로 찾을 수 있게** 한다.
 *
 * ## 🔴 % 를 쓰지 않는다 (형제 화면과 다른 점)
 *
 * `OpsReach` 는 `formatShare` 로 분모가 30 이상이면 % 로 넘어간다. 여기서는 **끝까지
 * 머릿수**다 — 이 화면은 18개 기능을 나란히 놓고 **격차**를 보는 곳이라, % 로 접으면
 * 「40% vs 45%」처럼 노이즈가 신호처럼 보인다. N 이 작을 때 사람 수는 거짓말을 못 한다.
 */

/** 키보드 포커스 링 — 프로젝트 공통 패턴 (`CardFieldsSection` 과 동일) */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

/** 0 은 흐리게 — 훑을 때 "있는 것" 만 눈에 들어오게 한다 (`OpsReach.Count` 와 같은 규칙) */
function Count({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-text-quaternary">0</span>
  return (
    <span className="text-text-secondary">
      {value.toLocaleString()}
      {suffix && <span className="text-text-quaternary">{suffix}</span>}
    </span>
  )
}

/**
 * 🔴 **`null` 은 0 이 아니다.** 「잴 수 없음」·「아직 안 온 주」를 0 으로 그리면
 * *"아무도 안 했다"* 로 읽힌다 — 이 화면에서 가장 비싼 오독이다.
 */
function Unknown({ reason }: { reason: string }) {
  return (
    <span className="text-text-faint" title={reason}>
      —
    </span>
  )
}

/**
 * 집계 시각 + 새로고침.
 *
 * 시각을 **절대 시각**으로 적는다 — "3분 전" 은 렌더 시점에 계산되고 스스로 늙지 않아서,
 * 탭을 열어둔 채 10분이 지나도 여전히 "3분 전" 이라고 말한다 (`CardFieldsSection` 과 같은 판단).
 */
function FreshnessBar({ generatedAt }: { generatedAt: string }) {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      // 🔴 `refetch()` 가 아니라 `fetchQuery` — 서버 5분 캐시까지 뚫어야 의미가 있다
      await qc.fetchQuery({
        queryKey: FEATURE_USAGE_QUERY_KEY,
        queryFn: () => getAdminFeatureUsage(true),
        staleTime: 0,
      })
    } catch {
      // 실패해도 화면에는 직전 값이 그대로 남는다 — 그게 위험하므로 반드시 알린다.
      // (catch 를 빼면 rejection 이 unhandled 로 새어 Sentry 에 크래시로 잡힌다)
      toast.error('새로고침에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <span
        className="text-[11px] text-text-quaternary tabular-nums"
        title="서버가 이 숫자를 집계한 시각"
        aria-live="polite"
      >
        {formatDateTime(generatedAt)} (KST) 집계
      </span>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        title="5분 캐시를 건너뛰고 다시 집계"
        className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${FOCUS} ${
          refreshing
            ? 'text-text-quaternary border-line bg-card cursor-not-allowed'
            : 'text-text-tertiary border-line bg-card hover:border-line-strong hover:text-text-secondary'
        }`}
      >
        {refreshing ? '집계 중…' : '새로고침'}
      </button>
    </>
  )
}

/**
 * 원본 JSON 복사 — **이 화면을 읽는 사람이 둘**이라서 필요하다.
 *
 * 지표는 CEO 가 보고 판단하지만, 그 판단을 돕는 쪽(Claude)은 운영 자격증명이 없다.
 * 이 버튼이 없으면 18×N 매트릭스를 **눈으로 읽어 옮겨 적는 것**이 유일한 경로가 된다.
 *
 * 🔴 실패하면 토스트로 끝내지 않고 **원문을 펼친다** — 여기서 복사하는 JSON 은
 * 화면에 다 나오지 않는 값이라 "화면을 보면 된다" 는 폴백이 성립하지 않는다.
 */
function CopyJsonButton({ data }: { data: FeatureUsageData }) {
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)

  const handleCopy = async () => {
    if (copied) return
    const text = JSON.stringify(data, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFallback(null)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setFallback(text)
      toast.error('복사에 실패했어요. 아래 원문을 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        title="집계 원본(JSON)을 클립보드로 복사"
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${FOCUS} ${
          copied
            ? 'text-success border-success/30 bg-success/10'
            : 'text-text-tertiary border-line bg-card hover:border-line-strong hover:text-text-secondary'
        }`}
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path
                d="M2 6.5l3 3 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            복사됨
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <rect
                x="4.5"
                y="1"
                width="7.5"
                height="9"
                rx="1.2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M1 4.5h3M1 4.5v7.5h7.5V12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            JSON 복사
          </>
        )}
      </button>

      {fallback && (
        <pre className="w-full mt-2 max-h-60 overflow-auto overscroll-contain bg-card border border-line rounded-lg p-3 text-[10px] leading-relaxed text-text-secondary select-all">
          {fallback}
        </pre>
      )}
    </>
  )
}

/** 카드 껍데기 — `CardFieldsSection.Block` 과 리듬을 맞춘다 */
function Block({
  title,
  tag,
  children,
  note,
}: {
  title: string
  tag?: string
  children: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <p className="text-xs text-text-tertiary font-semibold">{title}</p>
        {tag && (
          <span className="text-[10px] text-text-quaternary bg-card px-1.5 py-0.5 rounded">
            {tag}
          </span>
        )}
      </div>
      {children}
      {note && <div className="text-sm text-text-quaternary mt-3">{note}</div>}
    </div>
  )
}

const TH =
  'text-left py-2 pr-4 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider whitespace-nowrap'

/**
 * ① 잔존 — 가입 주차(KST 월요일)별로 N주 뒤에 다시 왔나.
 *
 * 🔴 **아직 오지 않은 주는 「—」다.** 이번 주 가입자의 1주차를 0 으로 적으면
 * 「아무도 안 돌아왔다」로 읽히는데, 사실은 그 주가 아직 시작도 안 했다.
 */
function RetentionBlock({ rows }: { rows: RetentionRow[] }) {
  if (rows.length === 0) return null

  return (
    <Block
      title="가입 주차별 잔존"
      tag="user_daily_visits · KST 월요일 기준"
      note={
        <>
          「—」는 <strong className="text-text-tertiary">아직 오지 않은 주</strong>다 — 0
          (아무도 안 돌아옴)과 다르다. 한 주라도 방문 기록이 있으면 1명으로 센다(방문 횟수가
          아니다).
        </>
      }
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={TH}>가입 주차</th>
              <th className={TH}>가입</th>
              <th className={TH}>1주 뒤</th>
              <th className={TH}>2주 뒤</th>
              <th className={TH}>3주 뒤</th>
              <th className={TH}>4주 뒤</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohortWeek} className="border-b border-line last:border-0">
                <td className="py-2 pr-4 text-xs text-text-tertiary tabular-nums whitespace-nowrap">
                  {r.cohortWeek}
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums">
                  <Count value={r.size} suffix="명" />
                </td>
                {[r.week1, r.week2, r.week3, r.week4].map((w, i) => (
                  <td key={i} className="py-2 pr-4 text-xs tabular-nums">
                    {w === null ? (
                      <Unknown reason="아직 오지 않은 주 (0명이라는 뜻이 아님)" />
                    ) : (
                      <Count value={w} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  )
}

/** ② 기능별 사용 통계 — 18군을 나란히 놓고 **격차**를 본다 */
function FeatureTable({
  features,
  totalUsers,
}: {
  features: FeatureStat[]
  totalUsers: number
}) {
  return (
    <Block
      title="기능별 사용 인원"
      tag="누적 · 관리자 제외"
      note={
        <>
          「깊이」는 <strong className="text-text-tertiary">기능마다 단위가 다르다</strong> —
          세로로 비교하면 안 된다. 「2일 이상」은 서로 다른 KST 날짜에 2번 이상 만든
          사람이고, 「—」는 그 기능에 생성 시각 컬럼이 없어 <em>잴 수 없다</em>는 뜻이다
          (기능 이름에 마우스를 올리면 날짜 축이 나온다).
        </>
      }
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={TH}>기능</th>
              <th className={TH}>쓴 사람</th>
              <th className={TH}>안 씀</th>
              <th className={`${TH} hidden sm:table-cell`}>1회</th>
              <th className={`${TH} hidden sm:table-cell`}>2~4회</th>
              <th className={`${TH} hidden sm:table-cell`}>5회+</th>
              <th className={`${TH} hidden md:table-cell`}>2일 이상</th>
              <th className={`${TH} hidden md:table-cell`}>최근 7일</th>
              <th className={`${TH} hidden lg:table-cell`}>깊이 (중앙값)</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.key} className="border-b border-line last:border-0">
                <td
                  className="py-2 pr-4 text-xs text-text-secondary whitespace-nowrap"
                  title={`날짜 축: ${f.dateBasis}`}
                >
                  {f.label}
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums">
                  <Count value={f.usersEver} suffix="명" />
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums">
                  <Count value={Math.max(totalUsers - f.usersEver, 0)} suffix="명" />
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden sm:table-cell">
                  <Count value={f.buckets.one} />
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden sm:table-cell">
                  <Count value={f.buckets.twoToFour} />
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden sm:table-cell">
                  <Count value={f.buckets.fivePlus} />
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden md:table-cell">
                  {f.usersMultiDay === null ? (
                    <Unknown reason={`잴 수 없음 — ${f.dateBasis}`} />
                  ) : (
                    <Count value={f.usersMultiDay} />
                  )}
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden md:table-cell">
                  {f.usersLast7d === null ? (
                    <Unknown reason={`잴 수 없음 — ${f.dateBasis}`} />
                  ) : (
                    <Count value={f.usersLast7d} />
                  )}
                </td>
                <td className="py-2 pr-4 text-xs tabular-nums hidden lg:table-cell whitespace-nowrap">
                  {f.depthMedian === null ? (
                    <Unknown reason="쓴 사람이 없어 잴 값이 없음" />
                  ) : (
                    <span className="text-text-secondary">
                      {f.depthMedian.toLocaleString()}
                      <span className="text-text-quaternary"> {f.depthUnit}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  )
}

/**
 * ③ 유저 × 기능 매트릭스.
 *
 * 🔴 **가로 스크롤이 전제다.** 18개 기능을 접어 넣을 방법이 없고, 접으면 이 화면이
 * 답하려는 「이 사람은 무엇을 쓰나」가 사라진다. 대신 닉네임 열을 고정(sticky)해서
 * 스크롤 도중 **누구 행인지 잃지 않게** 한다.
 */
function UsageMatrix({
  features,
  users,
  onSelect,
}: {
  features: FeatureStat[]
  users: FeatureUsageUserRow[]
  onSelect: (userId: string) => void
}) {
  return (
    <Block
      title="유저 × 기능"
      tag={`${users.length.toLocaleString()}명 · 가로 스크롤`}
      note={
        <>
          숫자는 <strong className="text-text-tertiary">사용 횟수</strong>다. 행을 누르면 회원
          상세로 이동한다.
        </>
      }
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={`${TH} sticky left-0 bg-surface-2 z-10`}>닉네임</th>
              <th className={TH}>가입</th>
              {features.map((f) => (
                <th key={f.key} className={TH} title={f.label}>
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.userId}
                role="button"
                tabIndex={0}
                aria-label={`${u.nickname} 상세 보기`}
                onClick={() => onSelect(u.userId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(u.userId)
                  }
                }}
                className={`border-b border-line last:border-0 cursor-pointer hover:bg-card focus:outline-none focus:ring-2 focus:ring-brand/60 ${FOCUS}`}
              >
                <td className="py-2 pr-4 text-xs text-text-secondary whitespace-nowrap sticky left-0 bg-surface-2 z-10">
                  {u.nickname}
                </td>
                <td className="py-2 pr-4 text-xs text-text-quaternary tabular-nums whitespace-nowrap">
                  {u.joinedAt.slice(0, 10)}
                </td>
                {features.map((f) => {
                  const n = cellCount(u, f.key)
                  return (
                    <td
                      key={f.key}
                      className="py-2 pr-4 text-xs tabular-nums"
                      title={`${f.label} ${n.toLocaleString()}회`}
                    >
                      {n === 0 ? (
                        <span className="text-text-faint">·</span>
                      ) : (
                        <span className="text-text-secondary">{n.toLocaleString()}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  )
}

/**
 * ④ 읽는 규율 — **이 화면이 답하지 못하는 것**을 화면에서 지우지 않는다.
 *
 * 이게 없으면 「공부 노트 3명」 한 줄로 기능을 접는 결정이 나온다. 숫자는 무엇이
 * 일어났는지만 말하고, 왜인지는 말하지 않는다.
 */
function ReadingLimits({ excludedAdmins }: { excludedAdmins: number }) {
  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <p className="text-xs text-text-tertiary font-semibold mb-3">읽는 규율 — 3한계</p>
      <ol className="space-y-2 text-sm text-text-quaternary list-decimal pl-5">
        <li>
          <strong className="text-text-tertiary">숫자는 「왜」를 모른다.</strong> 안 쓴 게
          몰라서인지 알고도 안 쓰는 건지 DB 에는 안 남는다 — 인터뷰·Clarity 리플레이와 항상
          짝으로 읽는다.
        </li>
        <li>
          <strong className="text-text-tertiary">N 이 작아 미세 비교는 노이즈다.</strong> 60명
          안팎에서 「3명 vs 5명」은 신호가 아니다. <em>큰 격차</em>만 신호로 본다.
        </li>
        <li>
          <strong className="text-text-tertiary">읽기만 하는 사용은 안 잡힌다.</strong> 회사
          조사 열람·공고 요건 읽기·공고 허브 탐색은 행을 만들지 않는다. 여기서 0 인 기능이
          「아무도 안 본다」는 뜻이 아니다.
        </li>
      </ol>
      <p className="text-[11px] text-text-quaternary mt-3">
        관리자 {excludedAdmins.toLocaleString()}명의 데이터는 모든 집계·매트릭스에서 제외된다.
        AI 호출 통계는 여기서 만들지 않는다 — <Link to="/ops/ai-usage" className="text-brand hover:underline">AI 사용량</Link> 이 유일한 출처다.
      </p>
    </div>
  )
}

function FeatureUsageSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface-2 border border-line rounded-xl p-5">
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-32 bg-card rounded" />
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="h-4 bg-card rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function OpsFeatureUsage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: FEATURE_USAGE_QUERY_KEY,
    queryFn: () => getAdminFeatureUsage(),
    // 서버가 이미 5분 캐시를 들고 있다 — 프론트까지 잡으면 두 캐시가 겹쳐 최대 10분 낡는다
    staleTime: 0,
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <Link
          to="/ops"
          className="text-text-quaternary hover:text-text-tertiary text-sm transition-colors"
        >
          ← 관리자
        </Link>
        <span className="text-text-faint">/</span>
        <h1 className="text-lg font-bold text-text-primary">기능 사용 실태</h1>
        {data && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-text-quaternary bg-card border border-line px-2.5 py-1 rounded-full">
              총 {data.totalUsers.toLocaleString()}명
              {data.excludedAdmins > 0 && ` · 관리자 ${data.excludedAdmins}명 제외`}
            </span>
            <FreshnessBar generatedAt={data.generatedAt} />
            <CopyJsonButton data={data} />
          </div>
        )}
      </div>

      {isError ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-center">
          <p className="text-text-tertiary text-sm">기능 사용 실태를 불러오지 못했어요.</p>
          <p className="text-text-quaternary text-xs mt-1">잠시 후 다시 시도해주세요.</p>
        </div>
      ) : isLoading || !data ? (
        <FeatureUsageSkeleton />
      ) : data.totalUsers === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-center">
          <p className="text-text-tertiary text-sm">아직 가입한 회원이 없어요.</p>
          <p className="text-text-quaternary text-xs mt-1">
            첫 가입이 생기면 여기에 기능별 사용 인원이 쌓입니다.
          </p>
        </div>
      ) : (
        <>
          <RetentionBlock rows={data.retention} />
          <FeatureTable features={data.features} totalUsers={data.totalUsers} />
          <UsageMatrix
            features={data.features}
            users={data.users}
            onSelect={(id) => navigate(`/ops/users/${id}`)}
          />
          <ReadingLimits excludedAdmins={data.excludedAdmins} />
        </>
      )}
    </div>
  )
}
