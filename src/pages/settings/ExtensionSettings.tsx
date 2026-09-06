import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import {
  useCreatePairCode,
  useDisconnectExtension,
  useExtensionSessions,
} from '@/hooks/useExtension'
import { toast } from '@/stores/toastStore'
import type { ExtensionSession } from '@/types/extension'
import { toLocalDateString } from '@/utils/datetime'

/**
 * 🔴 **고정 문구 — 바꾸려면 CEO 승인이 필요하다.**
 * `company/01_product/autofill-extension-concept.md` §17 표의 「설정 페이지(치뽀 연결)」 행.
 * 같은 문장이 동의 모달·방침·웹스토어 설명에도 있어, 한 곳만 고치면 표면끼리 어긋난다.
 */
export const EXTENSION_INTRO =
  '연결하면 확장이 내 정보 창고를 읽어 폼에 채웁니다. AI 는 칸의 이름·종류만 보고, 개인정보는 보지 않습니다. 언제든 여기서 연결을 해제할 수 있습니다.'

/**
 * 🔴 **고정 문구 — 컨셉 §15 「직접 확인」.** 패널·동의 모달·약관과 같은 문장이다.
 * 전면 면책은 약관규제법상 무효라 「확인 의무 + 미이행 시 이용자 책임」 형태를 유지한다.
 */
export const REVIEW_NOTICE =
  '채운 내용은 제출 전 직접 눈으로 확인하세요. 확인 없이 제출한 내용은 이용자 책임입니다.'

/** 지문 16자리를 8+8 로 끊어 읽기 쉽게. 값 자체는 자르지 않는다(기기 구분이 흐려진다). */
function formatFingerprint(fingerprint: string | null): string {
  if (!fingerprint) return '기기 정보 없음'
  return fingerprint.length > 8
    ? `${fingerprint.slice(0, 8)} ${fingerprint.slice(8)}`
    : fingerprint
}

/** ISO → KST 날짜. 값이 없거나 파싱 실패면 렌더 중 던지지 않고 문구로 떨어진다. */
function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : toLocalDateString(d)
}

