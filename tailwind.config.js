/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
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
        violet: 'rgb(var(--violet) / <alpha-value>)',

        // 의미 토큰 — `bg-white/N`·`text-white/N` 대체용. alpha 미리 박혀있는 완전한 값.
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
