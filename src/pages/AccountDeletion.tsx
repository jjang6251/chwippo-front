// 계정 삭제 안내 — Google Play "데이터 보안" 이 요구하는 **공개 페이지**다.
// 로그인 없이 열려야 하고(Play Console 에 URL 을 그대로 등록한다), 앱 안에서 실제로
// 할 수 있는 것과 **한 글자도 어긋나면 안 된다.**
//
// 🔴 문구의 원천은 이 파일이 아니라 **실제 UI** 다 —
//    `pages/settings/ProfileSettings.tsx` 의 "계정 탈퇴" 섹션 안내문을 그대로 가져왔다.
//    여기서 새 표현을 만들면 안내와 실제가 조용히 갈라진다.
// 🔴 보유·파기 기간을 **여기서 새로 쓰지 않는다.** 기준은 개인정보처리방침(§3·§6) 하나이고
//    이 페이지는 링크로 위임만 한다. 두 군데에 적으면 한쪽만 갱신되는 날이 온다.

import { Link, useNavigate } from 'react-router-dom'

export function AccountDeletion() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <main className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 py-1 text-sm text-text-quaternary hover:text-text-secondary transition-colors mb-8"
        >
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold mb-2">계정 삭제 안내</h1>
        <p className="text-text-quaternary text-sm mb-12">
          치뽀 계정과 계정에 저장된 데이터를 삭제하는 방법을 안내합니다.
        </p>

        <DocSection title="방법 1 — 앱·웹에서 직접 삭제 (즉시)">
          <p className="mb-3">앱 또는 웹에서 아래 순서로 직접 삭제할 수 있습니다.</p>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>치뽀에 로그인합니다.</li>
            <li>설정 → 프로필 설정으로 이동합니다.</li>
            <li>화면 아래 계정 탈퇴에서 탈퇴하기를 누릅니다.</li>
            <li>확인 창에서 탈퇴하기를 한 번 더 누르면 즉시 처리됩니다.</li>
          </ol>
          <p className="mt-3">
            탈퇴 시 지원 카드, 내 정보, 업로드한 파일 등 모든 데이터가 즉시 삭제되며
            복구할 수 없습니다.
          </p>
          <p className="mt-2 text-text-quaternary text-xs">
            * 가입에 사용한 소셜 로그인(카카오·Apple) 연동도 함께 해제됩니다.
          </p>
        </DocSection>

        <DocSection title="방법 2 — 로그인이 어려운 경우">
          <p className="mb-3">
            소셜 계정 문제 등으로 로그인할 수 없다면 아래 주소로 요청해 주세요.
          </p>
          <p className="mb-3">
            <a
              href="mailto:support@chwippo.com?subject=계정 삭제 요청"
              className="text-brand hover:underline"
            >
              support@chwippo.com
            </a>
          </p>
          <p>
            가입에 사용한 계정(카카오 또는 Apple 로그인 여부와 이메일 주소)을 알려주시면,
            본인 확인 후 지체 없이 삭제 처리합니다.
          </p>
        </DocSection>

        <DocSection title="삭제되는 데이터">
          <p className="mb-3">계정 삭제 시 아래 데이터가 모두 삭제됩니다.</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>계정 정보 (이메일·닉네임)</li>
            <li>지원 카드 및 전형 일정</li>
            <li>자기소개서·준비 노트</li>
            <li>내 정보 창고 항목 (학력·자격증·경력·자소서 소재 등)</li>
            <li>업로드한 파일 전부</li>
          </ul>
          <p className="mt-3">
            세부 보유·파기 기준은{' '}
            <Link to="/privacy" className="text-brand hover:underline">
              개인정보처리방침
            </Link>
            을 따릅니다.
          </p>
        </DocSection>
      </main>
    </div>
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}
