/**
 * nicchyo のデザイントークン。
 *
 * ここに書いてあるのは「こうしたい」ではなく「いま実際にそうなっている」。
 * 値はプロダクトの画面（とくに privacy / support / analysis のように
 * 直近で作り込んだページ）から取っている。画面を直してトークンとズレたら、
 * ズレたほうではなくトークンを直す。
 *
 * 使い方の判断は docs/DESIGN_SYSTEM.md に書いてある。
 */
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
        // ===== ブランド =====
        // base はページの地。html/body にも同じ値が入っている（globals.css）
        'nicchyo-base':       '#FFFAF0',
        // ink は文字の基準色。濃淡は色を足さずに不透明度で作る（/70 /55 /40）
        'nicchyo-ink':        '#3A3A3A',
        // primary（緑）は面ではなく「しるし」に使う色。引用線・箇条書きの点・選択中の印
        'nicchyo-primary':    '#7ED957',
        'nicchyo-accent':     '#FFDE59',
        'nicchyo-soft-green': '#A0D7A7',

        // ===== 主色（amber） =====
        // 面と主ボタンはこちら。ブランドの緑とは役割が違う
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

        // ===== 罫 =====
        // 白い面の上と、クリーム地の上とで罫の色が違う。混ぜると濁る
        line: {
          DEFAULT: 'rgba(58,58,58,0.07)', // 白い面の上（カードの縁・区切り）
          warm:    '#EADFCB',             // クリーム地の上（ヘッダーの下端など）
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

        // ===== 面 =====
        surface: {
          // 地より一段明るい面。カードが白のとき、その下に敷く帯に使う
          warmwhite: '#FEFCE8',
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
        chip:  '9999px', // チップ・主ボタン
        btn:   '12px',   // フォームの中など、丸くしすぎたくないボタン
        card:  '22px',   // カード（support の実測値）
        panel: '20px',   // 画面に固定されるパネル
        sheet: '28px',   // 下から出るシートの上端
      },

      boxShadow: {
        // 触れる小物（チップ・小さいボタン）
        chip: '0 1px 2px rgba(58,58,58,0.06)',
        // 面。地の上にカードを置くときの既定
        card: '0 2px 8px rgba(58,58,58,0.06), 0 1px 2px rgba(58,58,58,0.04)',
        // そのページで主役の面をひとつだけ持ち上げる。多用すると効かなくなる
        lift: '0 1px 2px rgba(58,58,58,0.04), 0 18px 40px -28px rgba(146,64,14,0.5)',
        // 地から浮いているもの（固定パネル・ポップオーバー）
        float: '0 18px 48px rgba(102,58,20,0.08)',
        // 押せることを主張するボタン
        pop: '0 4px 10px rgba(146,64,14,0.12), 0 2px 4px rgba(146,64,14,0.08)',
      },

      transitionTimingFunction: {
        // 開く・閉じるに使う。線形だと安っぽく見える
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
