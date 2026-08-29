import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatShare } from '@/utils/shareFormat'
import { formatDateTime } from '@/utils/datetime'
import { toast } from '@/stores/toastStore'
import {
  getAdminCardFields,
  CATEGORY_VOCAB_LABEL,
  type CardFieldsData,
  type CategoryVocab,
} from '@/api/adminCardFields'

/**
 * 카드 입력 실태 — **사용자가 카드에 무엇을 실제로 채우는가**.
 *
 * `/ops/reach` 하단에 붙지만 **자기 쿼리를 따로 들고 있다.** 한쪽이 실패해도 다른 쪽은
 * 그대로 읽히게 하려는 것이고, 그래서 로딩·에러·빈 상태도 자기 것을 가진다.
 *
 * ## 🔴 이 화면의 설계 원칙 — 0 의 두 가지 뜻을 가른다
 *
 * 이 숫자는 제품 결정의 근거가 된다. 그때 가장 비싼 실패는 **틀린 숫자가 아니라 오독을
 * 부르는 표기**다. 특히 `0` 은 두 가지 완전히 다른 뜻을 가진다:
 *
 * - **측정했는데 0** — "아무도 안 적는다" (조치 대상)
 * - **아직 안 쌓임** — 관측 컬럼처럼 도입 직후라 데이터가 없다 (조치 대상 아님)
 *
 * 둘이 화면에서 똑같이 생기면 **없는 문제를 고치러 간다.** 그래서 후자는 문구로 못 박는다.
 *
 * 비율은 전부 `formatShare` 를 통과시킨다 — 분모가 30 미만이면 % 대신 실수로 적는 규칙이
 * 거기 한 곳에 있어서, 사용자가 늘면 이 화면과 `OpsReach` 가 **함께** % 로 전환된다.
 */

/**
 * 필드별 색 — **상태가 아니라 분류**다 (`STAGE_STYLE` 과 같은 취급).
 * 채움률이 낮다고 빨강을 쓰지 않는다. 낮은 것이 곧 나쁜 것인지가 이 화면이 답하려는
 * 질문이고, 색으로 미리 답해버리면 관측이 아니라 주장이 된다.
 */
const FIELD_META: { key: keyof CardFieldsData['fields']; label: string; bar: string }[] = [
  { key: 'jobTitle', label: '지원 직무', bar: 'bg-info/60' },
  { key: 'jobCategory', label: '직군', bar: 'bg-violet/60' },
  { key: 'jobUrl', label: '공고 URL', bar: 'bg-warning/60' },
  { key: 'memo', label: '메모', bar: 'bg-text-quaternary/40' },
]

/**
 * 어휘 갈래 색 — `freeform_repeated` 만 warning 이다.
 * 셋 중 **유일하게 조치가 따라붙는 갈래**라서다 (목록에 없는 직군을 여러 사람이 적고 있다면
 * 그건 목록의 구멍이고, 그 값이 곧 후보다). 나머지 둘은 중립 분류다.
 */
const VOCAB_STYLE: Record<CategoryVocab, { chip: string; bar: string }> = {
  known: { chip: 'text-info bg-info/10 border-info/30', bar: 'bg-info/60' },
  freeform_repeated: {
    chip: 'text-warning bg-warning/10 border-warning/30',
    bar: 'bg-warning/60',
  },
  freeform_once: {
    chip: 'text-text-tertiary bg-card border-line',
    bar: 'bg-text-quaternary/40',
  },
}

function vocabStyle(vocab: CategoryVocab) {
  // Object.hasOwn 금지 — ES2022, iOS 15.4 미만 WebKit 크래시 (routeMeta.ts 참조)
  const has = Object.prototype.hasOwnProperty.call(VOCAB_STYLE, vocab)
  return has ? VOCAB_STYLE[vocab] : VOCAB_STYLE.freeform_once
}

const QUERY_KEY = ['admin', 'card-fields'] as const

/** 키보드 포커스 링 — 프로젝트 공통 패턴 (`StepBar` 와 동일) */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

