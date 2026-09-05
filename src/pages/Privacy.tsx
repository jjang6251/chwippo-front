// TODO: AI 기능(F1·F2) 출시 시 → §5 위탁 업체에 Anthropic 추가, §1 수집 항목에 "AI 처리용 입력 텍스트" 추가
// TODO: 유료 결제 도입 시 → 결제 수탁업체(PG사) 추가, §3 보유 기간에 전자상거래법 5년 명시
// TODO: 사업자 등록 시 → §8 개인정보 보호책임자에 사업자 정보 추가
// 갱신 이력:
// - 2026-09-06 공고 / **2026-09-06 즉시 시행** (CEO 결정): 내 정보 창고 확장(대장 44 · 1단계 웹 선행
//   릴리즈). §1 항목 확장 + **장애 정보(민감정보) 별도 동의** 신설 + 고유식별정보 미수집 명시 + §2 가명 통계
//   + §3·§6·§7 철회 시 즉시 삭제·철회 방법 + §6-1 안전성 확보조치(앱 단계 AES-256-GCM 암호화) 신설.
//   🔴 **§9 「시행일 7일 전 공지」와 어긋난다.** 8/4 와 같은 즉시 시행이며 기록으로 남긴다 — 근거: 신규 항목은
//      전부 선택 입력이고 민감정보(장애)는 이용자가 별도 동의를 누른 뒤에만 수집되므로, 이용자 모르게 시작되는
//      처리가 없어 유예 없이 시행(CEO 결정). **공고일 = 운영 배포일** — main 머지가 다른 날이면 그 날짜로
//      고쳐 릴리즈한다.
//   🔴 **순서** — 방침·기능 같은 배포. 확장(브라우저 확장) 조항 §5-3·약관 제7조의4 는 2단계 릴리즈로
//      이동 — `plans/autofill-extension-policy-drafts.md`.
// - 2026-09-03 공고 / **2026-09-10 시행** (§9 「시행일 7일 전 공지」 준수): §5 수탁업체에 Meta Platforms 추가 +
//   §5-2 에 온라인 맞춤형 광고(Meta Pixel) 항목·보유 기간·거부 방법 추가.
//   🔴 **8/4 의 즉시 시행을 선례로 삼지 않았다** — 그 개정 주석이 "다음 개정 때 이 선례를 근거로 삼지 말 것"
//      이라고 남겨둔 그대로다. Clarity 와 마찬가지로 **신규 수집**이므로 유예를 둔다.
//   🔴 **순서가 중요하다** — 방침 시행(9/10)이 먼저, `VITE_META_PIXEL_ID` 주입이 나중이다.
//      순서가 뒤집히면 고지가 0인 상태의 수집이 된다 (`src/lib/metaPixel.ts` 는 미설정 시 완전 no-op).
//   ⚠️ 공고일 = **운영 배포일**. develop 머지만으로는 공고가 아니다.
// - 2026-08-04 공고 / **2026-08-04 즉시 시행** (CEO 결정): §1 에 서비스 이용 분석(자동) + §5 수탁업체에 Microsoft(Clarity)·
//   Google(AdSense)·Vercel 추가 + §5-2 쿠키·행태정보 신설.
//   🔴 Google·Vercel 은 **새로 시작하는 것이 아니라 이미 하고 있던 것을 명확히 반영**한 것이다 —
//      AdSense 스크립트는 index.html 이 매 페이지 로드에서 붙이고 있었고, Vercel 은 프론트 호스팅이다.
//      2026-08-04 Clarity 도입 검토 중 방침과 실제의 불일치를 발견해 함께 정합화했다.
//   🔴 문안 정정 (초안 → 최종): "수집 자체를 하지 않습니다" 로 썼다가 **Clarity 에 수집 중단 API 가
//      없다는 것을 확인**하고 "마스킹되어 전송되지 않습니다" 로 고쳤다. SPA 라 스크립트가 한 번
//      로드되면 이후 라우팅까지 기록되므로 특정 화면만 제외할 수 없다. **지킬 수 없는 문구를 방침에
//      적으면 그 자체가 고지 위반이 된다.**
//   🔴 **§9 "시행일 7일 전 공지" 와 어긋난다.** 초안은 8/11 시행이었으나 CEO 가 즉시 시행을
//      결정했다. 기록으로 남긴다 — 다음 개정 때 이 선례를 근거로 삼지 말 것. Google·Vercel·쿠키
//      조항은 **이미 하던 처리의 정정**이라 유예가 불필요했지만, **Clarity 는 신규 수집**이다.
//   🔴 **순서가 중요하다** — 같은 날이어도 **방침 배포가 먼저, ID 주입이 나중**이다.
//      순서가 뒤집히면 고지가 0인 상태의 수집이 된다.
//   ⚠️ 공고일 = **운영 배포일**. develop 머지만으로는 공고가 아니다.
// - 2026-07-28 공고 / 2026-08-04 시행: §1에 서비스 오류 진단 정보 + §5 수탁업체에 Sentry 추가.
//   출시(7/26) 후 첫 개정이라 §10 "시행일 7일 전 공지" 조항을 준수 — 공고와 시행 사이 7일.
//   ⚠️ Sentry DSN 은 **시행일(8/4)에 주입**한다. 방침보다 먼저 켜면 고지 없는 수집이 된다.
//   ⚠️ 공고일 = **운영 배포일**. 개정 커밋을 7/27 에 만들고 main 배포를 안 해 하루 밀렸다
//      (develop 머지만으로는 공고가 아니다). 다음 개정 때도 배포일 기준으로 날짜를 적을 것.
// - 2026-05-18 (PR DD, LRR Phase 5-B): §1에 user_profiles 8필드(실명·전화·이메일·생년월일·병역) 명시 + §5 수탁업체 정합 (AWS S3 → R2, Railway·Cloudflare·GitHub Actions 추가)
// - 2026-05-14: 초안

