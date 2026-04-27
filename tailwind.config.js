/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans KR'", 'Inter Variable', 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", "'Berkeley Mono'", 'ui-monospace', 'monospace'],
      },
      colors: {
        // Backgrounds
        bg: '#08090a',
        surface: '#0f1011',
        'surface-2': '#191a1b',
        'surface-3': '#28282c',

        // Brand
        brand: '#5e6ad2',
        accent: '#7170ff',
        'accent-hover': '#828fff',

        // Text
        'text-primary': '#f7f8f8',
        'text-secondary': '#d0d6e0',
        'text-tertiary': '#8a8f98',
        'text-quaternary': '#62666d',

        // Status
        success: '#10b981',
        'success-strong': '#27a644',
        danger: '#f87171',
        warning: '#fb923c',
        info: '#7170ff',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
        subtle: 'rgba(255,255,255,0.05)',
        strong: 'rgba(255,255,255,0.14)',
      },
      backgroundColor: {
        card: 'rgba(255,255,255,0.02)',
        'card-hover': 'rgba(255,255,255,0.03)',
      },
      borderRadius: {
        badge: '9999px',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