export function ExtensionSettings() {
  const sessions = useExtensionSessions()
  const createCode = useCreatePairCode()
  const disconnect = useDisconnectExtension()

  /**
   * 발급된 코드 + **받은 시각**. 남은 시간을 `expiresAt`(절대 시각)에서 빼지 않는 이유는
   * 기기 시계가 서버와 어긋나면 카운트다운이 처음부터 0 이거나 60 을 넘기기 때문이다.
   * 받은 순간부터의 경과만 재면 시계·표준시와 무관하다 (KST 변환도 필요 없다).
   */
  const [pair, setPair] = useState<{
    code: string
    ttlSeconds: number
    issuedAt: number
  } | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [copied, setCopied] = useState(false)
  const [target, setTarget] = useState<ExtensionSession | null>(null)

  const { refetch } = sessions
  /** 만료 시 목록을 딱 한 번만 다시 읽으려는 빗장 (1초마다 다시 읽지 않게) */
  const expiryHandled = useRef(false)

  useEffect(() => {
    if (!pair) return
    const tick = () => {
      const left = pair.ttlSeconds - Math.floor((Date.now() - pair.issuedAt) / 1000)
      setRemaining(left > 0 ? left : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pair])

  /**
   * 코드가 만료되면 목록을 한 번 다시 읽는다. 그 60초 사이에 확장이 코드를 교환했다면
   * 새 연결이 여기 붙어야 사용자가 「됐나?」를 화면에서 확인한다 — 안 읽으면 목록이
   * 비어 보여서 방금 성공한 연결을 다시 시도하게 된다.
   */
  useEffect(() => {
    if (!pair || remaining > 0 || expiryHandled.current) return
    expiryHandled.current = true
    void refetch()
  }, [pair, remaining, refetch])

  const handleCreate = useCallback(() => {
    createCode.mutate(undefined, {
      onSuccess: (data) => {
        expiryHandled.current = false
        setCopied(false)
        setPair({
          code: data.code,
          ttlSeconds: data.ttlSeconds,
          issuedAt: Date.now(),
        })
      },
      onError: () => toast.error('연결 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'),
    })
  }, [createCode])

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 권한 거부·비보안 컨텍스트 — 코드는 화면에 이미 크게 보이므로 치명적이지 않다.
      // 방어가 없으면 rejection 이 unhandled 로 새어 Sentry 에 크래시로 잡힌다.
      toast.error('복사에 실패했어요. 코드를 직접 입력해 주세요.')
    }
  }

  function handleDisconnect() {
    if (!target) return
    disconnect.mutate(target.id, {
      onSuccess: () => {
        setTarget(null)
        toast.success('연결을 해제했어요.')
      },
      onError: () => toast.error('연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    })
  }

  const codeLive = pair && remaining > 0
  const codeExpired = pair && remaining === 0

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <h1 className="text-xl font-bold mb-1">연결된 확장</h1>
      <p className="text-sm text-text-tertiary mb-8">지원서 자동 입력 보조</p>

      {/* ① 이 기능이 무엇을 하고 무엇을 안 하는지 — 고정 문구 (컨셉 §15·§17) */}
      <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
        <p className="text-sm text-text-secondary leading-relaxed">{EXTENSION_INTRO}</p>

        <dl className="mt-4 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <dt className="shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
              하는 일
            </dt>
            <dd className="text-xs text-text-tertiary leading-relaxed">
              내 정보 창고의 내용을 이용자가 선택한 채용 폼에 옮겨 적어요.
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-card-strong text-text-tertiary">
              안 하는 일
            </dt>
            <dd className="text-xs text-text-tertiary leading-relaxed">
              대신 제출하거나 다음 단계로 넘기지 않아요 — 채우고 나면 검토는 이용자 몫이에요.
            </dd>
          </div>
        </dl>

        <p className="mt-4 pt-4 border-t border-line text-xs text-text-secondary font-medium leading-relaxed">
          {REVIEW_NOTICE}
        </p>
      </section>

      {/* ② 연결 코드 */}
      <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-1">연결 코드</h2>
        <p className="text-xs text-text-tertiary mb-4 leading-relaxed">
          확장 프로그램에 이 코드를 입력하면 연결돼요. 코드는 한 번만 쓸 수 있어요.
        </p>

        {/* 코드 갱신·만료를 스크린리더에 알린다. 초 단위 숫자는 여기 넣지 않는다 —
            1초마다 다시 읽어 주면 화면을 못 보는 사람에게는 소음이 된다. */}
        <p role="status" aria-live="polite" className="sr-only">
          {codeLive
            ? `연결 코드 ${pair.code.split('').join(' ')}. ${pair.ttlSeconds}초 안에 확장 프로그램에 입력하세요.`
            : codeExpired
              ? '연결 코드가 만료됐어요. 다시 만들어 주세요.'
              : ''}
        </p>

        {!pair && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={createCode.isPending}
            className="min-h-[44px] px-4 py-2.5 rounded-lg bg-brand text-bg text-sm font-medium hover:bg-accent active:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {createCode.isPending ? '만드는 중...' : '연결 코드 만들기'}
          </button>
        )}

        {codeLive && (
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold font-mono tabular-nums tracking-[0.18em] text-text-primary">
                {pair.code}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(pair.code)}
                aria-label="연결 코드 복사"
                className="min-h-[44px] min-w-[44px] px-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line text-xs font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-success">
                    <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="1" width="7.5" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M1 4.5h3M1 4.5v7.5h7.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            {/* 초 단위 표시는 위 live 영역이 이미 안내했다 — 중복 낭독 방지 */}
            <p aria-hidden="true" className="mt-3 text-xs text-text-tertiary">
              <span className="font-mono tabular-nums text-text-secondary">{remaining}초</span> 뒤에 만료돼요
            </p>
          </div>
        )}

        {codeExpired && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-text-tertiary">연결 코드가 만료됐어요.</p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={createCode.isPending}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-brand text-bg text-sm font-medium hover:bg-accent active:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {createCode.isPending ? '만드는 중...' : '다시 만들기'}
            </button>
          </div>
        )}
      </section>

      {/* ③ 연결된 기기 */}
      <section className="bg-surface-2 border border-line rounded-xl p-5">
        {/* 🔴 KST 안내는 **날짜가 실제로 보일 때만** 붙인다 — 0건 화면에서는 설명할 시각이
            없어 빈 줄만 남는다 */}
        <h2 className="text-sm font-semibold mb-4">연결된 기기</h2>

        {sessions.isPending && (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="h-12 bg-surface-3 rounded-lg animate-pulse" />
            <div className="h-12 bg-surface-3 rounded-lg animate-pulse" />
          </div>
        )}

        {sessions.isError && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-text-tertiary">목록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="min-h-[44px] px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {sessions.isSuccess && sessions.data.length === 0 && (
          <div className="py-2">
            <p className="text-sm text-text-secondary mb-1">아직 연결된 확장이 없어요.</p>
            <p className="text-xs text-text-tertiary leading-relaxed">
              확장 프로그램을 설치한 뒤 위 [연결 코드 만들기] 로 연결해 주세요.
              설치 안내는 준비되는 대로 이 자리에 올라옵니다.
            </p>
          </div>
        )}

        {sessions.isSuccess && sessions.data.length > 0 && (
          <>
            <p className="text-xs text-text-tertiary mb-1">
              시각은 한국 시간(KST) 기준이에요.
            </p>
            <ul>
            {sessions.data.map((s) => {
              const created = formatDay(s.createdAt)
              const lastUsed = formatDay(s.lastUsedAt)
              return (
                <li
                  key={s.id}
                  className="py-3.5 border-b border-line last:border-0 first:pt-0 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span aria-hidden="true" className="hidden sm:block text-xl w-7 text-center">
                    🧩
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono break-all">
                      {formatFingerprint(s.deviceFingerprint)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                      <span>연결 {created ?? '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span>마지막 사용 {lastUsed ?? '기록 없음'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarget(s)}
                    className="self-start sm:self-auto shrink-0 min-h-[44px] px-4 py-2.5 rounded-lg border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
                  >
                    연결 해제
                  </button>
                </li>
              )
            })}
            </ul>
          </>
        )}
      </section>

      {/* 해제 확인 — 공용 Modal (직접 fixed inset-0 금지 · 입력이 없어 autoFocus 자체가 없다) */}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="연결 해제 확인"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          이 기기의 확장 연결을 해제할까요? 해제하면 확장이 더 이상 내 정보 창고를 읽지 못해요.
          다시 쓰려면 연결 코드를 새로 만들어야 해요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTarget(null)}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg border border-line text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-danger text-text-primary text-sm font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {disconnect.isPending ? '해제 중...' : '연결 해제'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
