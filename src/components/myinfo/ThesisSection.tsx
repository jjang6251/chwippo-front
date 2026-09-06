/**
 * 「논문」 섹션 본문 — 대학원 4칸(지도교수 · 연구 분야 · 논문 제목 · 논문 요약).
 *
 * 왜 별도 섹션인가: 이 네 칸은 **석·박사에게만** 있는 칸이다. 옛 「추가 정보」 안에 섞어
 * 두면 학사 지원자 전원에게 빈 칸 네 개가 보이고, 반대로 대학원생에게는 취미·특기 사이에
 * 묻혀 안 보였다. 그래서 표시 조건을 최종 학력에 걸어 섹션으로 분리한다
 * (`highest_degree` 가 `master`·`doctor` 일 때만 — 판정은 `MyInfo.tsx` 가 한다).
 *
 * 🔴 **키 이름으로 고른다** — 어느 키를 그릴지는 `useThesisFields` 의 몫이고, 여기는 받은
 * 칸을 그리기만 한다. 사전에 다른 extra 키가 늘거나 남아 있어도 이 섹션은 영향을 받지 않는다.
 *
 * 프레임(`SectionCard`)은 `MyInfo.tsx` 가 씌운다 — 여기는 본문만 그린다.
 */
import { useState } from 'react'
import { toast } from '@/stores/toastStore'
import { useProfile, useUpdateExtraFields } from '@/hooks/useMyinfo'
import type { FieldDictionaryEntry } from '@/api/myinfo'
import { Field } from '@/components/myinfo/fields'

/**
 * 200자를 넘는 칸은 한 줄 입력으로 못 쓴다 — 논문 요약(1000자)이 그렇다.
 * 사전이 길이를 말해 주므로 여기서 키를 하드코딩하지 않는다.
 */
const TEXTAREA_MIN_LENGTH = 200

function notifySaveError(err: unknown) {
  const shown = (err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown
  if (!shown) toast.error('저장에 실패했어요.')
}

export function ThesisSectionBody({ fields, onSaved }: {
  fields: FieldDictionaryEntry[]
  onSaved: () => void
}) {
  const { data: profile } = useProfile()
  const { mutate: updateExtra } = useUpdateExtraFields()

  const [values, setValues] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  if (profile && !loaded) {
    setValues({ ...(profile.extra_fields ?? {}) })
    setLoaded(true)
  }

  /** 저장 경로는 옛 「추가 정보」와 같다 — `PATCH /myinfo/extra-fields`, 빈 값은 `null` */
  const commit = (key: string, raw: string) =>
    updateExtra({ [key]: raw.trim() ? raw.trim() : null }, {
      onSuccess: onSaved,
      onError: notifySaveError,
    })

  return (
    <div>
      <p className="text-sm text-text-tertiary mb-3.5">
        대학원 지원서가 묻는 칸이에요. 한 번 적어 두면 다음 지원서에서 그대로 쓰여요.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {fields.map((f) => {
          const v = values[f.key] ?? ''
          const long = !!f.maxLength && f.maxLength > TEXTAREA_MIN_LENGTH
          const field = (
            <Field
              label={f.label}
              value={v}
              maxLength={f.maxLength}
              as={long ? 'textarea' : undefined}
              onChange={(next) => setValues((s) => ({ ...s, [f.key]: next }))}
              onBlur={() => commit(f.key, v)}
            />
          )
          // 긴 칸은 데스크탑에서 두 칸을 다 쓴다 (모바일은 원래 한 줄이라 건드리지 않는다)
          return long
            ? <div key={f.key} className="md:col-span-2">{field}</div>
            : <div key={f.key}>{field}</div>
        })}
      </div>
    </div>
  )
}
