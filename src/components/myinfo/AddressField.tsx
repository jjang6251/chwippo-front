/**
 * 주소 입력 — 「주소 검색」 버튼(카카오(다음) 우편번호 서비스) + 상세 직접 입력.
 *
 * 지원서 11곳 중 **8곳이 주소를 받고, 4곳이 우편번호 팝업**을 쓴다
 * (`autofill-census-2026-09.md`). 우편번호를 손으로 치게 하면 창고가 안 채워진다.
 *
 * ## 스크립트는 **클릭할 때** 불러온다
 * 내 정보 페이지를 여는 모든 사람에게 외부 스크립트를 받게 할 이유가 없다. 버튼을 처음
 * 누를 때 한 번만 붙이고, 이후에는 붙은 걸 재사용한다.
 *
 * ## 🔴 로드 실패해도 주소는 입력할 수 있어야 한다
 * 검색이 안 되면 그냥 「직접 입력」으로 떨어진다 — 우편번호·기본주소 칸이 처음부터
 * 편집 가능하고, 시/도는 목록에서 고른다. 외부 스크립트 하나 때문에 칸이 죽지 않는다.
 *
 * 시/도(`address_region`)는 백엔드 `ADDRESS_REGIONS` 와 **완전 일치하는 짧은 이름**
 * (「서울」·「경기」)만 받는다 — `@/utils/koreaRegions` 의 `normalizeRegion` 을 거친 값만 보낸다.
 */
import { useId, useRef, useState } from 'react'
import { toast } from '@/stores/toastStore'
import { KOREA_REGIONS, REGION_LABEL, normalizeRegion } from '@/utils/koreaRegions'
import { Field, FieldLabel } from '@/components/myinfo/fields'

const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

/** 카카오(다음) 우편번호 서비스 `oncomplete` 페이로드 중 우리가 쓰는 필드만 */
interface DaumPostcodeResult {
  zonecode: string
  roadAddress: string
  jibunAddress: string
  sido: string
}

interface DaumPostcodeInstance {
  open: () => void
}

interface DaumPostcodeNamespace {
  Postcode: new (options: {
    oncomplete: (data: DaumPostcodeResult) => void
    onclose?: () => void
  }) => DaumPostcodeInstance
}

declare global {
  interface Window {
    daum?: { Postcode?: DaumPostcodeNamespace['Postcode'] }
  }
}

/** 스크립트를 한 번만 붙인다. 이미 있으면 그 로드를 기다린다. */
function loadPostcodeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.daum?.Postcode) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${POSTCODE_SRC}"]`)
  const el = existing ?? document.createElement('script')
  const promise = new Promise<void>((resolve, reject) => {
    el.addEventListener('load', () => resolve(), { once: true })
    el.addEventListener('error', () => reject(new Error('postcode script failed')), { once: true })
  })
  if (!existing) {
    el.src = POSTCODE_SRC
    el.async = true
    document.head.appendChild(el)
  }
  return promise
}

export interface AddressValue {
  address_zip: string
  address_base: string
  address_detail: string
  address_region: string
}

interface Props {
  value: AddressValue
  /** 칸 하나가 바뀔 때 — 부모가 로컬 상태만 갱신한다 */
  onChange: (patch: Partial<AddressValue>) => void
  /** 저장 시점 — blur(직접 입력) 또는 검색 결과 확정 */
  onCommit: (patch: Partial<AddressValue>) => void
}