/**
 * 집계 시각 + 새로고침.
 *
 * ## 🔴 왜 시각을 **절대 시각**으로 적나
 *
 * "3분 전" 같은 상대 표기는 **렌더 시점에 계산되고 스스로 늙지 않는다.** 탭을 열어둔 채
 * 10분이 지나도 화면은 여전히 "3분 전" 이라고 말한다 — 이 화면이 없애려는 바로 그
 * 「모르는 채로 낡은 값을 보는」 상태를 표기가 되레 만들어낸다.
 * 절대 시각은 틀릴 수가 없다. 상대 표기는 보조로만 붙인다.
 *
 * ## 왜 새로고침 버튼이 필요한가 (실제로 겪은 일)
 *
 * 카드를 만들고 화면을 다시 열었는데 `generatedAt` 이 **글자 하나까지 같았다.**
 * 서버 5분 캐시와 React Query `staleTime` 이 겹쳐서, 두 번 복사해도 같은 스냅샷이 나왔다.
 * 배선은 멀쩡했는데 「안 되는 건가」로 읽혔다 — **「값이 안 변했다」와 「새로 안 읽었다」가
 * 화면에서 똑같이 생긴** 탓이다.
 */
function FreshnessBar({ generatedAt }: { generatedAt: string }) {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      // 🔴 `refetch()` 가 아니라 `fetchQuery` — 서버 캐시까지 뚫어야 의미가 있다.
      //    두 캐시(서버 5분 · React Query staleTime) 중 하나만 뚫으면 같은 값이 또 온다.
      await qc.fetchQuery({
        queryKey: QUERY_KEY,
        queryFn: () => getAdminCardFields(true),
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
      {/*
        🔴 `aria-live` — 새로고침은 **화면 어디에도 이동이 없는** 갱신이라, 없으면
        스크린리더 사용자에게 아무 일도 안 일어난 것과 같다. 값이 바뀌는 지점이
        여기(집계 시각)뿐이므로 이 노드를 알림 영역으로 삼는다.
      */}
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
 * 지표는 CEO 가 보고 판단하지만, 그 판단을 돕는 쪽(Claude)은 **운영에 접근할 자격증명이
 * 없다.** access token 이 `Bearer` 헤더 전용이라 주소창에 API 를 열어 복사할 수도 없다.
 * 그래서 이 버튼이 없으면 숫자를 **눈으로 읽어 옮겨 적는 것**이 유일한 경로가 되고,
 * 그건 관측계획 0단계를 죽였던 바로 그 마찰이다.
 *
 * 🔴 **요약본이 아니라 원본 JSON 을 복사한다.** 화면용으로 다듬은 문장을 복사하면 받는
 * 쪽에서 이미 정보가 깎여 있고, 스크린샷은 숫자를 다시 눈으로 읽어야 해서 오독이 섞인다.
 *
 * 🔴 실패 처리가 `CopyButton`(내정보) 과 다른 이유 — 그쪽은 *"값이 화면에 이미 보이므로
 * 치명적이지 않다"* 가 성립한다. 여기서 복사하는 JSON 은 **화면에 없는 값**이라 그 전제가
 * 깨진다. 그래서 실패하면 토스트로 끝내지 않고 **직접 선택할 수 있게 원문을 펼친다.**
 * (catch 자체를 빼면 rejection 이 unhandled 로 새어 Sentry 에 크래시로 잡힌다 — CHWIPPO-FRONT-6)
 */
function CopyJsonButton({ data }: { data: CardFieldsData }) {
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

/** 카드 껍데기 — `StageFunnel`·`DesktopAxis` 와 리듬을 맞춘다 */
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
      {/*
        🔴 설명문은 **14px**(DESIGN.md 7-b) — 「문장이 3줄 이상 이어지는가」에 걸린다.
        라벨·캡션(「분모 = 스텝이 있는 카드」류)은 같은 규칙의 메타데이터 행이라 11px 를 유지한다.
        판정은 **위치가 아니라 「이게 뭔가」**로 한다.
      */}
      {note && <div className="text-sm text-text-quaternary mt-3">{note}</div>}
    </div>
  )
}

export function CardFieldsSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getAdminCardFields(),
    // 서버가 이미 5분 캐시를 들고 있다. 프론트까지 5분을 잡으면 **두 캐시가 겹쳐**
    // 「방금 것」을 보려 해도 최대 10분 낡은 값이 나온다. 여기선 0 으로 두고
    // 캐시 판단은 서버 한 곳에 맡긴다 — 새로고침 버튼이 그 한 곳을 뚫는다.
    staleTime: 0,
  })

  return (
    <section>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[10px] text-text-quaternary bg-card border border-line px-2 py-0.5 rounded-full">
          사용자가 만든 카드만 · 관리자·샘플 제외
        </span>
        {data && data.cards > 0 && (
          <span className="text-xs text-text-quaternary tabular-nums">
            카드 {data.cards.toLocaleString()}장 · {data.users.toLocaleString()}명
          </span>
        )}
        {data && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <FreshnessBar generatedAt={data.generatedAt} />
            <CopyJsonButton data={data} />
          </div>
        )}
      </div>

      {isError ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-center">
          <p className="text-text-tertiary text-sm">카드 입력 실태를 불러오지 못했어요.</p>
          <p className="text-text-quaternary text-xs mt-1">잠시 후 다시 시도해주세요.</p>
        </div>
      ) : isLoading || !data ? (
        <CardFieldsSkeleton />
      ) : data.cards === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-center">
          <p className="text-text-tertiary text-sm">아직 사용자가 만든 카드가 없어요.</p>
          <p className="text-text-quaternary text-xs mt-1">
            관리자 카드 {data.excluded.adminCards.toLocaleString()}장 · 온보딩 샘플{' '}
            {data.excluded.sampleCards.toLocaleString()}장은 이 집계에서 제외됩니다.
          </p>
        </div>
      ) : (
        <>
          <FieldFillBlock data={data} />
          <JobTitleVarianceBlock data={data} />
          <CategoryVocabBlock data={data} />
          <ProgressBlock data={data} />
          <CompanyMatchBlock data={data} />
          <ObservabilityBlock data={data} />
          <CardFieldsNotes data={data} />
        </>
      )}
    </section>
  )
}

