import { useEffect, useRef, useState } from 'react'
import { useAlarmConfig, useUpdateAlarmConfig } from '@/hooks/useNotifications'
import { useNativeMode } from '@/hooks/useNativeMode'
import { BETA_FEATURES } from '@/config/betaFeatures'
import { Toggle } from '@/components/common/Toggle'
import { toast } from '@/stores/toastStore'
import { postToNative } from '@/utils/nativeBridge'
import type {
  BriefingHour,
  DeadlinePoints,
  EventToggles,
} from '@/types/notification'

const DEADLINE_OPTIONS: { value: DeadlinePoints; label: string; desc: string }[] =
  [
    { value: 'd1', label: 'D-1', desc: '하루 전부터' },
    { value: 'd3', label: 'D-3', desc: '3일 전부터 (기본)' },
    { value: 'd7', label: 'D-7', desc: '일주일 전부터' },
  ]

/** ⑧ 브리핑 발송 시각 (KST · 07~10시) */
const HOUR_OPTIONS: BriefingHour[] = [7, 8, 9, 10]

/** ⑨ 브리핑에 담을 유형 토글 5종 */
const EVENT_TOGGLE_META: { key: keyof EventToggles; label: string }[] = [
  { key: 'deadline', label: '서류 마감' },
  { key: 'interview', label: '면접' },
  { key: 'exam', label: '시험' },
  { key: 'resultDate', label: '결과 발표' },
  { key: 'todo', label: '할 일' },
]

