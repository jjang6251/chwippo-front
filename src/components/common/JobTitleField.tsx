import { useState } from 'react'
import { Briefcase, Lightbulb } from 'lucide-react'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { resolveJobText } from '@/hooks/useRequireJobTitle'
import { toast } from '@/stores/toastStore'

/** 카드 `jobTitle` 컬럼과 DTO `@MaxLength(100)` 에 맞춘다 */
const MAX_LEN = 100
const PLACEHOLDER = '예: 백엔드 개발자 / 퍼포먼스 마케터 / 재무회계'

interface Props {
  applicationId: string
  /**
   * `inline` — 한 줄 표시 + [수정] (자료 패널·사이드바용, 기본값)
   * `block` — 라벨 + 입력칸을 항상 펼침 (폼 안에 넣을 때)
   */
  variant?: 'inline' | 'block'
}

/**
 * 지원 직무 표시 + 그 자리 수정 (2026-08-06).
 *
 * 🔴 **왜 컴포넌트로 뺐나** — 직무는 자소서·면접 AI 결과를 좌우하는데, 정작 그 작업을
 * 하는 화면들(세션 자료·세션 페이지·자소서 문서)에는 표시도 수정도 없었다.
 * "직무 미지정" 만 보이고 고칠 칸이 없으면 막다른 길이 된다.
 *
 * 모달 안에서도 쓰이므로 **자체 모달을 띄우지 않는다** (모달 위 모달 방지).
 * 입력 자리를 낼 수 없는 진입점(자소서 점검·대화 버튼)은 전역 게이트 모달
 * `useRequireJobTitle` 이 담당한다.
 *
 * 저장 즉시 카드에 반영되므로 어디서 고치든 모든 화면·AI 프롬프트가 같은 값을 본다.
 */
export function JobTitleField({ applicationId, variant = 'inline' }: Props) {
  const { data: app } = useApplication(applicationId)
  const { mutateAsync: updateApp } = useUpdateApplication(applicationId)

  const current = resolveJobText(app)
  // 직무가 없으면 처음부터 입력 상태 — 한 번 더 누르게 만들 이유가 없다
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const open = editing || (!current && variant === 'block')
  const trimmed = value.trim()

  const startEdit = () => {
    setValue(app?.jobTitle?.trim() ?? '')
    setEditing(true)
  }

  const save = async () => {
    if (saving || !trimmed) return
    setSaving(true)
    try {
      await updateApp({ jobTitle: trimmed })
      setEditing(false)
      toast.show('직무를 저장했어요.')
    } catch {
      toast.error('직무 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (!app) return null

  if (open) {
    return (
      <div>
        <label
          htmlFor={`job-title-${applicationId}`}
          className="block text-xs text-text-tertiary mb-1.5"
        >
          지원 직무 {!current && <span className="text-danger">*</span>}
        </label>
        <div className="flex gap-1.5">
          <input
            id={`job-title-${applicationId}`}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) void save()
              if (e.key === 'Escape' && current) setEditing(false)
            }}
            maxLength={MAX_LEN}
            placeholder={PLACEHOLDER}
            /*
             * 지원할 회사의 직무라 **매번 다르다** — 브라우저가 프로필에 저장된
             * 본인 직함(organization-title)을 채우면 엉뚱한 값이 들어간다.
             */
            autoComplete="off"
            /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 */
            className="flex-1 min-w-0 bg-input border border-line rounded-lg px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !trimmed}
            aria-live="polite"
            className="shrink-0 px-3 py-2 text-xs font-medium text-bg bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          {current && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="shrink-0 px-2.5 py-2 text-xs text-text-tertiary hover:text-text-primary"
            >
              취소
            </button>
          )}
        </div>
        {!current && (
          <p className="text-warning text-[11px] mt-1.5">
            <span className="inline-flex items-start gap-1">
              <Lightbulb
                size={13}
                strokeWidth={1.75}
                aria-hidden="true"
                className="shrink-0 mt-px"
              />
              <span>
                직무가 없으면 <strong>자소서·면접 AI 가 일반론</strong>으로 답합니다.
              </span>
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <Briefcase
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-text-quaternary"
        />
        <span
          className={`text-xs truncate ${current ? 'text-text-secondary' : 'text-warning'}`}
        >
          {current ?? '직무 미지정'}
        </span>
      </span>
      <button
        type="button"
        onClick={startEdit}
        className="shrink-0 text-[11px] text-text-tertiary hover:text-brand"
      >
        {current ? '수정' : '입력'}
      </button>
    </div>
  )
}