import { Link, useNavigate } from 'react-router-dom'
import { AiConsentToggle } from '@/components/common/AiConsentToggle'

export function Privacy() {
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
        <h1 className="text-2xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-text-quaternary text-sm mb-2">시행일: 2026년 9월 6일</p>
        <p className="text-text-tertiary text-xs mb-12 leading-relaxed">
          이 방침은 2026년 9월 6일 공고되어 같은 날 시행됩니다 (신규 항목은 선택 입력·민감정보는
          별도 동의 뒤에만 수집되어 즉시 시행). 변경 내용은 아래 페이지 하단에 정리되어 있습니다.
        </p>

        <DocSection title="1. 수집하는 개인정보 항목">
          <p className="mb-3">치뽀는 다음과 같은 개인정보를 수집합니다.</p>
          <Table
            headers={['구분', '항목', '수집 시점']}
            rows={[
              ['카카오 로그인 (필수)', '이메일, 닉네임, 카카오 고유 식별자', '회원 가입 시'],
              [
                'Apple 로그인 (필수)',
                "이름, 이메일(사용자가 '이메일 가리기' 선택 시 Apple 중계 주소), Apple 고유 식별자",
                '회원 가입 시',
              ],
              [
                '내 정보 창고 — 프로필 (선택)',
                '실명·한자 이름·영문 이름·성별·생년월일·전화번호·개인 이메일·주소(우편번호·기본·상세 주소·시/도)·국적·병역 정보(복무 상태·군별·계급·병과·복무 기간·제대 구분·면제 사유)·보훈 대상 여부(보훈번호·관계·가점 비율)·학습 목표(목표 자격증 등)',
                '본인이 직접 입력 시',
              ],
              [
                '내 정보 창고 — 비상 연락처 (선택)',
                '비상 연락처 전화번호·관계 (가족 등 제3자의 정보 — 본인이 해당인의 동의를 받아 입력)',
                '본인이 직접 입력 시',
              ],
              [
                '내 정보 창고 — 장애 정보 (선택 · 별도 동의)',
                '장애 여부·장애 정도·장애 유형·장애인 등록번호 — 민감정보로, 별도 동의를 받은 경우에만 저장',
                '별도 동의 후 본인이 직접 입력 시',
              ],
              [
                '내 정보 창고 — 자격·이력 (선택)',
                '자격증·어학·상장·학력(학교·전공·성적·본교/분교·주야간·입학 구분·총 이수학점·검정고시 여부)·활동/경험(인턴·프로젝트·동아리 등)·자기소개서 소재·추가 정보(취미·특기 등 지원서에 자주 묻는 항목)·지원 서류(증명사진·이력서·포트폴리오 파일 또는 링크·경력기술서·학력 항목에 붙이는 성적/졸업증명서·어학 항목에 붙이는 성적표·그 밖의 PDF/이미지 파일)',
                '본인이 직접 입력·업로드 시',
              ],
              ['지원 관리', '지원 카드(회사명·직무·일정·메모), 회사별 자소서 답변, 시험 일정', '서비스 이용 중'],
              ['일정·메모', '캘린더 일정·할 일 메모', '서비스 이용 중'],
              ['고객 응대', '문의 내용·댓글', '문의 작성 시'],
              ['계정 관리', '계정 정지 일시 (운영 정책 위반 시에만 기록)', '계정 제한 조치 시'],
              [
                '서비스 오류 진단 (자동)',
                '오류 메시지·오류가 발생한 화면 주소·브라우저 및 운영체제 정보·IP 주소·회원 고유 식별자',
                '서비스 오류 발생 시에만',
              ],
              [
                '서비스 이용 분석 (자동)',
                '접속 기기·브라우저 정보, 방문 페이지·클릭·스크롤 등 행태정보, 광고 식별을 위한 쿠키',
                '서비스 이용 중',
              ],
            ]}
          />
          <p className="mt-3 text-text-quaternary text-xs">
            * 프로필·자격 정보는 모두 선택 입력이며, 입력하지 않아도 기본 서비스(지원 카드·일정 관리)는 이용할 수 있습니다.
          </p>
          <p className="mt-2 text-text-quaternary text-xs">
            * 민감정보(건강·신념·성적 지향·노조 가입·정치적 견해 등)는 원칙적으로 수집하지 않습니다. 다만{' '}
            <strong>장애 정보</strong>는 지원서 작성에 필요한 경우에 한해 본인이 <strong>별도로 동의</strong>한 뒤
            직접 입력할 때만 수집하며, 언제든 철회할 수 있습니다(§7).
          </p>
          <p className="mt-2 text-text-quaternary text-xs">
            * 주민등록번호·여권번호·운전면허번호·외국인등록번호는 어떤 경우에도 수집·저장하지 않으며, 입력 자체가
            차단됩니다.
          </p>
          <p className="mt-2 text-text-quaternary text-xs">
            * 서비스 오류 진단 정보에는 <strong>회원이 작성한 내용(자소서 답변·메모·내 정보 창고 입력값)이
            포함되지 않습니다.</strong> 오류 원인 파악에 필요한 최소 정보만 전송되며, 이메일·닉네임·인증
            토큰은 전송 전에 제거됩니다.
          </p>
        </DocSection>

        <DocSection title="2. 개인정보 수집 및 이용 목적">
          <ul className="space-y-1.5 list-disc list-inside">
            <li>회원 식별 및 서비스 로그인 처리</li>
            <li>취업 일정·자소서·내 정보 관리 기능 제공</li>
            <li>서비스 개선 및 오류 대응</li>
            <li>공지사항 전달 등 서비스 운영</li>
            <li>운영 정책 적용 (계정 제한·정지 조치)</li>
            <li>
              서비스 개선을 위한 통계 작성 — 개인을 식별할 수 없도록 가명처리한 정보(출생 연도·거주 지역·병역
              상태 등 코드값)만 집계하며, 개별 값은 이용하지 않습니다
            </li>
          </ul>
        </DocSection>

        <DocSection title="3. 개인정보 보유 및 이용 기간">
          <p className="mb-3">
            회원 탈퇴 시 수집한 개인정보 및 서비스 내 입력 데이터를 즉시 삭제합니다.
            장애 정보는 회원 탈퇴 또는 <strong>동의 철회 시 즉시 삭제</strong>합니다.
          </p>
          <p className="text-text-quaternary text-xs">
            단, 관련 법령에 의해 보존 의무가 있는 경우 해당 기간 동안 보관 후 파기합니다.
          </p>
        </DocSection>

        <DocSection title="4. 개인정보의 제3자 제공">
          <p>
            치뽀는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 아래의 경우는 예외입니다.
          </p>
          <ul className="mt-3 space-y-1.5 list-disc list-inside">
            <li>회원이 사전에 동의한 경우</li>
            <li>법령의 규정에 의하거나 수사·조사 목적으로 법령에 정해진 절차에 따른 경우</li>
          </ul>
        </DocSection>

        <DocSection title="5. 개인정보 처리 위탁">
          <p className="mb-3">치뽀는 서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁합니다.</p>
          <Table
            headers={['수탁 업체', '위탁 내용', '국외 이전']}
            rows={[
              ['Kakao Corp.', '소셜 로그인 인증', '국내'],
              ['Apple Inc.', '소셜 로그인 인증', '미국'],
              ['Railway Corp.', '데이터베이스·애플리케이션 호스팅', '미국'],
              ['Cloudflare, Inc.', '파일 저장(R2)·DNS·HTTPS·CDN', '미국·글로벌'],
              ['GitHub, Inc.', '서비스 가용성 모니터링 (헬스체크 cron)', '미국'],
              [
                'Functional Software, Inc. (Sentry)',
                '서비스 오류 로그 수집·분석 (오류 발생 시에만)',
                '미국',
              ],
              ['Vercel Inc.', '프론트엔드 웹 호스팅·CDN', '미국·글로벌'],
              [
                'Microsoft Corporation',
                '서비스 이용 행태 분석 (Clarity) — 화면 조작 기록. 입력·표시된 글의 내용은 마스킹되어 전송되지 않으며, 화면 구조와 클릭·스크롤 위치만 기록됩니다',
                '미국',
              ],
              ['Google LLC', '광고 게재 (AdSense)', '미국'],
              [
                'Meta Platforms, Inc.',
                '온라인 맞춤형 광고 성과 측정 (Meta Pixel) — 광고 식별 쿠키·광고 식별자와 방문 페이지·가입 완료 등 이용 기록. 회원이 작성한 내용(자소서·메모·내 정보 창고 입력값)은 전송되지 않습니다',
                '미국',
              ],
            ]}
          />
          <p className="mt-3 text-text-quaternary text-xs">
            * 모든 수탁 업체는 SOC2/ISO27001 등 국제 정보보안 표준을 준수합니다.
          </p>
          <div id="ai-consent" className="mt-3 p-3 bg-surface-2 border border-line rounded-md">
            <p className="font-medium mb-2">AI 기능 처리 위탁 (PIPA 26조)</p>
            <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
              <li>
                <strong>OpenAI, L.L.C.</strong> (미국) — 노트 요약·노트 AI, 자소서 초안 작성,
                자소서 AI 채팅, 자소서 심층 점검, 자소서에 넣을 활동 추천, 채용공고 요건 정리,
                면접 질문·꼬리질문·답변 생성. 사용자 입력 텍스트 처리 후 즉시 폐기, 학습 데이터
                미사용
              </li>
              <li>
                <strong>Anthropic, PBC</strong> (미국) — 위 기능의 <strong>장애 시 예비(폴백)</strong>{' '}
                처리. 동일 정책
              </li>
            </ul>
            <p className="mt-2 text-text-quaternary text-xs">
              위탁 업체 내에서 사용하는 구체적인 모델(버전)은 품질·비용에 따라 변경될 수 있으며,
              변경 시에도 위 업체·처리 목적·보관 정책은 동일하게 유지됩니다. 위탁 업체 자체가
              추가·변경되는 경우에는 본 방침을 개정하고 공지합니다.
            </p>
            <p className="mt-2 text-text-quaternary text-xs">
              사용자는 가입 시 별도 동의 (`ai_consent_at`) 가 필요하며, 동의 없이는 AI 기능을
              사용할 수 없습니다.
            </p>
            <div className="mt-3 pt-3 border-t border-line">
              <AiConsentToggle />
            </div>
          </div>
        </DocSection>

        <DocSection title="5-1. 회사 정보 수집·캐싱 (AI 면접 준비 기능)">
          <p className="mb-3">
            치뽀의 "면접 준비" 기능은 사용자가 지원한 회사 정보를 AI 가 공개 자료에서
            조사·요약해 제공합니다. 다음 정책을 따릅니다.
          </p>
          <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
            <li>
              <strong>수집 대상</strong>: 회사명·직무 (사용자가 입력한 지원 카드 데이터)
            </li>
            <li>
              <strong>출처 화이트리스트</strong>: 회사 공시 (DART), 주요 언론사 (조선·중앙·동아·한경·매경·서울경제),
              포털 뉴스 (네이버·다음), 위키피디아 — 그 외 사이트 정보는 사용하지 않음.
              특히 잡플래닛·블라인드·Glassdoor 등 면접 후기·연봉 사이트는 명시적으로 차단
            </li>
            <li>
              <strong>저장 형식</strong>: AI 가 생성한 요약 (derivative work) 만 저장. 원문 직접 복제 X.
              출처 URL 만 함께 기록 (사용자가 원본 확인 가능)
            </li>
            <li>
              <strong>보관 기간</strong>: 90일 (TTL). 만료 시 자동 갱신 또는 폐기
            </li>
            <li>
              <strong>개인정보 비포함</strong>: 임원 이름·연락처 등 개인 식별 정보 절대 수집·저장 안 함
            </li>
            <li>
              <strong>opt-out (회사 측 삭제 요청)</strong>: 회사 측에서 정보 삭제·차단 요청 시
              24시간 이내 처리 후 영구 차단합니다. 요청 채널:{' '}
              <a
                href="mailto:support@chwippo.com?subject=회사 정보 삭제 요청"
                className="text-brand hover:underline"
              >
                support@chwippo.com
              </a>
            </li>
          </ul>
          <p className="mt-3 text-text-quaternary text-xs">
            ⚠️ AI 가 생성한 정보는 참고용이며 정확성을 보장하지 않습니다.
            면접 전 회사 공식 자료로 반드시 확인하시기 바랍니다.
          </p>
        </DocSection>

        <DocSection title="5-2. 쿠키 및 행태정보">
          <p className="mb-3">
            치뽀는 서비스 개선과 광고 게재를 위해 쿠키 및 행태정보를 수집합니다.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-text-secondary">
            <li>
              <strong>서비스 이용 분석 (Microsoft Clarity)</strong> — 어느 화면에서 이용에
              어려움을 겪는지 파악해 개선하는 데 사용합니다.{' '}
              <strong className="text-text-primary">
                입력하거나 화면에 표시된 글의 내용은 마스킹되어 전송되지 않습니다.
              </strong>{' '}
              Clarity 에는 화면 구조와 클릭·스크롤 위치만 기록되며, 자기소개서·활동 기록·
              내 정보·문의 등 민감한 화면에는 마스킹을 추가로 적용합니다.
            </li>
            <li>
              <strong>광고 (Google AdSense)</strong> — 광고 게재에 사용됩니다.
            </li>
            <li>
              <strong>온라인 맞춤형 광고 (Meta Pixel — Meta Platforms, Inc.)</strong> — 광고를
              보고 들어온 방문이 실제 가입으로 이어졌는지 측정하고, 맞춤형 광고를 제공하는 데
              사용합니다. 수집 항목은{' '}
              <strong className="text-text-primary">
                광고 식별 쿠키·광고 식별자와 방문 페이지·가입 완료 등 이용 기록
              </strong>
              이며, 자기소개서·활동 기록·내 정보 등 회원이 작성한 내용은 전송되지 않습니다.
            </li>
          </ul>
          <p className="mt-3">
            <strong>보유·이용 기간</strong> — 행태정보는 수집일로부터 최대 2년간 보관하며, 그
            전이라도 분석·광고 목적이 달성되면 지체 없이 파기합니다. 각 수탁 업체(Microsoft·
            Google·Meta)로 전송된 정보의 보관 기간은 해당 업체의 데이터 정책을 따릅니다.
          </p>
          <p className="mt-3">
            <strong>거부 방법</strong> — 브라우저 설정에서 쿠키를 차단하거나,{' '}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Google 광고 설정
            </a>
            에서 맞춤 광고를 해제할 수 있습니다. Meta(페이스북·인스타그램) 맞춤 광고는{' '}
            <a
              href="https://www.facebook.com/adpreferences"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Meta 광고 설정
            </a>
            에서 해제할 수 있습니다. 쿠키를 차단해도 서비스 이용에는 지장이 없습니다.
          </p>
        </DocSection>


        <DocSection title="6. 개인정보의 파기">
          <p className="mb-3">
            보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
          </p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>데이터베이스 레코드: 회원 탈퇴 시 ON DELETE CASCADE로 즉시 삭제</li>
            <li>파일 저장소(R2): 회원 탈퇴 시 본인이 업로드한 모든 파일 삭제 처리</li>
            <li>장애 정보: 동의 철회 즉시 삭제 (내 정보 창고 › 우대·기타 › 「동의 철회」)</li>
          </ul>
        </DocSection>

        <DocSection title="6-1. 개인정보의 안전성 확보조치">
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              내 정보 창고의 이름·연락처·주소·생년월일·병역·보훈·장애 등 식별·연락·민감 정보는 애플리케이션
              단계에서 <strong>AES-256-GCM</strong> 으로 암호화해 저장합니다.
            </li>
            <li>암호화 키는 데이터베이스와 분리된 환경 변수로 관리하며, 데이터베이스만 유출돼도 값을 읽을 수 없습니다.</li>
            <li>통신 구간은 TLS 로 보호하며, 개인정보 접근 권한은 운영자에게만 부여합니다.</li>
            <li>
              이름·연락처·주소·생년월일·병역·보훈·장애 정보 등 프로필 항목은 <strong>AI 처리에 전달되지
              않습니다.</strong> AI 기능에는 이용자가 직접 작성한 자소서 소재·경력·학력·자격 정보만 이용됩니다(§5).
            </li>
          </ul>
        </DocSection>

        <DocSection title="7. 정보주체의 권리">
          <p className="mb-3">회원은 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>개인정보 열람 요청</li>
            <li>개인정보 수정·삭제 요청</li>
            <li>개인정보 처리 정지 요청</li>
            <li>개인정보 이동 요청 (내 데이터 전체 내보내기 — 설정 → 프로필 설정에서 신청)</li>
            <li>회원 탈퇴 (서비스 내 설정 → 프로필 설정 → 탈퇴)</li>
            <li>
              민감정보(장애 정보) 동의 철회 — 내 정보 창고 › 우대·기타 › 「동의 철회」에서 즉시 가능하며, 철회 시
              저장된 장애 정보를 바로 삭제합니다
            </li>
          </ul>
          <p className="mt-3">
            권리 행사는 서비스 내{' '}
            <Link to="/inquiry" className="text-brand hover:underline">문의하기</Link>를 통해 요청하실 수 있습니다.
          </p>
        </DocSection>

        <DocSection title="8. 개인정보 보호책임자">
          <ul className="space-y-1.5 text-sm">
            <li><span className="text-text-quaternary">성명</span> &nbsp; 장성원</li>
            <li>
              <span className="text-text-quaternary">문의</span> &nbsp;{' '}
              <Link to="/inquiry" className="text-brand hover:underline">문의하기</Link>
            </li>
          </ul>
        </DocSection>

        <DocSection title="9. 개인정보처리방침 변경">
          <p>
            이 방침은 법령·서비스 변경에 따라 수정될 수 있습니다.
            변경 시 시행일 7일 전 서비스 내 공지합니다.
          </p>
        </DocSection>

        <div className="mt-12 pt-6 border-t border-line text-text-quaternary text-xs space-y-2">
          <p>
            <span className="text-text-primary font-medium">
              공고일: 2026년 9월 6일 · 시행일: 2026년 9월 6일 (즉시 시행 — 신규 항목은 선택 입력, 장애
              정보는 별도 동의 뒤에만 수집)
            </span>
            <br />
            ① §1 내 정보 창고 항목 확장 — 영문 이름·주소·국적·비상 연락처·보훈·병역 상세·학력 상세·활동/경험·추가
            정보 ② §1 에 <strong>장애 정보(민감정보) 별도 동의</strong> 신설 및 고유식별정보(주민등록번호 등) 미수집
            명시 ③ §2 가명처리 통계 ④ §3·§6·§7 장애 정보 동의 철회 시 즉시 삭제와 철회 방법 ⑤{' '}
            <strong>§6-1 안전성 확보조치</strong> 신설 — 내 정보 창고의 식별·연락·민감 정보 애플리케이션 단계
            암호화. 장애 정보는 <strong>별도 동의 전에는 입력할 수 없습니다.</strong>
          </p>
          <p>
            <span className="text-text-tertiary font-medium">
              공고일: 2026년 9월 3일 · 시행일: 2026년 9월 10일 (§9 시행일 7일 전 공지 준수)
            </span>
            <br />
            ① §5 수탁 업체에 <strong>Meta Platforms, Inc.(미국)</strong> 추가 — 온라인 맞춤형
            광고 성과 측정(Meta Pixel) ② <strong>§5-2</strong> 에 온라인 맞춤형 광고 항목,
            <strong> 보유·이용 기간</strong>(수집일로부터 최대 2년), Meta 광고 설정을 통한
            <strong> 거부 방법</strong> 추가. 수집 항목은 광고 식별 쿠키·광고 식별자와 방문
            페이지·가입 완료 등 이용 기록이며, 회원이 작성한 내용(자소서·활동 기록·내 정보)은
            전송되지 않습니다.
          </p>
          <p>
            <span className="text-text-tertiary font-medium">
              공고일: 2026년 8월 4일 · 시행일: 2026년 8월 4일 (베타 서비스로 사용자 적어 즉시 시행)
            </span>
            <br />
            ① §1 수집 항목에 <strong>서비스 이용 분석 정보</strong>(접속 기기·브라우저, 방문 페이지·
            클릭·스크롤 등 행태정보, 광고 쿠키) 추가 ② §5 수탁 업체에 <strong>Microsoft(Clarity)</strong>
            추가, 그리고 <strong>Google(AdSense)·Vercel</strong> 기재 — 이 둘은 새로 시작하는 처리가
            아니라 <strong>이미 이용 중이던 서비스를 방침에 정확히 반영</strong>한 것입니다
            ③ <strong>§5-2 쿠키 및 행태정보</strong> 조항 신설(거부 방법 포함). 자기소개서·활동 기록·
            내 정보·문의 등 민감한 화면의 글 내용은 <strong>마스킹되어 전송되지 않습니다</strong>.
          </p>
          <p>
            <span className="text-text-tertiary font-medium">공고일: 2026년 7월 28일 · 시행일: 2026년 8월 4일</span>
            <br />
            이전 방침(2026년 5월 18일 시행) 대비 변경 사항 — ① §1 수집 항목에 <strong>서비스 오류 진단
            정보</strong>(오류 메시지·발생 화면·브라우저 정보·IP·회원 고유 식별자) 추가 ② §5 수탁 업체에
            <strong> Sentry(미국)</strong> 추가. 오류가 발생했을 때만 전송되며, 회원이 작성한 내용(자소서
            답변·메모·내 정보 창고 입력값)과 이메일·닉네임·인증 토큰은 전송 대상에서 제외됩니다.
          </p>
          <p>
            공고일: 2026년 5월 18일 · 시행일: 2026년 5월 18일 (베타 서비스로 사용자 적어 즉시 시행, 사전 공지는 변경 후 첫 로그인 시 안내)
            <br />
            이전 시행일(2026년 5월 14일)의 방침에 비해 §1 수집 항목·§5 위탁 업체 명시를 정합화했으며, 실 처리 범위 변경은 없습니다.
          </p>
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

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-line">
            {headers.map((h) => (
              <th key={h} className="text-left text-text-quaternary font-medium py-2 pr-4 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-text-secondary align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
