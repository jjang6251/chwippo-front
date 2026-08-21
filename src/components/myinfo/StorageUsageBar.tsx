import type { StorageBreakdown } from '@/api/myinfo'
import { useStorageUsage } from '@/hooks/useStorageUsage'

/**
 * 사용량 진행 바.
 * - 평소: surface 톤
 * - 80%+ : warning(노랑)
 * - 95%+ : danger(빨강) + 안내 문구
 *
 * ## 🔴 한 통을 두 기능이 쓴다
 *
 * 2026-08-21 부터 공부 노트 본문 이미지가 내정보 증빙 파일과 **같은 100MB** 를 쓴다.
 * 그래서 숫자 하나만 보여 주면 "왜 늘었지"에 답이 없다 — 바 아래 출처별 한 줄이 그 답이다.
 *
 * 같은 이유로 이 부품은 **내정보 전용이 아니다**. 공부 노트 허브에도 같은 값이 서므로
 * `variant` 로 무게·폭만 바꿔 재사용한다 (파일 복제 금지 — 두 벌이면 문구가 갈라진다).
 *
 * ## 🔴 로딩 자리는 실제와 **같은 줄 상자**로 만든다
 *
 * `h-[56px]` 같은 magic number 로 맞춰 두면 줄이 하나 늘 때마다 조용히 어긋난다
 * (실제로 38px 자리에 56px 카드가 와서 CLS 0.179 를 냈다 — `e2e/myinfo-cls.spec.ts`).
 * 스켈레톤은 실제와 **같은 껍데기 + 같은 높이의 줄 3개**로 짠다: 16 / 6 / 16.
 */

/** 출처 이름 — 앱이 그 화면에서 쓰는 말 그대로 (「증빙 파일」·「내 정보 창고」) */
const MYINFO_LABEL = '증빙 파일'
const NOTE_LABEL = '공부 노트 이미지'

/**
 * 🔴 **짧은 이름은 한 곳에서만 갈라 둔다.**
 *
 * 헤더 우측 열은 220px 다 — 「증빙 파일 2.0MB · 공부 노트 이미지 1.2MB」는 세 줄로 접힌다.
 * 그래서 **분해 줄에 한해** 짧은 이름을 쓴다. 두 벌을 각자 하드코딩하면 한쪽만 고쳐져
 * 화면마다 다른 말을 하게 되므로 짝을 여기 나란히 둔다.
 *
 * 🔴 **문장(경고 문구)은 언제나 전체 이름이다.** 「증빙이 더 많이 쓰고 있어요」는 무엇을
 * 지우라는 말인지 알 수 없다 — 짧은 이름은 값 옆에 붙은 꼬리표일 때만 뜻이 통한다.
 */
const SHORT_MYINFO_LABEL = '증빙'
const SHORT_NOTE_LABEL = '노트'

interface StorageUsageBarProps {
  /**
   * `card`(기본) — 내정보처럼 다른 카드와 나란히 설 때.
   * `quiet` — 공부 노트 허브 하단처럼 **주인공이 따로 있을 때**. 테두리·배경만 빼고
   * 부품·색·문구는 그대로다 (새 시각 언어를 만들지 않는다).
   * `compact` — 공부 노트 허브 **헤더 우측**, CTA 아래. 폭을 고정해 값이 길어져도
   * 「새 노트」 버튼 쪽으로 번지지 않게 한다. 부품·색·톤은 역시 그대로다.
   */
  variant?: 'card' | 'quiet' | 'compact'
}

/**
 * 🔴 compact 는 **폭이 내용에 흔들리면 안 된다** — 헤더 우측 열은 CTA 와 같은 열이라
 * 「99.9 / 100MB」로 늘어나는 순간 버튼 줄이 밀린다. 그래서 `w-[220px]` 고정이다.
 * `flex flex-col items-end` 는 안의 줄들(스켈레톤 포함)을 따로 손보지 않고 오른쪽에 세운다.
 */
const SHELL: Record<NonNullable<StorageUsageBarProps['variant']>, string> = {
  card: 'rounded-lg border border-line bg-surface px-4 py-3',
  quiet: 'py-3',
  compact: 'flex flex-col items-end w-[220px] text-right',
}

