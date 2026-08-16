import { useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Hash, ListOrdered, Tags, Target, Timer, Users } from 'lucide-react'
import { CategoryChipPicker } from '@/components/common/CategoryChipPicker'
import { useNativeMode } from '@/hooks/useNativeMode'
import { filterExamQuestions } from '@/utils/practiceExam'
import type { ExamSettings, ExamTimer } from '@/utils/practiceExam'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * 「면접 보기」 시험 설정 — **시작 전 한 화면** (질문 은행 D3).
 *
 * 🔴 **이 화면의 주인공은 옵션이 아니라 「몇 문항을 연습하게 되는가」다** (2026-08-11 재구성).
 * 처음엔 여섯 행이 전부 같은 문법(회색 라벨 + 큰 회색 pill)이라 위계가 없었고, 정작 그
 * 숫자는 스크롤 아래 작은 회색 한 줄이었으며 CTA 는 폴드 밖이었다. 그래서
 *   ① 산출 숫자를 **카드 맨 위 큰 숫자**로 올리고 (설정을 만질 때마다 즉시 반응한다)
 *   ② pill 을 **카테고리 칩 밀도**로 낮춰 옵션 줄이 배경으로 물러나게 하고
 *   ③ 모바일 CTA 를 **하단에 고정**해 스크롤 위치와 무관하게 항상 손 닿는 곳에 뒀다.
 *
 * 🔴 **모바일이 기준이다.** 이 화면을 여는 자리는 면접장 앞 대기실이고 손에 든 건 폰이다.
 * 그래서 select 가 아니라 칩이다 — 한 번 눌러 고르고, 고른 결과가 위 숫자로 바로 보인다.
 *
 * 🔴 **산출 숫자를 고르는 동안 계속 보여준다.** 조건을 AND 로 겹쳐 걸 수 있어서
 * (⭐ 우선 + 특정 유형 + 내 질문만) 0개가 되기 쉽고, 그걸 [시작] 을 누른 뒤 알게 되면
 * 설정을 처음부터 다시 짚어야 한다.
 *
 * 규칙 자체(무엇이 몇 번째로 나오는가)는 `utils/practiceExam.ts` 가 쥔다 — 이 컴포넌트는
 * 고르고 미리 보여줄 뿐이다.
 */

interface Props {
  /** 세션의 메인 질문 트리 (`useInterviewPrepQuestions` 결과 그대로) */
  questions: InterviewPrepQuestion[]
  onStart: (settings: ExamSettings) => void
}

/**
 * 🔴 **카테고리 칩(`CategoryChipPicker`)과 같은 리듬**이다 — 같은 카드 안에 두 문법이
 * 있으면 무엇이 같은 층위인지 알 수 없다. 예전의 `min-h-[44px] text-[13px] px-4` 는
 * 옵션 하나하나가 CTA 만큼 커서, 여섯 줄이 쌓이자 화면이 버튼 벽이 됐다.
 *
 * 다만 카테고리 칩(`min-h-7`)보다 한 칸 크다 — 이쪽은 24종 중 고르는 보조 피커가 아니라
 * **이 화면의 주 조작부**다. 모바일(면접 직전 폰)은 44px — DESIGN.md 터치 타겟 기준,
 * 데스크탑은 `sm:min-h-8`(32px 최소치)로 조밀하게. (/uiux 2026-08-13 수정)
 */
const PILL_BASE =
  'inline-flex items-center justify-center min-h-[44px] sm:min-h-8 whitespace-nowrap text-[12px] px-3 sm:px-2.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
/** 필터 행·카테고리 칩과 **같은 문법** — 고른 것은 brand 채움 */
const PILL_ON = 'bg-brand text-bg border-brand font-medium'
const PILL_OFF =
  'border-line text-text-secondary hover:border-line-strong hover:text-text-primary'

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`${PILL_BASE} ${on ? PILL_ON : PILL_OFF}`}
    >
      {children}
    </button>
  )
}

