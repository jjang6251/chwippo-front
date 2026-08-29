import { useState } from 'react'
import { Briefcase, Lightbulb } from 'lucide-react'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { resolveJobText } from '@/hooks/useRequireJobTitle'
/* 같은 이름이라 별칭 — 이쪽은 「표시 + 그 자리 수정」 껍데기고, 저건 입력기 자체다 */
import { JobTitleField as JobTitleInput } from '@/components/card/JobTitleField'
import { PromoteJobTitleRow } from '@/components/card/PromoteJobTitleRow'
import { JOB_SERIES, classifyJob } from '@/utils/jobRole'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import type { JobTitleSource } from '@/types/application'

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
  const profileJobTitle = useAuthStore((s) => s.user?.signupJobTitle ?? null)

  const current = resolveJobText(app)
  // 직무가 없으면 처음부터 입력 상태 — 한 번 더 누르게 만들 이유가 없다
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [source, setSource] = useState<JobTitleSource>('typed')
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const open = editing || (!current && variant === 'block')
  const trimmed = value.trim()

  const startEdit = () => {
    const title = app?.jobTitle?.trim() ?? ''
    setValue(title)
    /*
      🔴 계열 초기값은 **직무에서 다시 판정**한다 — 저장된 `jobCategory` 라벨을 역매핑하지
      않는다 (구 21어휘가 섞여 있어 되돌릴 수 없다). `BoardDetail` 편집 폼과 같은 규칙.
    */
    const verdict = title ? classifyJob(title) : null
    setSeriesId(verdict?.status === 'confident' ? verdict.series.id : null)
    setSource('typed')
    setEditing(true)
  }

  const save = async () => {
    if (saving || !trimmed) return
    setSaving(true)
    try {
      /*
        🔴 **계열을 반드시 같이 쓴다** — 못 잡았으면 `null` 로 지운다.
        여기서 `jobTitle` 만 보내면 「승무원」을 「백엔드」로 고쳐도 태그가
        「영업·판매·서비스」로 남는다 (2026-08-28 실기 결함과 같은 원인).
      */
      const seriesLabel = seriesId
        ? JOB_SERIES.find((s) => s.id === seriesId)?.label
        : undefined
      await updateApp({
        jobTitle: trimmed,
        jobTitleSource: source,
        jobCategory: seriesLabel ?? null,
      })
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
      <div
        /*
          Enter 저장 · Esc 취소는 그대로 유지한다. 🔴 단 **드롭다운이 그 키를 먼저 쓴 경우는
          비켜준다** — `JobTitleField` 는 추천 항목을 고를 때 `preventDefault` 하므로,
          그 신호를 보고 물러나면 「↓로 고르다가 Enter 눌렀는데 저장돼 버리는」 일이 없다.
        */
        onKeyDown={(e) => {
          if (e.defaultPrevented) return
          if (e.key === 'Enter' && trimmed) void save()
          if (e.key === 'Escape' && current) setEditing(false)
        }}
      >
        {/* 공용 입력기 — 사전 추천 + 계열 판정이 이 자리에서도 돈다 */}
        <JobTitleInput
          id={`job-title-${applicationId}`}
          value={value}
          onChange={(v, src) => {
            setValue(v)
            setSource(src)
          }}
          seriesId={seriesId}
          onSeriesChange={(id) => setSeriesId(id)}
          labelText={
            <>지원 직무 {!current && <span className="text-danger">*</span>}</>
          }
          placeholder={PLACEHOLDER}
        />
        {/* 이 카드 직무가 내 희망 직무와 다르면 맞추자고 제안한다 (탭해야만 반영) */}
        <PromoteJobTitleRow
          profileTitle={profileJobTitle}
          jobTitle={value}
          seriesId={seriesId}
        />
        <div className="flex gap-1.5 mt-2">
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
