import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { PlatformBadges } from '@/components/admin/PlatformBadges'
import { formatShare } from '@/utils/shareFormat'
import {
  getAdminReach,
  REACH_STAGES,
  STAGE_LABEL,
  type ReachRow,
  type ReachStage,
} from '@/api/adminReach'

/**
 * `/ops/reach` — 도달 현황.
 *
 * 관측계획 0단계(`observation-plan-2026-08`)를 **반복 가능하게** 만든 화면이다.
 * 그전에는 `/ops/users` 에서 한 명씩 클릭해 수동으로 셌다.
 *
 * 🔴 화면에 **한계를 같이 적는다.** 이 표만 보고 *"자소서를 아무도 안 쓴다"* 로 결론내면
 * 모바일이라 못 쓴 사람과 데스크탑에서 안 쓴 사람이 섞인다. 그래서 데스크탑 축을 분리하고,
 * (a)/(b) 판정에는 Clarity 가 여전히 필요하다는 것도 화면에 남긴다.
 */

/**
 * 단계 색 — **뱃지와 막대가 같은 맵에서 나온다.**
 *
 * 표의 뱃지와 위 퍼널의 막대가 다른 색이면 두 블록을 나란히 못 읽는다. 한 곳에 묶어두면
 * 색을 바꿔도 둘이 어긋나지 않는다.
 *
 * 색은 상태가 아니라 **분류**다 (성공/경고 아님) — `PlatformBadges` 와 같은 취급.
 * 다만 마지막 단계만 brand(sage) 를 쓴다: 이 화면이 궁극적으로 보려는 도착점이라서다.
 * `signup` 은 분모(=항상 100%)라 중립 회색으로 둔다 — 색을 주면 성취처럼 읽힌다.
 */
const STAGE_STYLE: Record<ReachStage, { badge: string; bar: string }> = {
  signup: { badge: 'text-text-tertiary bg-card border-line', bar: 'bg-text-quaternary/40' },
  // accent(coral) — DESIGN.md 가 「카테고리 강조」로 허용하는 쓰임. 나머지 6색과 겹치지 않는다
  tour_completed: { badge: 'text-accent bg-accent/10 border-accent/25', bar: 'bg-accent/60' },
  card: { badge: 'text-info bg-info/10 border-info/30', bar: 'bg-info/60' },
  activity: { badge: 'text-violet bg-violet/10 border-violet/30', bar: 'bg-violet/60' },
  coverletter_question: {
    badge: 'text-warning bg-warning/10 border-warning/30',
    bar: 'bg-warning/60',
  },
  coverletter_answer: {
    badge: 'text-success bg-success/10 border-success/30',
    bar: 'bg-success/60',
  },
  coverletter_ai: { badge: 'text-brand bg-brand/15 border-brand/30', bar: 'bg-brand/60' },
}

/**
 * 🔴 `STAGE_STYLE[stage]` 를 직접 인덱싱하면 `stage` 가 `'constructor'`·`'__proto__'` 일 때
 * **`Object.prototype` 값이 나온다** (실검 확인, CWE-1321). 크래시는 안 나지만
 * `className` 에 `undefined` 가 섞이고 라벨이 빈칸이 된다 — 조용히 깨지는 쪽이라 더 나쁘다.
 * 서버가 주는 값이라 지금은 도달 불가지만, 값 하나로 막을 수 있는 것을 신뢰에 맡기지 않는다.
 */
function stageStyle(stage: ReachStage) {
  // Object.hasOwn 금지 — ES2022, iOS 15.4 미만 WebKit 크래시 (routeMeta.ts 참조)
  const has = Object.prototype.hasOwnProperty.call(STAGE_STYLE, stage)
  return has ? STAGE_STYLE[stage] : STAGE_STYLE.signup
}

