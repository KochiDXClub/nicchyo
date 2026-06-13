module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== 既存（維持） =====
        'nicchyo-base':       '#FFFAF0',
        'nicchyo-primary':    '#7ED957',
        'nicchyo-accent':     '#FFDE59',
        'nicchyo-ink':        '#3A3A3A',
        'nicchyo-soft-green': '#A0D7A7',

        // ===== プロダクト主要パレット（amber） =====
        amber: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        orange: {
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },

        // ===== セマンティック =====
        favorite: {
          bg:   '#fff1f2',
          fg:   '#be123c',
          line: '#fecdd3',
        },
        ai: {
          bg:   '#fff1f2',
          fg:   '#e11d48',
          line: '#fecdd3',
        },
        info: {
          bg:   '#eff6ff',
          fg:   '#1d4ed8',
          line: '#bfdbfe',
        },

        // ===== 面（surface） =====
        surface: {
          cream:     '#FFFAF0',
          warmwhite: '#FEFCE8',
          tint:      '#FEF3C7',
        },
      },

      fontFamily: {
        display: ['"Mochiy Pop One"', '"Zen Kaku Gothic New"', 'sans-serif'],
        sans: [
          '"Zen Kaku Gothic New"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          'Meiryo',
          'sans-serif',
        ],
      },

      borderRadius: {
        chip:  '9999px',
        btn:   '12px',
        card:  '16px',
        panel: '20px',
        sheet: '28px',
      },

      boxShadow: {
        pop:  '0 4px 10px rgba(146,64,14,0.12), 0 2px 4px rgba(146,64,14,0.08)',
        card: '0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        chip: '0 1px 2px rgba(15,23,42,0.06)',
      },

      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};