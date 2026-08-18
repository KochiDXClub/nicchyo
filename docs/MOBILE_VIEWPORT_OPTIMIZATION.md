# モバイルViewport最適化ガイド

**実装日**: 2025年12月28日
**ブランチ**: `fix/mobile-viewport-ui`

---

## 📱 概要

スマホブラウザ（Chrome/Safari）の**アドレスバー表示/非表示**に対応し、地図が主役の「アプリ的なWebUI」を実現しました。

---

## 🎯 解決した問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| UIが窮屈 | `height: 100vh` | `100dvh` + CSS変数 |
| ヘッダが地図を圧迫 | 常時表示 | メニュー連動表示 |
| ナビが地図を隠す | 不透明・固定高さ | 半透明・オーバーレイ |
| iOS切り欠き問題 | safe-area未対応 | `env(safe-area-inset-*)` |
| レイアウト崩れ | アドレスバー出没 | viewport動的更新 |

---

## 🏗️ 実装内容

### 1. viewport高さシステム

#### globals.css
```css
/* モダンブラウザ */
body {
  height: 100dvh; /* Dynamic Viewport Height */
}

/* フォールバック */
:root {
  --vh: 1vh; /* JavaScriptで動的更新 */
}

body {
  height: calc(var(--vh, 1vh) * 100);
}

/* safe-area対応 */
:root {
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left: env(safe-area-inset-left);
  --safe-right: env(safe-area-inset-right);
}
```

#### ViewportHeightUpdater.tsx
```typescript
export default function ViewportHeightUpdater() {
  useEffect(() => {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateVH, 100); // iOS Safari対策
    });

    return () => {
      window.removeEventListener('resize', updateVH);
      window.removeEventListener('orientationchange', updateVH);
    };
  }, []);

  return null;
}
```

**効果**: アドレスバーの出現/消失に関わらず、常に正しい画面高さを取得

---

### 2. オーバーレイUI構造

#### レイアウト階層
```
<body> (height: 100dvh)
├─ ViewportHeightUpdater
├─ MenuProvider
│  ├─ AppHeader (fixed, transform: translateY)
│  ├─ children (全画面)
│  └─ HamburgerButton (fixed)
└─ NavigationBar (fixed, 半透明)
```

#### MapPageClient.tsx
```typescript
{% raw %}
// ❌ Before
<div className="h-screen pb-16">
  <main className="flex-1">
    <MapView />
  </main>
</div>

// ✅ After
<div style={{height: '100dvh', height: 'calc(var(--vh, 1vh) * 100)'}}>
  <main className="absolute inset-0">
    <MapView />
  </main>
  <GrandmaChatter /> {/* fixed position */}
  <NavigationBar />  {/* fixed position */}
</div>
{% endraw %}
```

**効果**: 地図が全画面表示、UIはオーバーレイ（圧迫しない）

---

### 3. メニュー連動ヘッダー

#### MenuContext.tsx
```typescript
interface MenuContextType {
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // ...
}
```

#### AppHeader.tsx
```typescript
{% raw %}
export default function AppHeader() {
  const { isMenuOpen } = useMenu();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[9999]"
      style={{
        transform: isMenuOpen ? 'translateY(0)' : 'translateY(-100%)',
        paddingTop: 'calc(0.75rem + var(--safe-top, 0px))',
      }}
    >
      {/* ヘッダー内容 */}
    </header>
  );
}
{% endraw %}
```

