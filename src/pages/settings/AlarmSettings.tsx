const ALARMS = [
  { icon: '📅', label: 'D-7 마감 알림', desc: '서류 마감 7일 전 오전 9시' },
  { icon: '📌', label: 'D-3 마감 알림', desc: '서류 마감 3일 전 오전 9시' },
  { icon: '🔔', label: 'D-1 마감 알림', desc: '서류 마감 하루 전 오전 9시' },
  { icon: '🗓️', label: '면접 당일 알림', desc: '면접 일정 당일 오전 9시' },
  { icon: '⚠️', label: '결과 입력 요청', desc: '마감일 지난 카드 결과 미입력 시' },
]

export function AlarmSettings() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-1">알림 설정</h1>
      <p className="text-sm text-text-muted mb-8">카카오 친구톡 알림을 준비하고 있어요.</p>

      {/* 준비 중 배너 */}
      <div className="flex items-start gap-3 bg-brand/5 border border-brand/15 rounded-xl px-5 py-4 mb-6">
        <span className="text-xl mt-0.5">🚧</span>
        <div>
          <p className="text-sm font-semibold text-brand mb-1">알림 기능 준비 중</p>
          <p className="text-xs text-text-muted leading-relaxed">
            카카오 채널 심사가 완료되는 대로 순차적으로 활성화됩니다.
            출시 알림을 받고 싶다면 문의하기로 연락해주세요.
          </p>
        </div>
      </div>

      {/* 알림 항목 목록 */}
      <div className="flex flex-col gap-2">
        {ALARMS.map(({ icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 bg-surface-2 border border-white/5 rounded-xl px-5 py-4 opacity-50"
          >
            <span className="text-xl w-7 text-center">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">{desc}</p>
            </div>
            {/* 비활성 토글 */}
            <div className="relative w-10 h-6 rounded-full bg-white/10 flex-shrink-0 cursor-not-allowed">
              <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/40 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