export function AlarmSettings() {
  const { data: config, isLoading, isError } = useAlarmConfig()
  const update = useUpdateAlarmConfig()
  const isNative = useNativeMode()

  // U24 — 저장 성공 피드백: "저장됨 ✓" 2초 노출 (자소서 자동저장 피드백과 동일 문법)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  // U24 — 저장 중 토글 disabled (연타 mutate 경쟁 방지)
  const saving = update.isPending

  function patch(partial: Parameters<typeof update.mutate>[0]) {
    update.mutate(partial, {
      onSuccess: () => {
        setJustSaved(true)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setJustSaved(false), 2000)
      },
      onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
    })
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold">알림 설정</h1>
        {/* U24 — 저장 피드백 (aria-live 로 스크린리더 통지) */}
        <span className="text-xs font-medium" aria-live="polite">
          {justSaved && <span className="text-success">저장됨 ✓</span>}
        </span>
      </div>
      <p className="text-sm text-text-tertiary mb-6">
        마감·면접을 앱을 열지 않아도 챙겨드려요. 꼭 필요한 순간에만 보내요 —
        아침 브리핑 1통 + 임박 알림.
      </p>

      {isLoading && <AlarmSkeleton />}
      {isError && (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-sm text-text-tertiary">
          알림 설정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {config && (
        <>
          {/* 전체 알림 — 채널 3종 select-all (약관 전체동의 문법 · 파생 표시) */}
          <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">전체 알림</h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  모든 알림을 한 번에 켜고 꺼요.
                </p>
              </div>
              <Toggle
                checked={
                  config.briefingEnabled &&
                  config.deadlineUrgentEnabled &&
                  config.imminentEnabled
                }
                onChange={(v) =>
                  patch({
                    briefingEnabled: v,
                    deadlineUrgentEnabled: v,
                    imminentEnabled: v,
                  })
                }
                disabled={saving}
                label="전체 알림"
              />
            </div>
          </section>

          {/* 일정 알림 채널 — 항상 개별 조작 가능 */}
          <section className="bg-surface-2 border border-line rounded-xl divide-y divide-line mb-4">
            {/* 아침 브리핑 */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">아침 브리핑</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    매일 오전 {config.briefingHour}시 · 그날 챙길
                    마감·면접·시험을 한 번에
                  </p>
                </div>
                <Toggle
                  checked={config.briefingEnabled}
                  onChange={(v) => patch({ briefingEnabled: v })}
                  disabled={saving}
                  label="아침 브리핑"
                />
              </div>

              {/* 브리핑 하위 설정 — 시각 · 알림 포인트 · 유형 토글 */}
              {config.briefingEnabled && (
                <div className="mt-4 space-y-4">
                  {/* ⑧ 브리핑 받을 시각 (4택) */}
                  <div>
                    <p className="text-[11px] font-medium text-text-quaternary uppercase tracking-wide mb-2">
                      브리핑 받을 시각
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {HOUR_OPTIONS.map((h) => {
                        const active = config.briefingHour === h
                        return (
                          <button
                            key={h}
                            type="button"
                            aria-pressed={active}
                            onClick={() => patch({ briefingHour: h })}
                            disabled={saving}
                            className={`min-h-[44px] rounded-lg border px-3 py-2.5 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'border-brand bg-brand/10 text-brand'
                                : 'border-line bg-input text-text-secondary hover:border-line-strong'
                            }`}
                          >
                            <span className="block text-sm font-semibold font-mono">
                              {h}시
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 알림 포인트 (누적 프리셋) */}
                  <div>
                    <p className="text-[11px] font-medium text-text-quaternary uppercase tracking-wide mb-2">
                      며칠 전부터 알림
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {DEADLINE_OPTIONS.map((opt) => {
                        const active = config.deadlinePoints === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => patch({ deadlinePoints: opt.value })}
                            disabled={saving}
                            className={`min-h-[44px] rounded-lg border px-3 py-2.5 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'border-brand bg-brand/10 text-brand'
                                : 'border-line bg-input text-text-secondary hover:border-line-strong'
                            }`}
                          >
                            <span className="block text-sm font-semibold font-mono">
                              {opt.label}
                            </span>
                            <span className="block text-[10px] text-text-quaternary mt-0.5">
                              {opt.desc}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-text-quaternary leading-relaxed">
                      선택한 날부터 당일 아침까지 모두 챙겨드려요. 예) D-3부터 =
                      D-3 · D-1 · 당일 아침 모두 알림.
                    </p>
                  </div>

                  {/* ⑨ 브리핑에 담을 유형 (토글 5종) */}
                  <div>
                    <p className="text-[11px] font-medium text-text-quaternary uppercase tracking-wide mb-2">
                      브리핑에 담을 유형
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TOGGLE_META.map(({ key, label }) => {
                        const active = config.eventToggles[key]
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              const next: Partial<EventToggles> = {
                                [key]: !active,
                              }
                              patch({ eventToggles: next })
                            }}
                            disabled={saving}
                            className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'border-brand bg-brand/10 text-brand'
                                : 'border-line bg-input text-text-tertiary hover:border-line-strong'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-text-quaternary leading-relaxed">
                      켜진 유형만 아침 브리핑에 담아요.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 마감 당일 알림 (15:00) */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">마감 당일 알림</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    서류 마감 당일 오후 3시, 아직 제출 전이면 알려드려요
                  </p>
                </div>
                <Toggle
                  checked={config.deadlineUrgentEnabled}
                  onChange={(v) => patch({ deadlineUrgentEnabled: v })}
                  disabled={saving}
                  label="마감 당일 알림"
                />
              </div>
            </div>

            {/* 일정 2시간 전 알림 (imminent) */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">일정 2시간 전 알림</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    시간이 입력된 면접·시험 2시간 전에 알려드려요
                  </p>
                </div>
                <Toggle
                  checked={config.imminentEnabled}
                  onChange={(v) => patch({ imminentEnabled: v })}
                  disabled={saving}
                  label="일정 2시간 전 알림"
                />
              </div>
            </div>
          </section>

          {/* 방해 금지 시간 안내 */}
          <div className="flex items-start gap-3 bg-info/8 border border-info/20 rounded-xl px-5 py-4 mb-4">
            <span className="text-base mt-0.5" aria-hidden>
              🌙
            </span>
            <p className="text-xs text-text-tertiary leading-relaxed">
              밤 10시 ~ 아침 7시에는 아침 브리핑·마감 당일 알림을 보내지
              않아요. 일정 2시간 전 알림과 계정 관련 중요 안내는 예외예요.
            </p>
          </div>

          {/* 시스템 알림 안내 (opt-out 불가) */}
          <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">계정·중요 안내</h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  계정 상태 변경 등 꼭 알아야 하는 알림은 항상 받아요.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-text-quaternary bg-card px-2.5 py-1 rounded-full">
                항상 켜짐
              </span>
            </div>
          </section>

          {/* 푸시 권한 (native 전용 · nativePushReady flip 후 노출) */}
          {isNative && BETA_FEATURES.nativePushReady && (
            <section className="bg-surface-2 border border-line rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-1">기기 알림 권한</h2>
              <p className="text-xs text-text-tertiary leading-relaxed mb-3">
                푸시 알림을 받으려면 기기 알림 권한이 필요해요. 언제든 이
                화면에서 다시 켤 수 있어요.
              </p>
              <button
                type="button"
                onClick={() =>
                  postToNative({ type: 'open-notification-settings' })
                }
                className="w-full rounded-lg bg-brand text-bg text-sm font-semibold py-2.5 hover:bg-brand-hover transition-colors"
              >
                알림 권한 설정
              </button>
            </section>
          )}

          {/* U3 — 웹 사용자 대상 안내 (푸시는 앱에서만 · 웹은 알림센터로 확인) */}
          {!isNative && (
            <section className="flex items-start gap-3 bg-info/8 border border-info/20 rounded-xl px-5 py-4">
              <span className="text-base mt-0.5" aria-hidden>
                💻
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  웹에서는 푸시 알림이 오지 않아요
                </h2>
                <p className="text-xs text-text-tertiary leading-relaxed mt-0.5">
                  마감·면접 푸시 알림은 앱에서 받아요. 웹에서는 상단 종
                  아이콘의 알림센터에서 확인할 수 있어요.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function AlarmSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface-2 border border-line rounded-xl p-5 animate-pulse"
        >
          <div className="h-4 w-32 bg-card-strong rounded mb-2" />
          <div className="h-3 w-48 bg-card rounded" />
        </div>
      ))}
    </div>
  )
}
