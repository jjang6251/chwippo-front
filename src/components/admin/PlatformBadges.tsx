import { Monitor, Smartphone } from 'lucide-react'

/**
 * 회원 **사용 환경** 뱃지 — 웹/앱을 각각 독립 뱃지로 그린다.
 *
 * 🔴 **둘 다 쓰는 사람은 뱃지 2개가 나란히 뜬다.** 하나로 합친 아이콘(📱💻)보다
 * 이쪽이 "둘 다" 를 한눈에 읽게 한다 — 목록에서 **훑어보는 게 이 컬럼의 존재 이유**다.
 *
 * 색은 상태가 아니라 **분류**다 (성공/경고 아님). 두 개를 서로 다른 의미 색 alpha 로 둬서
 * 스캔이 되게 하되, brand(sage)·accent(coral) 는 쓰지 않는다 — 그건 CTA·특별 강조 전용이다.
 *
 * 판정 근거는 서버가 준다 (`user-platform.ts` — 목록·상세·대시보드 공통 규칙).
 */
export interface PlatformUsage {
  app: boolean
  web: boolean
  /** 푸시 토큰 보유 = 알림이 실제로 닿는다 (앱 사용과 별개 — 권한 거부자는 app=true 이나 false) */
  pushCapable?: boolean
}

interface Props {
  platform: PlatformUsage | undefined
  /** true 면 아이콘만 (좁은 화면·조밀한 표) */
  compact?: boolean
}

const BASE =
  'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border'

export function PlatformBadges({ platform, compact = false }: Props) {
  // 서버 응답을 신뢰하지 않는다 — 배포 창에서 필드가 아직 없을 수 있다
  const app = platform?.app ?? false
  const web = platform?.web ?? false

  if (!app && !web) {
    return (
      <span className="text-text-quaternary text-xs" title="로그인 이력 없음">
        —
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {web && (
        <span className={`${BASE} text-info bg-info/10 border-info/20`} title="웹으로 로그인한 이력 있음">
          <Monitor className="w-3 h-3" aria-hidden />
          {!compact && '웹'}
          {compact && <span className="sr-only">웹</span>}
        </span>
      )}
      {app && (
        <span
          className={`${BASE} text-violet bg-violet/10 border-violet/20`}
          title={
            platform?.pushCapable === false
              ? '앱으로 로그인한 이력 있음 · 알림 미허용 (푸시가 닿지 않음)'
              : '앱으로 로그인한 이력 있음'
          }
        >
          <Smartphone className="w-3 h-3" aria-hidden />
          {!compact && '앱'}
          {compact && <span className="sr-only">앱</span>}
          {/*
            알림 미허용 앱 사용자 — 푸시를 보내도 안 닿으므로 운영에서 구분이 필요하다.

            🔴 **점 하나로만 표시하면 색·모양만으로 정보를 전달하는 것**이 된다. `title` 은
            보조 수단이 못 된다 — 키보드·터치에서 안 뜨고, 이미 텍스트가 있는 요소에서는
            스크린리더가 무시하기도 한다. 그래서 sr-only 로 뜻을 함께 준다.
          */}
          {platform?.pushCapable === false && (
            <>
              <span className="w-1 h-1 rounded-full bg-warning inline-block" aria-hidden />
              <span className="sr-only">알림 미허용</span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