/** ① 필드 채움 — 「직군 칩 30개를 없애도 되나」의 근거 */
function FieldFillBlock({ data }: { data: CardFieldsData }) {
  return (
    <Block
      title="필드별 채움"
      tag="분모 = 사용자가 만든 카드"
      note={
        <>
          채움은 <strong className="text-text-tertiary">값이 있는가</strong>만 본다 — 내용이 정확한지는
          여기서 판정하지 않는다. 공백만 적은 것은 미채움으로 센다.
        </>
      }
    >
      <div className="space-y-2">
        {FIELD_META.map(({ key, label, bar }) => {
          const filled = data.fields[key].filled
          const width = data.cards > 0 ? Math.max((filled / data.cards) * 100, 2) : 0
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary w-20 sm:w-28 shrink-0">{label}</span>
              <div className="flex-1 min-w-0 h-5 bg-card rounded overflow-hidden">
                <div className={`h-full rounded ${bar}`} style={{ width: `${width}%` }} />
              </div>
              <span className="text-xs tabular-nums text-text-secondary w-24 sm:w-32 text-right shrink-0">
                {formatShare(filled, data.cards, { unit: '장' })}
              </span>
            </div>
          )
        })}
      </div>
    </Block>
  )
}

/**
 * ② 직무 표기 흔들림 — **「자동완성이 답이다」의 유일한 직접 근거**라 가장 위에 크게 둔다.
 *
 * 🔴 0 건일 때 그냥 비워두지 않는다. "흔들림이 없다" 는 **가설을 접으라는 신호**이고,
 * 그건 화면이 비어 있는 것과 완전히 다른 정보다.
 */
