// TODO: AI 기능(F1·F2) 출시 시 → §5 위탁 업체에 Anthropic 추가, §1 수집 항목에 "AI 처리용 입력 텍스트" 추가
// TODO: 유료 결제 도입 시 → 결제 수탁업체(PG사) 추가, §3 보유 기간에 전자상거래법 5년 명시
// TODO: 사업자 등록 시 → §8 개인정보 보호책임자에 사업자 정보 추가
// 갱신 이력:
// - 2026-07-27 공고 / 2026-08-03 시행: §1에 서비스 오류 진단 정보 + §5 수탁업체에 Sentry 추가.
//   출시(7/26) 후 첫 개정이라 §10 "시행일 7일 전 공지" 조항을 준수 — 공고와 시행 사이 7일.
//   ⚠️ Sentry DSN 은 **시행일(8/3)에 주입**한다. 방침보다 먼저 켜면 고지 없는 수집이 된다.
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
        <p className="text-text-quaternary text-sm mb-2">시행일: 2026년 8월 3일</p>
        <p className="text-text-tertiary text-xs mb-12 leading-relaxed">
          이 방침은 2026년 7월 27일 공고되어 2026년 8월 3일부터 시행됩니다. 시행일 전까지는
          이전 방침(2026년 5월 18일 시행)이 적용됩니다. 변경 내용은 아래 페이지 하단에
          정리되어 있습니다.
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
                '실명·한자 이름·성별·생년월일·전화번호·개인 이메일·병역 정보(군별·복무 형태·기간·소속)·학습 목표(목표 자격증 등)',
                '본인이 직접 입력 시',
              ],
              [
                '내 정보 창고 — 자격·이력 (선택)',
                '자격증·어학·상장·학력·경력·자기소개서 소재·파일 보관함의 PDF/이미지 파일',
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
            ]}
          />
          <p className="mt-3 text-text-quaternary text-xs">
            * 프로필·자격 정보는 모두 선택 입력이며, 입력하지 않아도 기본 서비스(지원 카드·일정 관리)는 이용할 수 있습니다.
          </p>
          <p className="mt-2 text-text-quaternary text-xs">
            * 서비스 특성상 PIPA 시행령 18조 민감정보(건강·신념·성적 지향·노조 가입·정치적 견해 등)는 수집하지 않습니다.
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
          </ul>
        </DocSection>

        <DocSection title="3. 개인정보 보유 및 이용 기간">
          <p className="mb-3">
            회원 탈퇴 시 수집한 개인정보 및 서비스 내 입력 데이터를 즉시 삭제합니다.
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
            ]}
          />
          <p className="mt-3 text-text-quaternary text-xs">
            * 모든 수탁 업체는 SOC2/ISO27001 등 국제 정보보안 표준을 준수합니다.
          </p>
          <div id="ai-consent" className="mt-3 p-3 bg-surface-2 border border-line rounded-md">
            <p className="font-medium mb-2">AI 기능 처리 위탁 (PIPA 26조)</p>
            <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
              <li>
                <strong>OpenAI, L.L.C.</strong> (미국) — 노트 요약·자소서 추천·면접 질문 생성
                (`gpt-4o-mini`). 사용자 입력 텍스트 처리 후 즉시 폐기, 학습 데이터 미사용
              </li>
              <li>
                <strong>Anthropic, PBC</strong> (미국) — 자소서 초안·면접 답변·회사 조사
                (`claude-haiku-4-5`). 동일 정책. 회사 조사용 web_search 도구 사용 시
                지정된 화이트리스트 도메인만 검색
              </li>
            </ul>
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

        <DocSection title="6. 개인정보의 파기">
          <p className="mb-3">
            보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
          </p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>데이터베이스 레코드: 회원 탈퇴 시 ON DELETE CASCADE로 즉시 삭제</li>
            <li>파일 저장소(R2): 회원 탈퇴 시 본인이 업로드한 모든 파일 삭제 처리</li>
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
            <span className="text-text-tertiary font-medium">공고일: 2026년 7월 27일 · 시행일: 2026년 8월 3일</span>
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
