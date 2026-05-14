// TODO: 유료 결제 도입 시 → 결제·환불·분쟁 조항 추가
// TODO: 사업자 등록 시 → 제1조 운영자 정보에 사업자 번호·주소 추가
// TODO: 광고 도입 시 → 광고 게재 관련 조항 추가

import { Link } from 'react-router-dom'

export function Terms() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">이용약관</h1>
        <p className="text-text-quaternary text-sm mb-12">시행일: 2026년 5월 14일</p>

        <DocSection title="제1조 (목적)">
          <p>
            이 약관은 치뽀(이하 "서비스")를 운영하는 장성원(이하 "운영자")이 제공하는
            취업 일정 관리 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
          </p>
        </DocSection>

        <DocSection title="제2조 (용어 정의)">
          <ul className="space-y-2">
            <DefItem label="서비스">치뽀 웹사이트 및 관련 기능 일체</DefItem>
            <DefItem label="회원">카카오 계정으로 로그인하여 서비스를 이용하는 자</DefItem>
            <DefItem label="콘텐츠">회원이 서비스 내에 입력·저장한 지원 정보, 자소서, 내 정보 등 일체</DefItem>
          </ul>
        </DocSection>

        <DocSection title="제3조 (약관의 효력 및 변경)">
          <p className="mb-3">
            이 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.
          </p>
          <p>
            운영자는 필요 시 약관을 변경할 수 있으며, 변경 시 시행일 7일 전 서비스 내 공지합니다.
            변경 후 계속 서비스를 이용하면 변경된 약관에 동의한 것으로 간주합니다.
          </p>
        </DocSection>

        <DocSection title="제4조 (서비스 제공)">
          <p className="mb-3">운영자는 다음 서비스를 제공합니다.</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>취업 지원 현황 카드 관리 (보드)</li>
            <li>전형 단계별 일정·메모 관리</li>
            <li>자기소개서 문항·답변 보관</li>
            <li>내 정보 창고 (학력·경험·자격증 등)</li>
            <li>캘린더 및 대시보드</li>
            <li>그 밖에 운영자가 추가하는 기능</li>
          </ul>
        </DocSection>

        <DocSection title="제5조 (회원 가입)">
          <p className="mb-3">
            서비스는 카카오 소셜 로그인으로만 가입할 수 있습니다.
            만 14세 미만은 서비스를 이용할 수 없습니다.
          </p>
          <p>
            회원은 타인의 카카오 계정을 무단으로 사용할 수 없습니다.
          </p>
        </DocSection>

        <DocSection title="제6조 (금지 행위)">
          <p className="mb-3">회원은 다음 행위를 해서는 안 됩니다.</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>타인의 개인정보를 무단으로 수집·저장하는 행위</li>
            <li>자동화 스크립트 등으로 서버에 과도한 부하를 주는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>관련 법령을 위반하는 행위</li>
          </ul>
        </DocSection>

        <DocSection title="제7조 (콘텐츠의 소유권)">
          <p>
            회원이 서비스에 입력한 콘텐츠의 저작권은 회원에게 있습니다.
            운영자는 서비스 제공 목적 외에 회원의 콘텐츠를 무단으로 사용하지 않습니다.
          </p>
        </DocSection>

        <DocSection title="제8조 (서비스 변경·중단)">
          <p className="mb-3">
            운영자는 서비스 내용을 변경하거나 중단할 수 있습니다.
            중단 시 최소 7일 전 서비스 내 공지하며, 불가피한 경우 사후 공지할 수 있습니다.
          </p>
          <p>
            서비스 중단 전 회원은 콘텐츠를 직접 삭제하거나 복사할 수 있습니다.
          </p>
        </DocSection>

        <DocSection title="제9조 (면책 조항)">
          <ul className="space-y-1.5 list-disc list-inside">
            <li>천재지변, 서버 장애 등 불가항력에 의한 서비스 중단에 대해 책임지지 않습니다.</li>
            <li>회원이 서비스에 입력한 정보의 정확성에 대해 책임지지 않습니다.</li>
            <li>무료 서비스의 특성상 서비스 가용성을 보장하지 않습니다.</li>
          </ul>
        </DocSection>

        <DocSection title="제10조 (준거법 및 분쟁 해결)">
          <p>
            이 약관은 대한민국 법률에 따라 규율됩니다.
            서비스 이용과 관련한 분쟁이 발생할 경우 운영자와 회원이 성실히 협의하며,
            합의가 이루어지지 않을 경우 관할 법원은 민사소송법에 따릅니다.
          </p>
        </DocSection>

        <div className="mt-12 pt-6 border-t border-white/5 text-text-quaternary text-xs">
          운영자: 장성원 ·{' '}
          <Link to="/inquiry" className="text-brand hover:underline">문의하기</Link>
        </div>
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

function DefItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className="text-text-quaternary flex-shrink-0">"{label}"란</span>
      <span className="text-text-secondary">{children}를 말합니다.</span>
    </li>
  )
}
