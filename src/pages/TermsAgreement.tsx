import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/stores/toastStore'
import { agreeTerms as agreeTermsApi } from '@/api/users'

export function TermsAgreement() {
  const navigate = useNavigate()
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [expandedTerms, setExpandedTerms] = useState(false)
  const [expandedPrivacy, setExpandedPrivacy] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const allAgreed = agreeTerms && agreePrivacy

  const handleAllToggle = () => {
    const next = !allAgreed
    setAgreeTerms(next)
    setAgreePrivacy(next)
  }

  const handleSubmit = async () => {
    if (!allAgreed || submitting) return
    setSubmitting(true)
    try {
      await agreeTermsApi()
    } catch {
      // 동의 기록 실패해도 서비스 이용은 막지 않음
    }
    navigate('/dashboard', { replace: true })
    toast.show('치뽀에 오신 것을 환영해요! 첫 지원 카드를 추가해보세요.')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* 헤더 */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl font-bold text-text-primary tracking-tight">치뽀</div>
          <h1 className="text-text-primary text-xl font-semibold">서비스 이용 동의</h1>
          <p className="text-text-tertiary text-sm text-center leading-relaxed">
            치뽀 서비스를 이용하기 위해<br />아래 약관에 동의해주세요.
          </p>
        </div>

        {/* 동의 카드 */}
        <div className="bg-surface-2 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
          {/* 전체 동의 */}
          <button
            onClick={handleAllToggle}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/3 transition-colors text-left"
          >
            <CheckCircle checked={allAgreed} />
            <span className={`text-sm font-semibold ${allAgreed ? 'text-text-primary' : 'text-text-secondary'}`}>
              전체 동의하기
            </span>
          </button>

          {/* 이용약관 */}
          <div>
            <div className="flex items-center gap-3 px-5 py-4">
              <button onClick={() => setAgreeTerms((v) => !v)} className="shrink-0">
                <CheckCircle checked={agreeTerms} />
              </button>
              <span className={`text-sm flex-1 ${agreeTerms ? 'text-text-primary' : 'text-text-secondary'}`}>
                이용약관 동의 <span className="text-brand text-xs">(필수)</span>
              </span>
              <button
                onClick={() => setExpandedTerms((v) => !v)}
                className="text-text-quaternary text-xs hover:text-text-tertiary transition-colors"
              >
                {expandedTerms ? '접기' : '보기'}
              </button>
            </div>
            {expandedTerms && (
              <div className="px-5 pb-4">
                <div className="bg-bg rounded-lg p-4 text-text-quaternary text-xs leading-relaxed max-h-40 overflow-y-auto">
                  <p className="font-medium text-text-tertiary mb-2">치뽀 이용약관</p>
                  <p>제1조 (목적) 이 약관은 치뽀(이하 "서비스")가 제공하는 취업 일정 관리 서비스의 이용에 관한 조건 및 절차, 서비스 이용자와 서비스 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
                  <br />
                  <p>제2조 (정의) "서비스"란 치뽀가 제공하는 취업 준비 관련 모든 기능을 의미합니다.</p>
                  <br />
                  <p>제3조 (서비스 이용) 서비스는 카카오 계정을 통한 로그인으로 이용할 수 있습니다. 서비스를 통해 입력한 정보는 회원의 자산으로 보호됩니다.</p>
                  <br />
                  <p>제4조 (개인정보) 서비스는 회원의 개인정보를 소중히 여기며 별도의 개인정보처리방침에 따라 처리합니다.</p>
                  <br />
                  <p>제5조 (면책) 서비스는 천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.</p>
                  <p className="mt-3">
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                      전체 이용약관 보기 ↗
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 개인정보처리방침 */}
          <div>
            <div className="flex items-center gap-3 px-5 py-4">
              <button onClick={() => setAgreePrivacy((v) => !v)} className="shrink-0">
                <CheckCircle checked={agreePrivacy} />
              </button>
              <span className={`text-sm flex-1 ${agreePrivacy ? 'text-text-primary' : 'text-text-secondary'}`}>
                개인정보처리방침 동의 <span className="text-brand text-xs">(필수)</span>
              </span>
              <button
                onClick={() => setExpandedPrivacy((v) => !v)}
                className="text-text-quaternary text-xs hover:text-text-tertiary transition-colors"
              >
                {expandedPrivacy ? '접기' : '보기'}
              </button>
            </div>
            {expandedPrivacy && (
              <div className="px-5 pb-4">
                <div className="bg-bg rounded-lg p-4 text-text-quaternary text-xs leading-relaxed max-h-40 overflow-y-auto">
                  <p className="font-medium text-text-tertiary mb-2">개인정보처리방침</p>
                  <p>치뽀는 회원의 개인정보를 중요시하며 정보통신망 이용촉진 및 정보보호 등에 관한 법률과 개인정보 보호법을 준수합니다.</p>
                  <br />
                  <p>수집 항목: 카카오 계정 식별자, 닉네임, 이메일(선택)</p>
                  <br />
                  <p>이용 목적: 서비스 제공, 회원 관리, 서비스 개선</p>
                  <br />
                  <p>보유 기간: 회원 탈퇴 시까지 (탈퇴 즉시 파기)</p>
                  <br />
                  <p>제3자 제공: 이용자의 동의 없이 제3자에게 제공하지 않습니다.</p>
                  <p className="mt-3">
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                      전체 개인정보처리방침 보기 ↗
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!allAgreed || submitting}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all
            ${allAgreed && !submitting
              ? 'bg-brand hover:bg-accent text-white shadow-[0_0_20px_rgba(94,106,210,0.3)]'
              : 'bg-white/5 text-text-quaternary cursor-not-allowed'
            }
          `}
        >
          {submitting ? '처리 중...' : '동의하고 시작하기'}
        </button>

        <p className="text-text-quaternary text-xs text-center">
          동의 후 치뽀의 모든 기능을 이용할 수 있어요.
        </p>
      </div>
    </div>
  )
}

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0
        ${checked ? 'bg-brand border-brand' : 'border-white/20 bg-transparent'}
      `}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