function JobTitleVarianceBlock({ data }: { data: CardFieldsData }) {
  const { usersWithJobTitle, usersWithVariants, groups } = data.jobTitleVariance
  const hasVariance = usersWithVariants > 0
  const texts = data.jobTitleTexts

  return (
    <Block
      title="직무 표기 흔들림"
      tag="한 사람 안에서만 판정"
      note={
        <>
          🔴 <strong className="text-text-tertiary">사용자별로 본다.</strong> 서로 다른 두 사람이
          「백엔드」와 「백엔드 개발자」를 적은 것은 흔들림이 아니다 — 그건 자동완성으로 해결되는
          문제가 아니다. 한 사람이 같은 직무를 다시 적다가 다르게 적었을 때만 잡는다.
        </>
      }
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <p
          className={`text-xl font-bold tabular-nums ${
            hasVariance ? 'text-warning' : 'text-text-secondary'
          }`}
        >
          {formatShare(usersWithVariants, usersWithJobTitle)}
        </p>
        <p className="text-[11px] text-text-quaternary">
          직무를 적은 사람 중 표기가 갈린 사람
        </p>
      </div>

      {hasVariance ? (
        <ul className="mt-3 space-y-1.5">
          {groups.map((g, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              {g.variants.map((v, j) => (
                <span key={j} className="contents">
                  {j > 0 && (
                    <span className="text-text-faint text-[11px]" aria-hidden="true">
                      ↔
                    </span>
                  )}
                  <span className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded break-all">
                    {v}
                  </span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-tertiary">
          갈린 표기가 <strong className="text-text-secondary">한 건도 없다.</strong> 자동완성으로
          해결할 문제가 아니라는 뜻이므로, 이 근거로 세운 계획은 접는다.
        </p>
      )}

      {/*
        🔴 **위 흔들림 판정과 답하는 질문이 다르다.** 저건 「한 사람이 흔들리나」라 사용자별로
        접지만, 여기는 **전체가 무슨 말을 쓰나**다 — 사전에 넣을 어휘를 고르는 자리라
        `백엔드` 와 `백엔드 개발자` 를 접지 않고 둘 다 보여준다.

        이게 없으면 직군 「기타」를 고른 카드의 실체를 영영 못 본다. 채움 수는
        「적긴 적었다」까지고, **무엇을 적었는지는 이 목록으로만** 보인다.

        `texts` 부재 = 백엔드가 아직 이 필드를 안 주는 배포 창 → 행 자체를 안 그린다.
      */}
      {texts && texts.distinct > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-[11px] text-text-quaternary">
              직무 표기{' '}
              <span className="tabular-nums text-text-secondary">
                {texts.distinct.toLocaleString()}
              </span>
              종 · 많이 쓰인 순
            </p>
            {/*
              🔴 판정 기준은 **그린 개수 vs 전수**다. `top.length` 로 재면 서버가 이미
              50에서 자른 경우(top 15 · distinct 15)에 「안 잘렸다」로 보이는데
              화면엔 10개뿐이라, 잘린 사실이 조용히 사라진다.
            */}
            {texts.distinct > JOB_TITLE_TEXT_SHOWN && (
              <span className="text-[11px] text-text-quaternary">
                상위 {JOB_TITLE_TEXT_SHOWN}개만 표시
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {texts.top.slice(0, JOB_TITLE_TEXT_SHOWN).map((t) => (
              <span
                key={t.value}
                className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded break-all"
              >
                {t.value}
                {t.cards > 1 && (
                  <span className="ml-1 tabular-nums text-text-quaternary">{t.cards}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </Block>
  )
}

/**
 * 화면에 그리는 직무 원문 개수 — 서버 상한(50)보다 좁다.
 * 이 블록은 「흔들리나」가 주인공이고 원문 목록은 그 아래 보조라, 50개를 깔면
 * 칩이 화면을 덮어 주인공이 밀린다. 전수는 옆의 `distinct` 가 지킨다.
 */
const JOB_TITLE_TEXT_SHOWN = 10

/** ③ 직군 어휘 — 한 컬럼에 몇 갈래가 섞여 있나 */
function CategoryVocabBlock({ data }: { data: CardFieldsData }) {
  const { buckets, top } = data.categoryVocab
  const totalCards = buckets.reduce((s, b) => s + b.cards, 0)

  return (
    <Block
      title="직군 값이 어디서 왔나"
      tag="다중 선택은 값 단위로 분해"
      note={
        <>
          <strong className="text-text-tertiary">「목록 밖 · 반복됨」이 신호다.</strong> 여러 사람이
          같은 말을 적고 있다면 온보딩 21개 목록에 그 직군이 없다는 뜻이다 — 그 값이 곧 후보가 된다.
          「목록 밖 · 1회」는 그 사람의 표현일 뿐이라 갈라 센다.
        </>
      }
    >
      {totalCards === 0 ? (
        <p className="text-xs text-text-tertiary">직군이 적힌 카드가 아직 없어요.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {buckets.map((b) => (
              <div key={b.vocab} className="min-w-0">
                <p className="text-[11px] text-text-quaternary">
                  {CATEGORY_VOCAB_LABEL[b.vocab]}
                </p>
                <p className="text-xl font-bold tabular-nums text-text-primary">
                  {b.distinctValues.toLocaleString()}
                  <span className="text-xs font-normal text-text-quaternary">종</span>
                </p>
                {/*
                  🔴 메타데이터와 문장을 한 줄에 잇지 않는다 — 그러면 7-b 판정이
                  「캡션(11px)」과 「읽는 문장(14px)」 사이에서 갈린다. 갈래의 **뜻**은
                  아래 note 가 14px 로 설명하므로 여기는 수치만 남긴다.
                */}
                <p className="text-[11px] text-text-quaternary">
                  {formatShare(b.cards, totalCards, { unit: '장' })}
                </p>
              </div>
            ))}
          </div>

          {top.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <p className="text-[11px] text-text-quaternary mb-2">많이 쓰인 값</p>
              <div className="flex flex-wrap gap-1.5">
                {top.map((t) => (
                  <span
                    key={t.value}
                    className={`text-[11px] px-2 py-0.5 rounded border break-all ${vocabStyle(t.vocab).chip}`}
                  >
                    {t.value}
                    <span className="ml-1 tabular-nums opacity-70">{t.cards}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Block>
  )
}

/** ④ 스텝 진행 · 결과 기록 */
function ProgressBlock({ data }: { data: CardFieldsData }) {
  const { atFirstStep, moved, noSteps } = data.stepProgress
  const withSteps = atFirstStep + moved
  const statusEntries = Object.entries(data.status).sort((a, b) => b[1] - a[1])

  return (
    <Block
      title="스텝 진행 · 결과 기록"
      tag="v1.22.0 노드 터치 수리 사후 관찰"
      note={
        <>
          🔴 <strong className="text-text-tertiary">스텝이 없는 카드를 따로 센다.</strong> 「지원 예정」
          카드는 애초에 스텝이 안 만들어져서, 「안 옮겼다」에 합치면 옮기지 않은 사람이 부풀어 보인다.
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-text-quaternary">스텝을 옮겼다</p>
          <p className="text-xl font-bold tabular-nums text-brand">
            {formatShare(moved, withSteps, { unit: '장' })}
          </p>
          <p className="text-[11px] text-text-quaternary">분모 = 스텝이 있는 카드</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-text-quaternary">첫 스텝에 머묾</p>
          <p className="text-xl font-bold tabular-nums text-text-secondary">
            {formatShare(atFirstStep, withSteps, { unit: '장' })}
          </p>
          <p className="text-[11px] text-text-quaternary">만들고 안 건드린 카드</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-text-quaternary">스텝 없음</p>
          <p className="text-xl font-bold tabular-nums text-text-secondary">
            {noSteps.toLocaleString()}
            <span className="text-xs font-normal text-text-quaternary">장</span>
          </p>
          <p className="text-[11px] text-text-quaternary">지원 예정 등 — 위 분모에서 빠진다</p>
        </div>
      </div>

      {statusEntries.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <p className="text-[11px] text-text-quaternary mb-2">상태 분포</p>
          <div className="flex flex-wrap gap-1.5">
            {statusEntries.map(([status, count]) => (
              <span
                key={status}
                className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded"
              >
                {status}
                <span className="ml-1 tabular-nums text-text-quaternary">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Block>
  )
}

/** ⑤ 회사명 — DART 사전이 현실을 덮나 */
function CompanyMatchBlock({ data }: { data: CardFieldsData }) {
  const { distinctNames, matchedNames, topUnmatched } = data.companyMatch

  return (
    <Block
      title="회사명이 사전에 있나"
      tag="companies.json (DART)"
      note={
        <>
          사전 밖 이름은 <strong className="text-text-tertiary">오타일 수도, 사전에 원래 없는 곳일
          수도</strong> 있다 — 병원·관공서·비상장은 DART 에 없다. 온보딩 보상을 진짜 회사로 바꾸려면
          이 비율이 근거가 된다. 앞뒤 공백·대소문자만 접으므로 「A 병원」과 「A병원」은 다른 이름으로 센다.
        </>
      }
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-xl font-bold tabular-nums text-text-primary">
          {formatShare(matchedNames, distinctNames, { unit: '개' })}
        </p>
        <p className="text-[11px] text-text-quaternary">서로 다른 회사명 중 사전에 있는 것</p>
      </div>

      {topUnmatched.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <p className="text-[11px] text-text-quaternary mb-2">사전 밖 이름 (많이 쓰인 순)</p>
          <div className="flex flex-wrap gap-1.5">
            {topUnmatched.map((u) => (
              <span
                key={u.name}
                className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded break-all"
              >
                {u.name}
                {u.cards > 1 && (
                  <span className="ml-1 tabular-nums text-text-quaternary">{u.cards}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </Block>
  )
}

/**
 * ⑥ 관측 컬럼 — 2026-08-25 도입.
 *
 * 🔴 **도입 직후에는 반드시 0 이다.** 그걸 안 적으면 "아무도 안 쓴다" 로 읽혀서
 * 없는 문제를 고치러 간다. 「측정했는데 0」과 「아직 안 쌓임」을 문구로 가르는 자리다.
 */
function ObservabilityBlock({ data }: { data: CardFieldsData }) {
  const rows: {
    key: string
    label: string
    recorded: number
    distribution: Record<string, number>
    hint: string
  }[] = [
    {
      key: 'templateId',
      label: '시작 템플릿',
      recorded: data.templateId.recorded,
      distribution: data.templateId.distribution,
      hint: '추천대로 시작했나',
    },
    {
      key: 'createdVia',
      label: '생성 경로',
      recorded: data.createdVia.recorded,
      distribution: data.createdVia.distribution,
      hint: '어느 진입점이 잘 채워진 카드를 만드나',
    },
  ]
  const anyRecorded = rows.some((r) => r.recorded > 0)
  const usage = data.templateUsage

  return (
    <Block
      title="관측 컬럼 기록 현황"
      tag="2026-08-25 도입 · 백필 없음"
      note={
        <>
          🔴 <strong className="text-text-tertiary">여기 0 은 「아무도 안 쓴다」가 아니라 「아직 안
          쌓였다」다.</strong> 도입 이전 카드는 값이 없고, 추측으로 채워 넣지 않았다 — 빈 값은
          「모른다」라는 정확한 정보다. 도입 이후 만들어진 카드부터 아래 분포가 채워진다.
        </>
      }
    >
      {!anyRecorded ? (
        <p className="text-xs text-text-tertiary">
          아직 기록된 카드가 없어요.{' '}
          <span className="text-text-quaternary">
            도입 이후 새로 만든 카드부터 여기에 쌓입니다.
          </span>
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const entries = Object.entries(r.distribution).sort((a, b) => b[1] - a[1])
            return (
              <div key={r.key}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xs text-text-secondary font-medium">{r.label}</p>
                  <span className="text-[11px] text-text-quaternary">{r.hint}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-text-quaternary">
                    기록 {formatShare(r.recorded, data.cards, { unit: '장' })}
                  </span>
                </div>
                {r.recorded === 0 ? (
                  <p className="text-[11px] text-text-quaternary mt-1.5">
                    아직 기록된 카드가 없어요 — 도입 이후 카드부터 쌓입니다.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entries.map(([k, v]) => (
                      <span
                        key={k}
                        className={`text-[11px] px-2 py-0.5 rounded border break-all ${
                          // 🔴 0 을 `text-text-faint` 로 깔면 대비 2.56 이라 **안 읽힌다.**
                          // 이 칩이 존재하는 이유가 「안 쓰이는 템플릿을 보여주는 것」인데
                          // 안 보이게 만들면 자기모순이다. quaternary 로 올려도
                          // secondary(쓰인 것)와 위계는 그대로 갈린다.
                          v > 0
                            ? 'text-text-secondary bg-card border-line'
                            : 'text-text-quaternary bg-card border-line'
                        }`}
                      >
                        {k}
                        <span className="ml-1 tabular-nums">{v}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/*
        🔴 **「무엇으로 시작했나」와 「그 뒤 손댔나」는 다른 질문이다.** 위 분포는 전자고
        이 행은 후자다. 계열 14벌을 새로 만든 값어치가 여기서 갈린다 — 받은 대로 안 쓴다면
        템플릿을 늘리는 건 헛수고다. 스텝 이름을 한 글자만 고쳐도 「고쳤다」로 센다.

        `usage` 가 없는 경우 = 백엔드가 아직 이 필드를 안 주는 배포 창. 그때는 행 자체를
        안 그린다 (0 으로 그리면 「아무도 안 쓴다」라는 **거짓 주장**이 된다).
      */}
      {usage && anyRecorded && (
        <div className="mt-4 pt-3 border-t border-line">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-xs text-text-secondary font-medium">전형 템플릿 그대로 쓴 카드</p>
            <span className="text-[11px] text-text-quaternary">스텝을 안 건드렸나</span>
            <span className="ml-auto text-[11px] tabular-nums text-text-secondary">
              {formatShare(usage.keptAsIs, usage.withTemplate, { unit: '장' })}
            </span>
          </div>
          {usage.withTemplate === 0 ? (
            <p className="text-[11px] text-text-quaternary mt-1.5">
              템플릿이 기록된 카드가 아직 없어요 — 도입 이후 카드부터 쌓입니다.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {usage.byTemplate.slice(0, 5).map((t) => (
                <span
                  key={t.templateId}
                  className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded break-all"
                  title={`${t.templateId} — ${t.count}장 중 ${t.kept}장 그대로`}
                >
                  {t.templateId}
                  <span className="ml-1 tabular-nums text-text-quaternary">
                    {t.kept}/{t.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Block>
  )
}

/** 읽는 법 — 한계를 화면에 적는다 (`ReadingNotes` 와 같은 판단) */
function CardFieldsNotes({ data }: { data: CardFieldsData }) {
  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <p className="text-xs text-text-tertiary font-semibold mb-2.5">읽는 법</p>
      <ul className="space-y-1.5 text-sm text-text-quaternary leading-relaxed">
        <li>
          🔴 <strong className="text-text-tertiary">「안 적는다」와 「적으려다 말았다」를 못 가른다.</strong>{' '}
          직군 칩을 눌렀다 지운 사람과 아예 안 본 사람이 여기서는 똑같이 빈 값으로 보인다 — 그
          판정에는 Clarity 리플레이가 여전히 필요하고, 이 화면이 생겨도 대체되지 않는다.
        </li>
        <li>
          <strong className="text-text-tertiary">관리자 카드 {data.excluded.adminCards.toLocaleString()}장</strong>
          은 제외했다. 운영자 본인의 테스트 입력을 사용자 행동으로 읽으면 진단이 통째로 뒤집힌다.
        </li>
        <li>
          🔴 <strong className="text-text-tertiary">온보딩 샘플 {data.excluded.sampleCards.toLocaleString()}장도
          제외</strong>했다. 샘플은 직군은 채우고 직무는 안 채우게 만들어져 있어, 안 빼면 직군
          채움률은 부풀고 직무 채움률은 깎여 <em>정반대 결론</em>이 나온다.
        </li>
        <li>
          비율은 <strong className="text-text-tertiary">분모가 30 미만이면 % 대신 실수</strong>로 적는다.
          소표본 백분율은 정확해 보이는 만큼 위험하다.
        </li>
        <li>
          집계는 <strong className="text-text-tertiary">5분 캐시</strong>다 — 방금 만든 카드가 바로
          반영되지 않을 수 있다.
        </li>
      </ul>
    </div>
  )
}

function CardFieldsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface-2 border border-line rounded-xl p-5">
          <div className="h-3 w-28 rounded bg-card animate-pulse mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-3 w-20 sm:w-28 rounded bg-card animate-pulse shrink-0" />
                <div className="flex-1 h-5 rounded bg-card animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