#### HamburgerMenu.tsx
```typescript
export default function HamburgerMenu() {
  const { isMenuOpen, toggleMenu, closeMenu } = useMenu();

  return (
    <>
      <button onClick={toggleMenu} className="fixed top-3 right-4 z-[10000]">
        {/* ハンバーガーアイコン */}
      </button>

      {isMenuOpen && <div className="fixed inset-0 z-[9998] bg-black/30" />}

      <div className={`fixed right-0 top-0 z-[9999] ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* メニュー内容 */}
      </div>
    </>
  );
}
```

**効果**: 通常時はヘッダ非表示、メニュー開くときのみ表示

---

### 4. 半透明ナビゲーションバー

#### NavigationBar.tsx
```typescript
{% raw %}
export default function NavigationBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9997] bg-white/80 backdrop-blur-md"
      style={{
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      <div className="h-14 flex items-center justify-around">
        {/* ナビアイテム */}
      </div>
    </nav>
  );
}
{% endraw %}
```

**効果**:
- 地図が透けて見える（backdrop-blur）
- iOSホームインジケーター対応
- コンパクト（h-14）

---

### 5. viewport meta設定

#### layout.tsx
```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // iOS Safe Area 対応
};
```

**効果**: iOS Safe Areaが正しく機能

---

## 📐 レイアウト構造図

### 通常時（メニュー閉じている）
```
┌─────────────────────────────┐
│ [ハンバーガー]              │ ← fixed (z-10000)
│                             │
│         地図（全画面）       │ ← absolute inset-0
│                             │
│                             │
│   [おばあちゃん]           │ ← fixed (z-1400)
│                             │
├─────────────────────────────┤
│ [🗺️][🔍][🍳][✉️]          │ ← fixed 半透明 (z-9997)
└─────────────────────────────┘
```

### メニュー開いた時
```
┌─────────────────────────────┐
│ nicchyo 日曜市マップ [×]   │ ← ヘッダ表示 (z-9999)
├─────────────────────────────┤
│         地図（全画面）       │
│                             │
│                ┌────────────┤
│                │ メニュー   │ ← スライドイン (z-9999)
│                │            │
│                │ ・マップ   │
│                │ ・検索     │
│                └────────────┤
├─────────────────────────────┤
│ [🗺️][🔍][🍳][✉️]          │
└─────────────────────────────┘
```

---

## 🎨 z-index 階層

| 要素 | z-index | 用途 |
|------|---------|------|
| ハンバーガーボタン | 10000 | 最前面（常にアクセス可能） |
| ヘッダー | 9999 | メニュー時に表示 |
| スライドメニュー | 9999 | ヘッダーと同レベル |
| メニューオーバーレイ | 9998 | スライドメニューの背景 |
| ナビゲーションバー | 9997 | 常時表示 |
| おばあちゃん | 1400 | 地図の上 |
| 地図装飾コーナー | 1500 | 地図の枠 |
| 地図コンテナ | 10 | 背景 |

---

## 🔧 CSS変数一覧

| 変数名 | デフォルト | 用途 |
|--------|-----------|------|
| `--vh` | `1vh` | viewport高さ（動的更新） |
| `--safe-top` | `0px` | iOS上部切り欠き |
| `--safe-bottom` | `0px` | iOSホームインジケーター |
| `--safe-left` | `0px` | iOS左側Safe Area |
| `--safe-right` | `0px` | iOS右側Safe Area |

---

## ✅ ブラウザ対応

| ブラウザ | viewport | safe-area | backdrop-blur |
|----------|----------|-----------|---------------|
| Chrome (Android) | ✅ 100dvh | ✅ | ✅ |
| Safari (iOS) | ✅ 100dvh | ✅ | ✅ |
| Firefox (Android) | ✅ フォールバック | ✅ | ✅ |

---

## 🧪 動作確認項目

### iOS Safari
- [ ] アドレスバー表示/非表示でレイアウトが崩れない
- [ ] ホームインジケーターがナビゲーションを隠さない
- [ ] 切り欠き（ノッチ）がヘッダーと重ならない
- [ ] orientationchange後も正しい高さ

### Android Chrome
- [ ] アドレスバー表示/非表示でレイアウトが崩れない
- [ ] ジェスチャーバーがナビゲーションを隠さない
- [ ] 画面回転後も正しい高さ

### 両方
- [ ] メニュー開閉時にヘッダーが正しく表示/非表示
- [ ] ナビゲーションバーが半透明で地図が透ける
- [ ] 地図操作（ズーム・パン）がスムーズ
- [ ] スクロールが発生しない

---

## 🚀 PWA 化への準備

この実装は以下の理由で、将来的なアプリ化に対応しています：

1. **viewport システム**: ネイティブアプリでも流用可能
2. **safe-area 対応**: iOS/Android両対応
3. **オーバーレイ構造**: ネイティブUIと統合しやすい
4. **メニュー状態管理**: Contextで一元管理

> **注記**: Capacitor パッケージ（`@capacitor/cli` / `@capacitor/core`）は未使用のため削除済み（#202）。ネイティブアプリ化を検討する場合は改めて導入する。

---

## 📚 参考資料

### viewport
- [100vh in Safari](https://allthingssmitty.com/2020/05/11/css-fix-for-100vh-in-mobile-webkit/)
- [CSS Values: dvh, svh, lvh](https://developer.mozilla.org/en-US/docs/Web/CSS/length#relative_length_units_based_on_viewport)

### safe-area
- [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [env() CSS Function](https://developer.mozilla.org/en-US/docs/Web/CSS/env)

### backdrop-blur
- [backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)

---

## 🔍 トラブルシューティング

### Q: iOS Safariで切り欠きが表示される
**A**: `viewport-fit=cover` が設定されているか確認
```typescript
export const viewport: Viewport = {
  viewportFit: 'cover',
};
```

### Q: アドレスバー消失時にレイアウトがずれる
**A**: `ViewportHeightUpdater` が読み込まれているか確認
```typescript
// layout.tsx
<ViewportHeightUpdater />
```

### Q: メニューを開いてもヘッダーが表示されない
**A**: `MenuProvider` でラップされているか確認
```typescript
<MenuProvider>
  <AppHeader />
  {children}
</MenuProvider>
```

### Q: ナビゲーションバーが不透明
**A**: Tailwindのblurプラグインが有効か確認
```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('tailwindcss-animate'), // backdrop-blur有効化
  ],
};
```

---

**作成**: Claude Code
**ブランチ**: `fix/mobile-viewport-ui`
**コミット**: 97ed9c9