/**
 * 한 설정 행. 카드 하나 안에서 `divide-y` 로 갈린다 — 예전엔 균일한 `space-y-5` 라
 * 여섯 덩어리가 같은 무게로 떠 있었고, 그래서 어디까지가 한 항목인지 흐렸다.
 *
 * 아이콘은 **스캔 보조 한 방울**이다 (앱의 다른 섹션 라벨과 같은 관례). 색을 얹지 않는다 —
 * 이 화면의 색은 카테고리 칩 줄 하나뿐이어야 한다.
 */
function Row({
  icon: Icon,
  label,
  children,
  hint,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="px-5 py-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
        <Icon size={14} className="text-text-quaternary" />
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap items-center gap-1.5"
      >
        {children}
      </div>
      {hint}
    </div>
  )
}

interface PillRowProps<T extends string | number> {
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  hint?: ReactNode
}

function PillRow<T extends string | number>({
  label,
  icon,
  options,
  value,
  onChange,
  hint,
}: PillRowProps<T>) {
  return (
    <Row icon={icon} label={label} hint={hint}>
      {options.map((o) => (
        <Pill
          key={String(o.value)}
          on={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Pill>
      ))}
    </Row>
  )
}

/** 행 안내 문구 — 잘렸다·모자란다를 그 행 안에서 말한다 (카드 밖으로 새지 않게) */
function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-text-faint text-xs mt-2 leading-relaxed">{children}</p>
  )
}

/**
 * 「직접 입력」 숫자칸. **모바일 16px**(`text-base`)이라야 iOS 가 화면을 확대하지 않는다 —
 * 확대되면 설정 화면 전체가 옆으로 밀려 나머지 칩을 못 누른다.
 */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  suffix: string
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        /* 숫자만 남긴다 — `type="number"` 는 `e`·`-` 를 통과시키고 모바일에서 스피너가 뜬다 */
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, '').slice(0, 4))
        }
        className="w-[64px] min-h-[44px] sm:min-h-8 sm:w-[60px] rounded-full border border-line bg-input px-2 text-center font-mono tabular-nums text-base sm:text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/60"
      />
      <span className="text-[11px] text-text-quaternary">{suffix}</span>
    </span>
  )
}

const DEFAULT_SETTINGS: ExamSettings = {
  source: 'both',
  scope: 'all',
  category: null,
  order: 'sequence',
  count: 'all',
  timer: { mode: 'off', sec: 0 },
}

const ORDER_LABEL: Record<ExamSettings['order'], string> = {
  sequence: '차례',
  random: '올랜덤',
  flow: '실전 흐름',
}

/** 타이머 「직접 입력」 범위 — 5초 미만은 읽기도 전에 끝나고, 10분이면 사실상 무제한이다 */
const TIMER_MIN = 5
const TIMER_MAX = 600
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

