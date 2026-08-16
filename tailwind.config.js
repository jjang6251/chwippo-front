import defaultColors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  /**
   * 🔴 치뽀는 `.dark` **클래스가 아니라 `data-theme` 속성**으로 테마를 바꾼다.
   * `'class'` 로 두면 `dark:` variant 가 **영원히 발동하지 않는다** — 실제로 코드 전체에
   * `dark:` 사용 0건이었고(2026-08-17 확인), 그래서 이 오설정이 드러난 적이 없다.
   *
   * 켜는 이유: 다크 전용 팔레트(`-400` 계열)를 라이트에서 그대로 쓰는 곳들이 있는데
   * (직군 태그 대비 **1.39:1**), 의미 토큰으로는 8색을 표현할 수 없어 테마 분기가 필요하다.
   * `data-theme` 미지정(=다크 fallback)도 함께 잡는다.
   */
  darkMode: ['variant', ['&:is([data-theme="dark"] *)', '&:is(:root:not([data-theme]) *)']],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans KR'", 'Inter Variable', 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", "'Berkeley Mono'", 'ui-monospace', 'monospace'],
        serif: ["'Nanum Myeongjo'", 'ui-serif', 'serif'],
      },
      // index.css 의 그림자 토큰 배선 — 라이트 모드 카드 면 분리용 (다크에선 사실상 비가시)
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      /**
       * 🔴 **알파 modifier 스케일 보강** (2026-08-17 `/uiux` 실측).
       *
       * Tailwind 기본 opacity 스케일엔 5의 배수만 있다. `bg-warning/8` 처럼 **없는 값을 쓰면
       * 클래스가 아예 방출되지 않아 배경이 안 그려진다** — 에러도 경고도 없이 조용히 사라진다.
       * 실측 결과 코드 곳곳에서 `/4 /6 /8 /12 /14 /18` 을 쓰고 있었고 **전부 무효**였다
       * (`bg-warning/8` 13곳 · `bg-brand/8` 12곳 · `bg-info/8` 9곳 …).
       *
       * 값을 5의 배수로 스냅하면 의도한 톤보다 진해지므로, **스케일 쪽을 넓힌다.**
       * 이렇게 하면 호출부를 한 줄도 안 고치고 전부 살아난다.
       */
      opacity: {
        4: '0.04',
        6: '0.06',
        8: '0.08',
        12: '0.12',
        14: '0.14',
        18: '0.18',
      },
      colors: {
        // 색은 RGB triplet 변수 + tailwind opacity modifier 지원 (bg-warning/10 등)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        // 입력 전용 — 다크 = 컨테이너보다 밝게, 라이트 = 컨테이너보다 어둡게. 모든 input/textarea/select 표준 배경
        input: 'rgb(var(--input-bg) / <alpha-value>)',

        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-hover': 'rgb(var(--brand-hover) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',

        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
        'text-quaternary': 'rgb(var(--text-quaternary) / <alpha-value>)',

        success: 'rgb(var(--success) / <alpha-value>)',
        'success-strong': 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        /**
         * 🔴 **팔레트를 통째로 덮어쓰지 않는다** (2026-08-17 `/uiux` 실측).
         *
         * 여기에 문자열 하나만 두면 Tailwind 기본 `violet-50…950` 이 **전부 사라진다.**
         * 그래서 `text-violet-400`·`bg-violet-600` 이 조용히 no-op 이 되어
         *   · 「기획·PM」 직군 태그 (다른 7개 직군은 전부 색이 있는데 이것만 무색)
         *   · 자소서 「직무역량·핵심경험」 카테고리
         *   · 회사 아바타 10색 중 1색 → **투명 배경 + 흰 글자** (라이트에서 거의 안 보임)
         * 이 셋이 색을 잃고 있었다. DEFAULT 로 의미 토큰을 두고 shade 는 되살린다.
         */
        violet: { ...defaultColors.violet, DEFAULT: 'rgb(var(--violet) / <alpha-value>)' },

        // 의미 토큰 — `bg-white/N`·`text-white/N` 대체용. alpha 미리 박혀있는 완전한 값.
        //
        // 🔴 `line`·`line-strong` 은 오랫동안 **`borderColor`·`divideColor` 에만** 있었다.
        //    그래서 `bg-line` 은 클래스만 쓰이고 **CSS 가 생성되지 않아 아무것도 안 그려졌다** —
        //    바텀시트 손잡이·대시보드 스켈레톤·진행바 트랙·캘린더 점 22곳이 통째로 투명이었다.
        //    빌드 CSS 전수 확인: `.border-line` 은 있고 `.bg-line*` 은 0건 (2026-08-11).
        //
        //    ⚠️ 여기 값들은 `rgba()` 통값이라 **투명도 수식(`bg-line/40`)이 안 먹는다.**
        //    반투명이 필요하면 이 토큰 말고 채널 토큰(`bg-surface-3` 등)을 쓸 것.
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        card: 'var(--card)',
        'card-solid': 'var(--card-solid)',
        'card-hover': 'var(--card-hover)',
        'card-strong': 'var(--card-strong)',
        'text-faint': 'var(--text-faint)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        subtle: 'var(--border)',
        strong: 'var(--border-strong)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
      },
      divideColor: {
        DEFAULT: 'var(--divider)',
        line: 'var(--divider)',
      },
      borderRadius: {
        badge: '9999px',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        celebrateUp: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.96)' },
          '60%': { opacity: '1', transform: 'translateY(0) scale(1.01)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.2s ease-out',
        slideUp: 'slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        fadeIn: 'fadeIn 0.25s ease-out',
        celebrateUp: 'celebrateUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
