# 취뽀 프론트엔드 — 개발 가이드

> 이 파일은 `chwippo-front` 전용입니다.
> 서비스 전체 스펙은 `../CLAUDE.md`, 디자인 시스템은 `../DESIGN.md`를 참조하세요.

---

## 1. 기술 스택 & 버전

| 패키지 | 버전 | 용도 |
|---|---|---|
| React | 19 | UI 렌더링 |
| Vite | 8 | 번들러 |
| TypeScript | 6 | 언어 (strict: true) |
| Tailwind CSS | v3 | 스타일링 |
| Zustand | v5 | 클라이언트 상태 |
| React Query | v5 (@tanstack) | 서버 상태 |
| axios | latest | HTTP 클라이언트 |
| react-router-dom | v7 | 라우팅 |
| dayjs | latest | 날짜/D-day 계산 |

---

## 2. 절대 경로 alias

`@/` → `src/` 로 매핑됨. **상대 경로(`../../`) 절대 사용 금지.**

```ts
// ✅
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

// ❌
import { Button } from '../../components/common/Button'
```

---

## 3. 폴더 구조 & 역할

```
src/
├── api/
│   ├── client.ts          # axios 인스턴스 (인터셉터 포함) — 직접 수정 금지
│   └── {domain}.ts        # 도메인별 API 함수 (예: applications.ts, auth.ts)
├── components/
│   ├── common/            # Button, Input, Modal, Badge, Toast 등 범용 컴포넌트
│   ├── layout/            # Sidebar, MobileNav, AppShell
│   ├── card/              # CompanyCard, StepBar, DdayBadge
│   ├── dashboard/         # StatCard, TodoList, DdayList
│   ├── calendar/          # CalendarView, EventPopup
│   └── myinfo/            # InfoSection, CopyButton
├── hooks/                 # 커스텀 훅 (useAuth, useApplications, useTodo 등)
├── pages/                 # 라우트 단위 페이지 컴포넌트
├── stores/                # Zustand 스토어
├── types/                 # TypeScript 타입 정의
├── utils/                 # 순수 함수 (날짜, D-day, 포매터 등)
└── styles/                # 글로벌 CSS (index.css 외 추가 필요 시)
```

---

## 4. 상태 관리 원칙

| 데이터 종류 | 사용 도구 | 예시 |
|---|---|---|
| 서버에서 fetch하는 데이터 | **React Query** | 지원 카드 목록, 캘린더 이벤트 |
| 전역 클라이언트 상태 | **Zustand** | 로그인 유저 정보, 모달 열림 여부 |
| 로컬 UI 상태 | **useState** | 폼 입력값, 드롭다운 토글 |

### React Query 패턴

```ts
// src/api/applications.ts
import { apiClient } from '@/api/client'
import type { Application } from '@/types/application'

export const getApplications = () =>
  apiClient.get<Application[]>('/applications').then((r) => r.data)

export const createApplication = (body: CreateApplicationDto) =>
  apiClient.post<Application>('/applications', body).then((r) => r.data)

// 훅에서 사용
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: getApplications,
  })
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createApplication,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })
}
```

### Zustand 패턴

```ts
// src/stores/authStore.ts
import { create } from 'zustand'
import type { User } from '@/types/user'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
```

---

## 5. 컴포넌트 작성 규칙

- **함수형 컴포넌트 + Hooks** 전용. 클래스 컴포넌트 금지.
- Props는 항상 인터페이스로 정의. `any` 금지.
- 파일명: `PascalCase.tsx`. 훅: `useCamelCase.ts`.

```tsx
// ✅ 올바른 컴포넌트 패턴
interface CompanyCardProps {
  application: Application
  onUpdate: (id: string) => void
}

export function CompanyCard({ application, onUpdate }: CompanyCardProps) {
  // ...
}
```

---

## 6. Tailwind 스타일링 규칙

DESIGN.md 컬러를 Tailwind 클래스로 사용. **인라인 스타일(`style={{}}`) 지양.**

```tsx
// ✅ Tailwind 클래스 사용
<div className="bg-surface border border-white/5 rounded-lg p-4">
  <h2 className="text-text-primary font-semibold text-sm">제목</h2>
  <p className="text-text-tertiary text-xs">설명</p>
</div>

// ✅ 브랜드 컬러
<button className="bg-brand hover:bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-md">
  추가하기
</button>

// ✅ 상태 뱃지 (D-day)
<span className="text-danger bg-danger/8 border border-danger/20 text-[10px] font-medium px-2 rounded-full">
  D-1
</span>

// ❌ 인라인 스타일 금지
<div style={{ background: '#0f1011', color: '#f7f8f8' }}>
```

### 주요 커스텀 클래스
| Tailwind 클래스 | 값 |
|---|---|
| `bg-bg` | `#08090a` (페이지 배경) |
| `bg-surface` | `#0f1011` (사이드바/패널) |
| `bg-surface-2` | `#191a1b` (카드) |
| `text-text-primary` | `#f7f8f8` |
| `text-text-tertiary` | `#8a8f98` (muted) |
| `bg-brand` | `#5e6ad2` (CTA) |
| `text-danger` | `#f87171` |
| `text-warning` | `#fb923c` |
| `text-success` | `#10b981` |

---

## 7. 라우팅 구조

```tsx
// src/App.tsx — 목표 구조
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/onboarding" element={<Onboarding />} />
    {/* 이하 로그인 필수 */}
    <Route element={<AuthGuard />}>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/board" element={<Board />} />
        <Route path="/board/:id" element={<BoardDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/myinfo" element={<MyInfo />} />
        <Route path="/settings/alarm" element={<AlarmSettings />} />
        <Route path="/settings/profile" element={<ProfileSettings />} />
        <Route path="/settings/help" element={<Help />} />
        <Route path="/inquiry" element={<Inquiry />} />
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

---

## 8. D-day 계산 유틸

```ts
// src/utils/dday.ts
import dayjs from 'dayjs'

export function calcDday(deadline: string): number {
  return dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day')
}

export function getDdayLabel(dday: number): string {
  if (dday === 0) return 'D-day'
  if (dday > 0) return `D-${dday}`
  return `D+${Math.abs(dday)}`
}

// D-day 뱃지 컬러 결정
export function getDdayVariant(dday: number): 'danger' | 'warning' | 'info' {
  if (dday <= 2) return 'danger'
  if (dday <= 7) return 'warning'
  return 'info'
}
```

---

## 9. 환경변수

`.env` 파일은 `.env.example`을 복사해서 사용. 절대 커밋 금지.

```
VITE_API_URL=http://localhost:3000
VITE_KAKAO_CLIENT_ID=카카오_앱키
```

코드에서는 `import.meta.env.VITE_API_URL` 형태로 접근.

---

## 10. 커밋 / 브랜치 규칙

```
feat: 회사 카드 CRUD 구현
fix: D-day 계산 오류 수정
refactor: CompanyCard 컴포넌트 분리
style: 사이드바 active 상태 스타일 수정
```

브랜치: `feature/company-card`, `fix/dday-calc`, `refactor/sidebar`