function StageBadge({ stage }: { stage: ReachStage }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap ${stageStyle(stage).badge}`}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  )
}

/** 0 은 흐리게 — 훑을 때 "있는 것" 만 눈에 들어오게 한다 */
function Count({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-text-quaternary">0</span>
  return (
    <span className="text-text-secondary">
      {value.toLocaleString()}
      {suffix && <span className="text-text-quaternary">{suffix}</span>}
    </span>
  )
}

export function OpsReach() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'reach'],
    queryFn: getAdminReach,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          to="/ops"
          className="text-text-quaternary hover:text-text-tertiary text-sm transition-colors"
        >
          ← 관리자
        </Link>
        <span className="text-text-faint">/</span>
        <h1 className="text-lg font-bold text-text-primary">도달 현황</h1>
        {data && (
          <span className="ml-auto text-xs text-text-quaternary bg-card border border-line px-2.5 py-1 rounded-full">
            총 {data.totalUsers.toLocaleString()}명
            {data.excludedAdmins > 0 && ` · 관리자 ${data.excludedAdmins}명 제외`}
          </span>
        )}
      </div>

      {isError ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          도달 현황을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      ) : isLoading || !data ? (
        <ReachSkeleton />
      ) : data.totalUsers === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-tertiary text-sm">아직 가입한 회원이 없어요.</p>
          <p className="text-text-quaternary text-xs mt-1">
            첫 가입이 생기면 여기에 도달 단계가 쌓입니다.
          </p>
        </div>
      ) : (
        <>
          <StageFunnel data={data} />
          <TourDropOffTable rows={data.tourDropOff ?? []} />
          <DesktopAxis data={data} />
          <ReachTable
            rows={data.rows}
            truncated={data.truncated}
            total={data.totalUsers}
            onSelect={(id) => navigate(`/ops/users/${id}`)}
          />
          <ReadingNotes excludedAdmins={data.excludedAdmins} />
        </>
      )}
    </div>
  )
}

/** ① 단계별 도달 인원 — 누적 기준. **% 는 쓰지 않는다** (`formatShare` 가 분모를 보고 결정) */
function StageFunnel({ data }: { data: { stageCounts: Record<ReachStage, number>; totalUsers: number } }) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-text-tertiary font-semibold">단계별 도달 인원</p>
        <span className="text-[10px] text-text-quaternary bg-card px-1.5 py-0.5 rounded">
          누적 · 가입 이후 전체 기간
        </span>
      </div>
      <div className="space-y-2">
        {REACH_STAGES.map((stage) => {
          const value = data.stageCounts[stage] ?? 0
          const width =
            data.totalUsers > 0 ? Math.max((value / data.totalUsers) * 100, 2) : 0
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary w-28 shrink-0">
                {STAGE_LABEL[stage]}
              </span>
              <div className="flex-1 h-5 bg-card rounded overflow-hidden">
                <div
                  className={`h-full rounded ${stageStyle(stage).bar}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-text-secondary w-28 text-right">
                {formatShare(value, data.totalUsers)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-sm text-text-quaternary mt-3">
        각 단계는 <strong className="text-text-tertiary">독립 판정</strong>이다 — 활동일지는 별도 메뉴라
        카드 없이도 쓸 수 있어, 위 숫자는 위아래로 단조롭지 않을 수 있다.
      </p>
    </div>
  )
}

/**
 * ①-b 투어 이탈 장면 — **완료율 한 숫자로는 못 보는 것.**
 *
 * 「투어 완료 N명」만 있으면 6장 중 **어디가 지루한지**를 영영 모른다. 나간 장면이 한쪽에
 * 몰려 있으면 그 장을 고치면 되고, 고르게 흩어져 있으면 길이 자체가 문제다.
 *
 * 🔴 **이탈이 0이면 블록째 없앤다** — 「이탈 없음」을 큰 표로 말하면 빈 패널이 된다.
 * 아직 투어를 만난 사람이 없는 초기에도 같은 이유로 아무것도 그리지 않는다.
 */
function TourDropOffTable({ rows }: { rows: { step: number; count: number }[] }) {
  if (rows.length === 0) return null
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-text-tertiary font-semibold">투어 이탈 장면</p>
        <span className="text-[10px] text-text-quaternary bg-card px-1.5 py-0.5 rounded">
          투어를 만났지만 안 끝낸 {total.toLocaleString()}명
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left py-2 pr-4 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider whitespace-nowrap">
                장면
              </th>
              <th className="text-left py-2 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider whitespace-nowrap">
                이탈 인원
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ step, count }) => (
              <tr key={step} className="border-b border-line last:border-0">
                <td className="py-2 pr-4 text-xs text-text-tertiary tabular-nums whitespace-nowrap">
                  {step}장
                </td>
                <td className="py-2 text-xs tabular-nums">
                  <Count value={count} suffix="명" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-text-quaternary mt-3">
        🔴 <strong className="text-text-tertiary">완료자는 여기 없다.</strong> 마지막 장까지
        간 사람은 「투어 완료」 단계로 세고, 이 표는 <em>도중에 나간 사람</em>만 담는다.
        이탈이 없는 장면은 행 자체를 만들지 않는다.
      </p>
    </div>
  )
}