export function AddressField({ value, onChange, onCommit }: Props) {
  const [loading, setLoading] = useState(false)
  const openingRef = useRef(false)
  const regionId = useId()
  const groupLabelId = useId()

  const handleSearch = async () => {
    // `aria-disabled` 는 클릭을 막지 않는다 — 막는 건 여기다 (포커스는 버튼에 남는다)
    if (loading || openingRef.current) return
    openingRef.current = true
    setLoading(true)
    try {
      await loadPostcodeScript()
      const Postcode = window.daum?.Postcode
      if (!Postcode) throw new Error('postcode namespace missing')
      new Postcode({
        oncomplete: (data) => {
          const patch: Partial<AddressValue> = {
            address_zip: data.zonecode ?? '',
            address_base: data.roadAddress || data.jibunAddress || '',
            address_region: normalizeRegion(data.sido) ?? '',
          }
          onChange(patch)
          onCommit(patch)
        },
        onclose: () => {
          openingRef.current = false
        },
      }).open()
    } catch {
      toast.error('주소 검색을 열지 못했어요. 아래 칸에 직접 입력해 주세요.')
      openingRef.current = false
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="col-span-full space-y-3">
      {/* 우편번호·검색 버튼은 「주소」라는 한 이름 아래 묶인다 — `<label>` 은 칸 하나만 가리킬 수 있다 */}
      <div role="group" aria-labelledby={groupLabelId}>
        {/* 빈도 pill 은 데스크탑에서만 — 모바일은 섹션 헤더 하나로 충분하다 */}
        <FieldLabel label="주소" id={groupLabelId} />
        <div className="flex gap-2">
          <input
            type="text"
            /* 게이지의 「주소」 칩이 포커스하는 칸 — 주소는 여기서 시작한다 */
            name="address_zip"
            value={value.address_zip}
            onChange={(e) => onChange({ address_zip: e.target.value })}
            onBlur={() => onCommit({ address_zip: value.address_zip })}
            placeholder="우편번호"
            inputMode="numeric"
            autoComplete="postal-code"
            spellCheck={false}
            maxLength={10}
            aria-label="우편번호"
            /* 320px 에서 [우편번호][주소 검색] 이 한 줄에 들어가야 한다 — 112 + 8 + ~84 = 204 < 236 */
            className="w-28 shrink-0 bg-input border border-line rounded-xl px-4 h-12 text-base text-text-primary placeholder:text-text-tertiary font-mono tabular-nums focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]"
          />
          {/*
            🔴 여는 동안 `disabled` 로 바꾸면 **포커스가 body 로 튄다** — 방금 누른 자리로
            돌아올 수 없다. `aria-disabled` 로 상태만 알리고 클릭은 핸들러에서 무시한다.
          */}
          <button
            type="button"
            onClick={handleSearch}
            aria-disabled={loading}
            aria-busy={loading}
            className="shrink-0 h-12 px-4 rounded-xl border border-line bg-card text-[13px] font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:bg-card-strong transition-colors aria-disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            {loading ? '여는 중…' : '주소 검색'}
          </button>
        </div>
      </div>

      <Field
        label="기본 주소"
        value={value.address_base}
        onChange={(v) => onChange({ address_base: v })}
        onBlur={() => onCommit({ address_base: value.address_base })}
        placeholder="검색하거나 직접 입력"
        maxLength={200}
        autoComplete="address-line1"
      />
      <Field
        label="상세 주소"
        value={value.address_detail}
        onChange={(v) => onChange({ address_detail: v })}
        onBlur={() => onCommit({ address_detail: value.address_detail })}
        placeholder="동·호수 등"
        maxLength={100}
        autoComplete="address-line2"
      />
      {/*
        🔴 **보이는 글자와 저장값이 다르다.** 백엔드 `ADDRESS_REGIONS` 는 짧은 이름
        17개와 완전 일치만 받으므로 `value` 는 「서울」, 라벨만 「서울특별시」다.
        공용 `SelectField` 는 value=label 이라 여기서만 직접 그린다 (chevron 규칙은 동일).
      */}
      <div>
        <FieldLabel label="시/도" htmlFor={regionId} />
        <div className="relative">
          <select
            id={regionId}
            value={value.address_region}
            autoComplete="address-level1"
            onChange={(e) => {
              const v = e.target.value
              onChange({ address_region: v })
              onCommit({ address_region: v })
            }}
            className="w-full appearance-none bg-input border border-line rounded-xl pl-4 pr-11 h-12 text-base text-text-primary cursor-pointer focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]"
          >
            <option value="">선택</option>
            {KOREA_REGIONS.map((r) => (
              <option key={r} value={r}>{REGION_LABEL[r]}</option>
            ))}
          </select>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}
