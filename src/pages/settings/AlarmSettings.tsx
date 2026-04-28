export function AlarmSettings() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-2">알림 설정</h1>
      <p className="text-sm text-text-muted mb-8">카카오 친구톡 알림 기능은 준비 중이에요.</p>

      <div className="bg-surface-2 border border-white/5 rounded-xl divide-y divide-white/5">
        {[
          { label: 'D-7 마감 알림', desc: '서류 마감 7일 전 알림' },
          { label: 'D-3 마감 알림', desc: '서류 마감 3일 전 알림' },
          { label: 'D-1 마감 알림', desc: '서류 마감 하루 전 알림' },
          { label: '면접 당일 알림', desc: '면접 당일 오전 9시 알림' },
          { label: '결과 입력 요청', desc: '마감일 지난 카드 결과 입력 요청' },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">{desc}</p>
            </div>
            <button
              disabled
              className="relative w-10 h-5.5 rounded-full bg-white/10 opacity-40 cursor-not-allowed"
              title="준비 중"
            >
              <span className="absolute left-1 top-1 w-3.5 h-3.5 rounded-full bg-white/50 transition-transform" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-brand/5 border border-brand/15 rounded-xl p-4">
        <p className="text-xs text-brand/80 leading-relaxed">
          카카오 친구톡 알림은 채널 심사가 완료되는 대로 순차적으로 활성화됩니다.
          출시 알림을 받고 싶다면 문의하기로 연락해주세요.
        </p>
      </div>
    </div>
  )
}