/** ② 데스크탑 축 — 자소서는 데스크탑 웹 전용이라 분모가 다르다 */
function DesktopAxis({
  data,
}: {
  data: {
    desktopAxis: { confirmed: number; coverletterAnswer: number; coverletterAi: number }
    stageCounts: Record<ReachStage, number>
    totalUsers: number
  }
}) {
  const { confirmed, coverletterAnswer, coverletterAi } = data.desktopAxis
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-text-tertiary font-semibold">데스크탑 웹 확인된 사용자 기준</p>
        <span className="text-[10px] text-text-quaternary bg-card px-1.5 py-0.5 rounded">
          자소서·AI 는 데스크탑 전용
        </span>
      </div>

      {confirmed === 0 ? (
        <p className="text-xs text-text-tertiary">
          아직 데스크탑 웹이 확인된 사용자가 없어요. 이 축은 표본이 쌓여야 의미가 생깁니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] text-text-quaternary">데스크탑 확인</p>
            <p className="text-xl font-bold tabular-nums text-text-primary">
              {formatShare(confirmed, data.totalUsers)}
            </p>
            <p className="text-[11px] text-text-quaternary">아래 두 칸의 분모</p>
          </div>
          <div>
            <p className="text-[11px] text-text-quaternary">자소서 답변</p>
            <p className="text-xl font-bold tabular-nums text-success">
              {formatShare(coverletterAnswer, confirmed)}
            </p>
            <p className="text-[11px] text-text-quaternary">
              전체 기준 {formatShare(data.stageCounts.coverletter_answer ?? 0, data.totalUsers)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-text-quaternary">자소서 AI</p>
            <p className="text-xl font-bold tabular-nums text-brand">
              {formatShare(coverletterAi, confirmed)}
            </p>
            <p className="text-[11px] text-text-quaternary">
              전체 기준 {formatShare(data.stageCounts.coverletter_ai ?? 0, data.totalUsers)}
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-text-quaternary mt-3">
        🔴 <strong className="text-text-tertiary">초기에는 이 분모가 작다.</strong> 스탬프는 소급이
        안 되고, 자소서를 쓴 이력이 있는 사용자만 과거로 채웠다 — 즉{' '}
        <strong className="text-text-tertiary">
          "데스크탑에 왔지만 자소서를 안 쓴" 사람은 아직 안 잡힌다.
        </strong>{' '}
        표의 데스크탑 열이 <span className="text-text-tertiary">미확인</span>인 것은{' '}
        <em>모바일이라는 뜻이 아니다.</em>
      </p>
    </div>
  )
}

/**
 * 표 컬럼 — **폭에 따라 접는다.**
 *
 * 🔴 admin 은 `MobileNav` 에 관리자 탭이 있어 **휴대폰에서도 열린다.** 10열을 전부 살리면
 * 320px 에서 가로 스크롤이 화면 폭의 3배가 된다. 형제 화면 `OpsUsers` 와 같은 방식으로 접되,
 * **가입일·닉네임·도달 단계**는 어느 폭에서도 남긴다 — 그 셋만 있어도 "누가 어디까지" 는 읽힌다
 * (도달 단계 뱃지가 나머지 수치를 요약한다).
 */
const COLUMNS: { label: string; cls: string }[] = [
  { label: '가입일', cls: '' },
  { label: '닉네임', cls: '' },
  { label: '사용 환경', cls: 'hidden md:table-cell' },
  { label: '데스크탑', cls: 'hidden lg:table-cell' },
  { label: '카드', cls: 'hidden sm:table-cell' },
  { label: '활동일지', cls: 'hidden md:table-cell' },
  { label: '자소서 문항/답변', cls: 'hidden lg:table-cell' },
  { label: 'AI 시도/성공', cls: 'hidden lg:table-cell' },
  { label: '최근접속', cls: 'hidden xl:table-cell' },
  { label: '도달 단계', cls: '' },
]

/** ③ 전수 표 — 1인 1행 */
function ReachTable({
  rows,
  truncated,
  total,
  onSelect,
}: {
  rows: ReachRow[]
  truncated: boolean
  total: number
  onSelect: (userId: string) => void
}) {
  return (
    <div className="mb-4">
      <div className="overflow-x-auto bg-surface-2 rounded-xl border border-line shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-card">
              {COLUMNS.map(({ label, cls }) => (
                <th
                  key={label}
                  className={`text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider whitespace-nowrap ${cls ?? ''}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.userId}
                tabIndex={0}
                role="button"
                aria-label={`${row.nickname} 상세 보기`}
                onClick={() => onSelect(row.userId)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && onSelect(row.userId)
                }
                className="border-b border-line last:border-0 hover:bg-card cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand/40"
              >
                <td className="px-4 py-3 text-xs text-text-tertiary tabular-nums whitespace-nowrap">
                  {dayjs(row.signupDate).format('YY.MM.DD')}
                </td>
                <td className="px-4 py-3 text-text-primary max-w-[160px]">
                  <span className="block truncate">{row.nickname}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <PlatformBadges platform={row.platform} compact />
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap hidden lg:table-cell">
                  {row.desktopSeenAt ? (
                    <span className="text-text-secondary tabular-nums">
                      {dayjs(row.desktopSeenAt).format('YY.MM.DD')}
                    </span>
                  ) : (
                    <span className="text-text-quaternary" title="스탬프 도입 전이거나 근거가 없음 — 모바일이라는 뜻이 아님">
                      미확인
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap hidden sm:table-cell">
                  <Count value={row.cards} />
                  {row.sampleCards > 0 && (
                    <span className="text-text-quaternary" title="온보딩이 자동 생성한 샘플 카드 (도달 판정에서 제외)">
                      {' '}
                      +샘플 {row.sampleCards}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums hidden md:table-cell">
                  <Count value={row.activityLogs} />
                </td>
                <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap hidden lg:table-cell">
                  <Count value={row.coverletterQuestions} suffix="문항" />
                  <span className="text-text-faint"> / </span>
                  <Count value={row.coverletterAnswers} suffix="답변" />
                </td>
                <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap hidden lg:table-cell">
                  <span title="시도 (차단·실패 포함)">
                    <Count value={row.aiAttempts} />
                  </span>
                  <span className="text-text-faint"> / </span>
                  <span title="성공">
                    <Count value={row.aiSuccesses} />
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-text-tertiary tabular-nums whitespace-nowrap hidden xl:table-cell">
                  {row.lastActiveAt ? dayjs(row.lastActiveAt).format('YY.MM.DD') : '—'}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={row.stage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="text-sm text-text-quaternary mt-2">
          최근 가입 {rows.length.toLocaleString()}명만 표시했어요 (전체 {total.toLocaleString()}명).
          위의 단계별 인원은 <strong className="text-text-tertiary">전체 기준</strong>입니다.
        </p>
      )}
    </div>
  )
}

/** ④ 읽는 법 — 이 화면이 답하지 못하는 것을 화면에 남긴다 */
function ReadingNotes({ excludedAdmins }: { excludedAdmins: number }) {
  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <p className="text-xs text-text-tertiary font-semibold mb-2.5">읽는 법</p>
      <ul className="space-y-1.5 text-sm text-text-quaternary leading-relaxed">
        <li>
          <strong className="text-text-tertiary">Activation 섹션과 숫자가 다르다.</strong> 그쪽은
          "가입 직후 제대로 시작했나"(당일·3일·7일), 여기는 "지금까지 어디까지 갔나"(누적)를 본다.
        </li>
        <li>
          🔴 <strong className="text-text-tertiary">이 표로는 "모른다"와 "알지만 안 쓴다"를 못 가른다.</strong>{' '}
          자소서 탭을 눌렀지만 아무것도 안 한 흔적은 DB에 남지 않는다 — 그 판정에는 Clarity
          리플레이가 여전히 필요하다.
        </li>
        <li>
          온보딩이 자동 생성한 <strong className="text-text-tertiary">샘플 카드는 도달 판정에서 제외</strong>한다.
          안 그러면 온보딩을 마친 사람 전원이 "카드" 단계를 자동 통과한다.
        </li>
        <li>
          🔴 <strong className="text-text-tertiary">"투어 완료"는 소급되지 않는다.</strong> 투어가
          생기기 전에 가입한 사람은 끝낼 기회 자체가 없었으므로 이 단계에서 빠진다 — 낮은 숫자를
          이탈로 읽으면 안 된다. 도입 이후 가입 코호트끼리만 비교한다.
        </li>
        <li>
          AI는 <strong className="text-text-tertiary">시도와 성공을 나눠</strong> 센다 — "눌렀는데
          막혔다"와 "누른 적 없다"는 다른 신호다. 자소서 계열 기능만 세며 노트 요약 등은 빠진다.
        </li>
        <li>
          비율은 <strong className="text-text-tertiary">분모가 30 미만이면 % 대신 실수</strong>로 적는다.
          소표본 백분율은 정확해 보이는 만큼 위험하다.
        </li>
        {excludedAdmins > 0 && (
          <li>
            관리자 계정 {excludedAdmins}명은 제외했다 — 운영자 본인의 사용을 사용자 행동으로 읽지
            않기 위해서다.
          </li>
        )}
      </ul>
    </div>
  )
}

function ReachSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-line rounded-xl p-5">
        <div className="h-3 w-24 rounded bg-card animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-28 rounded bg-card animate-pulse shrink-0" />
              <div className="flex-1 h-5 rounded bg-card animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {[70, 110, 60, 70, 50, 50, 90, 50, 70, 80].map((w, j) => (
                  <td key={j} className="px-4 py-3.5">
                    <div className="h-3 rounded bg-card animate-pulse" style={{ width: w }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