export function StorageUsageBar({ variant = 'card' }: StorageUsageBarProps) {
  const { data, isLoading, error } = useStorageUsage()
  const shell = SHELL[variant]
  const compact = variant === 'compact'

  if (isLoading) {
    return (
      <div className={shell} aria-busy="true">
        {/* 아래 실제 줄들과 **같은 높이**(16 / 6 / 16)여야 도착 순간 화면이 안 밀린다 */}
        <div className="mb-2 h-4 w-32 animate-pulse rounded bg-card" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-card" />
        <div className="mt-2 h-4 w-44 animate-pulse rounded bg-card" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`${shell} text-text-tertiary text-xs`}>사용량 조회 실패</div>
    )
  }

  const { usedMB, limitMB, percentage, breakdown } = data
  const tone = getTone(percentage)

  return (
    <div className={shell}>
      {/* `w-full` 은 card·quiet 에선 무효(이미 블록 폭)이고 compact 의 flex 열에서만 일한다 */}
      <div className="flex w-full items-center justify-between text-xs mb-2">
        <span className="text-text-tertiary">파일 저장 용량</span>
        <span className={`font-medium ${tone.textClass}`}>
          {formatMB(usedMB)} / {limitMB}MB
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`파일 저장 용량 ${percentage}%`}
        className="h-1.5 w-full rounded-full bg-card overflow-hidden"
      >
        <div
          className={`h-full transition-all ${tone.barClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {breakdown && (
        /*
          🔴 **0 이어도 접지 않는다 — 한쪽도, 양쪽 다도.** 규칙 하나로 통일한다:
          「분해값이 오면 두 출처를 항상 쓴다」. 이 줄의 목적이 "공부 노트 이미지도 같은
          통을 쓴다"를 알리는 것이라 아직 안 쓴 사람에게야말로 보여야 하고, 값에 따라
          줄이 생겼다 사라지면 스켈레톤(3줄 고정)과 어긋나 아래가 밀린다.
          숨는 경우는 **필드 자체가 없을 때**(백엔드 롤아웃 창) 하나뿐이다.
        */
        <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-text-quaternary">
          <span>
            {compact ? SHORT_MYINFO_LABEL : MYINFO_LABEL} {formatBytes(breakdown.myinfoBytes)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {compact ? SHORT_NOTE_LABEL : NOTE_LABEL} {formatBytes(breakdown.noteImageBytes)}
          </span>
        </p>
      )}
      {percentage >= 95 && (
        <p className="mt-2 text-[11px] leading-4 text-danger">{warningMessage(breakdown)}</p>
      )}
    </div>
  )
}

/**
 * 🔴 예전 문구는 「일부 **항목**을 삭제해 주세요」였다 — 내정보 항목만 가리키는 말이라,
 * 통을 채운 게 노트 이미지인 사용자에게는 **거짓 안내**다 (항목을 다 지워도 안 줄어든다).
 * 그래서 둘 중 **큰 쪽을 이름으로 부르고** 그걸 지우라고 말한다.
 *
 * 동률이거나 분해값이 아직 없으면(백엔드 롤아웃 창) 한쪽을 고르지 않고 둘 다 부른다 —
 * 틀린 한쪽을 찍느니 둘 다 말하는 편이 사실에 가깝다.
 */
function warningMessage(breakdown?: StorageBreakdown): string {
  const head = '저장 공간이 거의 찼어요.'
  if (!breakdown || breakdown.myinfoBytes === breakdown.noteImageBytes) {
    return `${head} ${MYINFO_LABEL} 또는 ${NOTE_LABEL}를 지워 주세요.`
  }
  return breakdown.noteImageBytes > breakdown.myinfoBytes
    ? `${head} ${NOTE_LABEL}가 더 많이 쓰고 있어요 — 안 쓰는 노트의 이미지를 지워 주세요.`
    : `${head} 내 정보 창고의 ${MYINFO_LABEL}이 더 많이 쓰고 있어요 — 안 쓰는 파일을 지워 주세요.`
}

function getTone(percentage: number): { textClass: string; barClass: string } {
  if (percentage >= 95) {
    return { textClass: 'text-danger', barClass: 'bg-danger' }
  }
  if (percentage >= 80) {
    return { textClass: 'text-warning', barClass: 'bg-warning' }
  }
  return { textClass: 'text-text-primary', barClass: 'bg-brand' }
}

function formatMB(mb: number): string {
  // 100MB 미만이면 소수점 1자리, 100MB 이상이면 정수
  return mb < 100 ? mb.toFixed(1) : Math.round(mb).toString()
}

/** 출처별 값은 작을 수 있다 — 0.05MB 를 「0.0MB」로 적으면 안 쓴 것처럼 보인다 */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${formatMB(mb)}MB`
}