export function PracticeSettings({ questions, onStart }: Props) {
  const [settings, setSettings] = useState<ExamSettings>(DEFAULT_SETTINGS)
  /**
   * 「직접 입력」이 눌려 있는 동안의 **raw 입력**. `null` = 프리셋 pill 이 눌린 상태다.
   *
   * 🔴 **`settings` 안에 넣지 않는다.** 빈 문자열은 「아직 안 적음」이고 그건 숫자가
   * 아니다 — `count: 0` 으로 밀어 넣으면 "0개짜리 시험" 과 구분이 사라진다.
   */
  const [countText, setCountText] = useState<string | null>(null)
  const [timerText, setTimerText] = useState<string | null>(null)
  const patch = <K extends keyof ExamSettings>(key: K, v: ExamSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: v }))
  /** 네이티브 WebView 는 하단 탭바를 **네이티브가 그린다** — 웹 탭바 자리를 비우면 안 된다 */
  const isNative = useNativeMode()

  /** 정렬 전 후보군 — 미리보기 숫자는 전부 여기서 나온다 (상한은 그 다음 일이다) */
  const pool = useMemo(
    () => filterExamQuestions(questions, settings),
    [questions, settings],
  )
  const total = useMemo(
    () => questions.filter((q) => q.depth === 0).length,
    [questions],
  )
  const max = pool.length

  /**
   * 🔴 **입력칸은 사용자가 친 글자 그대로 둔다.** 타건마다 M 으로 덮어쓰면 M=4 일 때
   * 「10」을 치는 순간 칸이 「4」가 되고, 이어 친 `0` 이 「40」을 만든다. 자르는 것은
   * **값**이고, 잘렸다는 사실은 아래 안내가 말한다.
   */
  const typedCount = countText ? Number(countText) : null
  const typedTimer = timerText ? Number(timerText) : null
  /** 「직접 입력」인데 아직 비어 있다 — 시작을 막는 유일한 이유가 이것일 수 있다 */
  const blank = countText === '' || timerText === ''

  const count: ExamSettings['count'] =
    countText === null
      ? settings.count
      : typedCount === null
        ? 0
        : clamp(typedCount, 1, Math.max(max, 1))
  const timer: ExamTimer =
    timerText === null
      ? settings.timer
      : {
          mode: 'countdown',
          sec:
            typedTimer === null ? 0 : clamp(typedTimer, TIMER_MIN, TIMER_MAX),
        }

  const picked = count === 'all' ? pool.length : Math.min(count, pool.length)
  const looseCount = pool.filter((q) => !q.category).length
  /** 고른 상한보다 후보가 적을 때만 — 「10개」를 골랐는데 7개면 미리 말해 준다 */
  const short = countText === null && count !== 'all' && max < count
  /** 직접 입력이 M 을 넘었다 — 값은 이미 잘렸고, 여기서 왜 잘렸는지를 말한다 */
  const countOver = typedCount !== null && typedCount > max
  const timerOutOfRange =
    typedTimer !== null && (typedTimer < TIMER_MIN || typedTimer > TIMER_MAX)

  const pickPreset = (v: ExamSettings['count']) => {
    setCountText(null)
    setSettings((s) => ({ ...s, count: v }))
  }
  const pickTimer = (v: ExamTimer) => {
    setTimerText(null)
    setSettings((s) => ({ ...s, timer: v }))
  }

  /** 히어로 보조줄의 타이머 한마디 — 「끔」을 "타이머 없음" 이라 풀어 쓴다 */
  const timerSummary =
    timer.mode === 'off'
      ? '타이머 없음'
      : timer.mode === 'stopwatch'
        ? '스톱워치'
        : `${timer.sec}초`

  /** 시작을 막는 이유. 있으면 히어로 밑에 그대로 말한다 (CTA 옆이 아니라 숫자 옆이다) */
  const blocker = blank
    ? countText === ''
      ? '문항 수를 적어주세요'
      : '시간을 적어주세요'
    : picked === 0
      ? `조건에 맞는 질문이 없어요 (전체 ${total}개 중 0개)`
      : null

  return (
    <>
      {/*
        🔴 **하단 고정 CTA 용 여백을 여기서 또 더하지 않는다.** 페이지가 이미
        `pb-[88px]`(MobileNav 몫)을 깔아 뒀고, 그 위에 바 높이를 다시 더하면 두 번 세는 것이다 —
        실측에서 카드 밑에 183px 짜리 빈 벌판이 생겼다. 현재 실측 여유는
        모바일 40px · 네이티브 16px 로, 마지막 행이 버튼에 깔리지 않는다.
      */}
      <div className="bg-surface-2 border border-line rounded-xl divide-y divide-line">
        {/*
          ① 히어로 — **이 화면의 목적**이다. 옵션을 만질 때마다 이 숫자가 움직이는 걸
          보는 것이 곧 "무엇을 고르는 중인가" 의 피드백이고, 그래서 맨 위에 있어야 한다.
          0개는 danger 로 물든다 — 시작할 수 없는 상태를 CTA 까지 내려가서 알면 늦다.
        */}
        <div className="px-5 py-4">
          <p className="flex items-baseline gap-1.5">
            {/* 라벨에 값을 함께 담는다 — 숫자만 떼어 읽으면 무엇의 12 인지 알 수 없다 */}
            <span
              aria-label={`조건에 맞는 질문 ${picked}개`}
              className={`font-mono tabular-nums text-3xl font-semibold ${
                picked === 0 ? 'text-danger' : 'text-text-primary'
              }`}
            >
              {picked}
            </span>
            <span className="text-sm font-medium text-text-secondary">
              문항
            </span>
          </p>
          <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
            전체 <span className="font-mono tabular-nums">{total}</span>개 중 ·{' '}
            {ORDER_LABEL[settings.order]} · {timerSummary}
          </p>
          {blocker && (
            <p className="text-danger text-xs mt-2 leading-relaxed">
              {blocker}
            </p>
          )}
        </div>

        <PillRow
          label="출처"
          icon={Users}
          value={settings.source}
          onChange={(v) => patch('source', v)}
          options={[
            { value: 'both', label: '둘 다' },
            { value: 'user', label: '내 질문만' },
            { value: 'ai', label: 'AI 질문만' },
          ]}
        />

        <PillRow
          label="범위"
          icon={Target}
          value={settings.scope}
          onChange={(v) => patch('scope', v)}
          options={[
            { value: 'all', label: '전체' },
            { value: 'must', label: '⭐ 우선만' },
            { value: 'again', label: '다시 볼 것만' },
          ]}
        />

        <div className="px-5 py-3.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
            <Tags size={14} className="text-text-quaternary" />
            카테고리
          </p>
          {/* 🔴 여기서 `null` 은 「미분류」가 아니라 **「전체」**다 — 거르는 자리이기 때문 */}
          <CategoryChipPicker
            value={settings.category}
            onChange={(v) => patch('category', v)}
            idPrefix="practice-cat"
            nullLabel="전체"
          />
        </div>

        <PillRow
          label="순서"
          icon={ListOrdered}
          value={settings.order}
          onChange={(v) => patch('order', v)}
          options={[
            { value: 'sequence', label: '차례' },
            { value: 'random', label: '올랜덤' },
            { value: 'flow', label: '실전 흐름' },
          ]}
          /*
              🔴 **이 안내가 분류의 동기다** (계획 §3-B). 질문을 적을 때 유형을 강제하지 않는
              대신, 실전 흐름이 유형 없는 질문을 어떻게 다루는지 여기서 정확히 말한다.
            */
          hint={
            settings.order === 'flow' &&
            looseCount > 0 && (
              <p className="text-text-quaternary text-xs mt-2 leading-relaxed">
                {looseCount === pool.length
                  ? '카테고리가 없어 사실상 무작위 순서예요.'
                  : `카테고리 없는 질문 ${looseCount}개는 중간에 무작위로 섞여요.`}
              </p>
            )
          }
        />

        <Row
          icon={Hash}
          label="문항 수"
          hint={
            countOver ? (
              <Hint>{max}개까지예요</Hint>
            ) : (
              short && <Hint>{max}개로 시작해요</Hint>
            )
          }
        >
          {(
            [
              ['all', '전체'],
              [10, '10개'],
              [20, '20개'],
            ] as const
          ).map(([v, label]) => (
            <Pill
              key={label}
              on={countText === null && settings.count === v}
              onClick={() => pickPreset(v)}
            >
              {label}
            </Pill>
          ))}
          {/* 눌린 순간 지금 산출값을 채워 둔다 — 빈 칸부터 시작하면 시작이 곧바로 막힌다 */}
          <Pill
            on={countText !== null}
            onClick={() => setCountText(String(Math.max(picked, 1)))}
          >
            직접 입력
          </Pill>
          {countText !== null && (
            <NumberField
              label="문항 수 직접 입력"
              value={countText}
              onChange={setCountText}
              min={1}
              max={Math.max(max, 1)}
              suffix="개"
            />
          )}
        </Row>

        <Row
          icon={Timer}
          label="타이머"
          hint={
            <>
              {timerOutOfRange && (
                <Hint>
                  {TIMER_MIN}초 ~ {TIMER_MAX}초 사이로 정해요
                </Hint>
              )}
              <p className="text-text-quaternary text-xs mt-2 leading-relaxed">
                {timer.mode === 'stopwatch'
                  ? '질문이 나오면 시간이 흘러요 — 제한은 없어요'
                  : '시간이 다 되면 표시만 해요 — 넘어가지 않아요.'}
              </p>
            </>
          }
        >
          <Pill
            on={timerText === null && settings.timer.mode === 'off'}
            onClick={() => pickTimer({ mode: 'off', sec: 0 })}
          >
            끔
          </Pill>
          {[30, 60, 90, 120].map((sec) => (
            <Pill
              key={sec}
              on={
                timerText === null &&
                settings.timer.mode === 'countdown' &&
                settings.timer.sec === sec
              }
              onClick={() => pickTimer({ mode: 'countdown', sec })}
            >
              {sec}초
            </Pill>
          ))}
          <Pill
            on={timerText !== null}
            onClick={() => setTimerText(String(settings.timer.sec || 60))}
          >
            직접 입력
          </Pill>
          {timerText !== null && (
            <NumberField
              label="타이머 직접 입력"
              value={timerText}
              onChange={setTimerText}
              min={TIMER_MIN}
              max={TIMER_MAX}
              suffix="초"
            />
          )}
          {/*
              🔴 스톱워치는 카운트다운의 한 옵션이 아니라 **다른 연습**이다 — 「1분 안에」가
              아니라 「이 답에 내가 몇 초를 쓰는가」를 재는 자리라, 같은 줄에 두되 끝에 세운다.
            */}
          <Pill
            on={timerText === null && settings.timer.mode === 'stopwatch'}
            onClick={() => pickTimer({ mode: 'stopwatch', sec: 0 })}
          >
            ⏱ 스톱워치
          </Pill>
        </Row>
      </div>

      {/*
        ③ **모바일에서는 하단 고정**이다 (2026-08-11). 설정 카드가 여섯 행이라 폰에서는
        CTA 가 언제나 폴드 밖이었고, 옵션을 하나 만질 때마다 끝까지 스크롤해 확인해야 했다.

        🔴 **버튼을 두 벌 그리지 않는다.** `sm:hidden` / `hidden sm:block` 짝으로 나누면
        DOM 에 같은 버튼이 둘 생기고, 그 순간 "시작 버튼" 을 가리키는 모든 코드·테스트가
        어느 쪽인지 되묻게 된다. 한 요소의 **위치만** 바꾼다.

        하단 여백 68px = MobileNav 실측 60px + 간격 8px (`StepPage` 와 같은 계산).
        네이티브 WebView 는 탭바를 네이티브가 그리므로 그 자리를 비우지 않는다.
      */}
      <div
        className={`fixed lg:static bottom-0 left-0 right-0 z-20 border-t border-line bg-bg px-[18px] pt-3 lg:z-auto lg:mt-4 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 ${
          isNative
            ? 'pb-[calc(12px+env(safe-area-inset-bottom,0px))] lg:pb-0'
            : 'pb-[calc(68px+env(safe-area-inset-bottom,0px))] lg:pb-0'
        }`}
      >
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => onStart({ ...settings, count, timer })}
            disabled={picked === 0 || blank}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[48px] bg-brand hover:bg-accent text-bg text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ {picked}개로 시작하기
          </button>
        </div>
      </div>
    </>
  )
}
