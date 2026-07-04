import { useAlarmConfig, useUpdateAlarmConfig } from '@/hooks/useNotifications'
import { useNativeMode } from '@/hooks/useNativeMode'
import { Toggle } from '@/components/common/Toggle'
import { toast } from '@/stores/toastStore'
import { postToNative } from '@/utils/nativeBridge'
import type { DeadlinePoints } from '@/types/notification'

const DEADLINE_OPTIONS: { value: DeadlinePoints; label: string; desc: string }[] =
  [
    { value: 'd1', label: 'D-1', desc: '하루 전' },
    { value: 'd3', label: 'D-3', desc: '3일 전 (기본)' },
    { value: 'd7', label: 'D-7', desc: '일주일 전' },
  ]

export function AlarmSettings() {
  const { data: config, isLoading, isError } = useAlarmConfig()
  const update = useUpdateAlarmConfig()
  const isNative = useNativeMode()

  function patch(partial: Parameters<typeof update.mutate>[0]) {
    update.mutate(partial, {
      onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
    })
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <h1 className="text-xl font-bold mb-1">알림 설정</h1>
      <p className="text-sm text-text-tertiary mb-6">
        마감·면접을 앱을 열지 않아도 챙겨드려요. 하루 최대 2번만 보내요.
      </p>

      {isLoading && <AlarmSkeleton />}
      {isError && (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-sm text-text-tertiary">
          알림 설정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {config && (
        <>
          {/* 마스터 */}
          <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">전체 알림</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  끄면 아래 일정 알림을 받지 않아요.
                </p>
              </div>
              <Toggle
                checked={config.master}
                onChange={(v) => patch({ master: v })}
                label="전체 알림"
              />
            </div>
          </section>

          {/* 일정 알림 그룹 (master off 시 dim) */}
          <section
            className={`bg-surface-2 border border-line rounded-xl divide-y divide-line mb-4 transition-opacity ${
              config.master ? '' : 'opacity-40 pointer-events-none'
            }`}
            aria-disabled={!config.master}
          >
            {/* 아침 브리핑 */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">아침 브리핑</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    매일 오전 8시 · 그날 챙길 마감·면접·시험을 한 번에
                  </p>
                </div>
                <Toggle
                  checked={config.briefingEnabled}
                  onChange={(v) => patch({ briefingEnabled: v })}
                  disabled={!config.master}
                  label="아침 브리핑"
                />
              </div>

              {/* 알림 포인트 */}
              {config.briefingEnabled && (
                <div className="mt-4">
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
                          onClick={() => patch({ deadlinePoints: opt.value })}
                          className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
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
                </div>
              )}
            </div>

            {/* 마감 임박 긴급 */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">마감 임박 알림</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    서류 마감 당일 오후 3시 · 아직 안 냈다면 한 번 더
                  </p>
                </div>
                <Toggle
                  checked={config.deadlineUrgentEnabled}
                  onChange={(v) => patch({ deadlineUrgentEnabled: v })}
                  disabled={!config.master}
                  label="마감 임박 알림"
                />
              </div>
            </div>
          </section>

          {/* 방해 금지 시간 안내 */}
          <div className="flex items-start gap-3 bg-info/8 border border-info/20 rounded-xl px-5 py-4 mb-4">
            <span className="text-base mt-0.5">🌙</span>
            <p className="text-xs text-text-tertiary leading-relaxed">
              밤 10시 ~ 아침 8시에는 알림을 보내지 않아요. (계정·결제 관련
              중요 안내는 예외)
            </p>
          </div>

          {/* 시스템 알림 안내 (opt-out 불가) */}
          <section className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">계정·중요 안내</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  계정 상태 변경 등 꼭 알아야 하는 알림은 항상 받아요.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-text-quaternary bg-card px-2.5 py-1 rounded-full">
                항상 켜짐
              </span>
            </div>
          </section>

          {/* 푸시 권한 (native 전용) */}
          {isNative && (
            <section className="bg-surface-2 border border-line rounded-xl p-5">
              <p className="text-sm font-semibold mb-1">기기 알림 권한</p>
              <p className="text-xs text-text-tertiary leading-relaxed mb-3">
                푸시 알림을 받으려면 기기 알림 권한이 필요해요. 언제든 이
                화면에서 다시 켤 수 있어요.
              </p>
              <button
                type="button"
                onClick={() =>
                  postToNative({ type: 'open-notification-settings' })
                }
                className="w-full rounded-lg bg-brand text-white text-sm font-semibold py-2.5 hover:bg-brand-hover transition-colors"
              >
                알림 권한 설정
              </button>
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
