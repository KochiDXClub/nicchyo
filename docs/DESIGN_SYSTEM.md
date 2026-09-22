# デザインシステム

このファイルは「こうしたい」ではなく **「いま実際にそうなっている」** を書いたもの。
値は画面から測って取っている。画面を直してこことズレたら、**画面ではなくこのファイルを直す**。

実装は `tailwind.config.js`（トークン）と `components/ui/`（部品）にある。

---

## 1. 判断の順番

新しく画面を書くとき、**上から順に**見る。

1. `components/ui/` に部品があるか → あれば使う
2. 無いが、同じものを2回目以降書こうとしている → `components/ui/` に足してから使う
3. その画面にしか無いもの → ページの `components/` に置く
4. どれでもない → トークン（下の表）を組み合わせて書く。生の hex と素の数値は使わない

「似ているけど少し違うから別に書く」を繰り返した結果が、統合前の状態
（EmptyState が3実装、店舗カードが3実装、`cn()` が2つ）だった。
少し違うだけなら **部品側に variant を足す**。

---

## 2. 組み立ての基本

```
クリームの地（nicchyo-base）  ← body に入っている。ページ側で塗り直さない
  └ 白い面（Surface）         ← 情報はここに載せる
      └ 文字は ink の濃淡      ← 色を足さずに不透明度で階調を作る
```

主色は **amber**。ブランドの緑（`nicchyo-primary`）は面には使わず、
**しるし**に使う（引用の縦線、箇条書きの点、選択中の印）。
`app/(public)/privacy/page.tsx` の `border-l-[3px] border-nicchyo-primary` がその形。

---

## 3. トークン

### 文字

濃淡は色を足さず `nicchyo-ink` の不透明度で作る。`slate-*` / `gray-*` は新しく書かない。

| 用途 | クラス |
|---|---|
| 本文・見出し | `text-nicchyo-ink` |
| 副次（説明文） | `text-nicchyo-ink/70` |
| 補足（注記・脚注） | `text-nicchyo-ink/55` |
| 弱（単位・目盛り） | `text-nicchyo-ink/40` |

### 面と罫

| 用途 | クラス |
|---|---|
| ページの地 | `bg-nicchyo-base`（`PageShell` が付ける） |
| 面 | `bg-white`（`Surface` が付ける） |
| 白い面の上の罫 | `ring-line` / `border-line` |
| クリーム地の上の罫 | `border-line-warm` |

罫を1本引くときは `border` より `ring` を選ぶ。`ring` は要素の大きさを変えないので、
面を並べたときに 1px ぶんズレない。

### 角丸

| トークン | 値 | 使うところ |
|---|---|---|
| `rounded-chip` | 9999px | チップ、主ボタン |
| `rounded-btn` | 12px | フォームの中など、丸くしすぎたくないボタン |
| `rounded-card` | 22px | カード |
| `rounded-panel` | 20px | 画面に固定されるパネル |
| `rounded-sheet` | 28px | 下から出るシートの上端 |

`rounded-xl` / `rounded-2xl` / `rounded-[22px]` が混ざっていたのをここに寄せる。

### 影

影は「どれだけ浮いているか」で選ぶ。大きい影を並べると、どれも浮いて見えなくなる。

| トークン | 使うところ |
|---|---|
| `shadow-chip` | 触れる小物 |
| `shadow-card` | 地の上のカード（既定） |
| `shadow-lift` | **その画面の主役をひとつだけ**持ち上げる |
| `shadow-float` | 地から浮いている固定物（パネル・ポップオーバー） |
| `shadow-pop` | 押せることを主張するボタン |

### 動き

開閉には `ease-out-soft` を使う。線形だと安っぽく見える。
`active:scale-95` は `motion-reduce:active:scale-100` とセットで書く（`Button` は対応済み）。

---

## 4. 部品

すべて `@/components/ui` から読む。

### ページの外枠

```tsx
import { PageShell, PageContainer, PageHeader } from "@/components/ui";

<PageShell>
  <PageHeader label="プライバシーポリシー" />
  <PageContainer as="main">
    {/* 中身 */}
  </PageContainer>
</PageShell>
```

`PageShell` が地の色・最低の高さ・**下の余白**を持つ。
下の余白は `--nav-bar-height + --safe-bottom` から計算する。
`pb-24` のような決め打ちにすると、ホームインジケータのある端末で最後の行がナビに隠れる。
`NavigationBar` を出さない画面では `bottomNav={false}`。

`PageContainer` の幅は3段階しかない。画面から測って出てきた値なので、増やす前に本当に必要か考える。

| `width` | 値 | 使うところ |
|---|---|---|
| `narrow` | 32rem | モバイル前提の一覧（カレンダー・FAQ） |
| `reading`（既定） | 38rem | 読み物、入力の多いフォーム |
| `wide` | 64rem | 図や表が主役の画面（支援・分析） |

### ボタン

```tsx
<Button>地図へ戻る</Button>                        {/* primary */}
<Button variant="secondary" size="sm">あとで</Button>
<Link href="/consult" className={buttonClass({ variant: "secondary" })}>相談する</Link>
```

| `variant` | 使うところ |
|---|---|
| `primary`（既定） | その画面でいちばんしてほしいこと。**1画面に1つ** |
| `ink` | 読み物のページの主ボタン。amber だと本文より目立ちすぎる場面 |
| `secondary` | primary と並べる二番手 |
| `quiet` | 主張させたくない操作（閉じる・切り替え） |
| `ghost` | 面を持たない。アイコンだけ、密に並ぶもの |

大きさは `sm`(h-9) / `md`(h-11、既定) / `lg`(h-12) / `icon`。
**`md` 以上は指で押せる大きさ（44px）を満たす**ので、画面の主な操作は `sm` にしない。

リンクをボタンに見せたいときは `buttonClass()` を使う。クラスを写経しない。

### 面

```tsx
<Surface>…</Surface>                          {/* 一覧に並ぶカード */}
<Surface elevation="lifted" padding="lg">…</Surface>  {/* その画面の主役 */}
<Surface as="li" padding="none">…</Surface>   {/* 画像を端まで出すカード */}
```

`elevation` は `flat` / `raised`(既定) / `lifted` / `float`。
`padding` は `none` / `sm` / `md`(既定) / `lg`。

### その他

| 部品 | 使うところ |
|---|---|
| `Badge` | 状態や分類の札。**押せるものには使わない**（押せるなら `Button` の `sm`） |
| `EmptyState` | 図と見出しのある空状態 |
| `EmptyMessage` | 一行だけの空状態 |
| `LoadingSpinner` / `CenteredLoading` | 読み込み中 |

---

## 5. やらないこと

- **生の hex を書かない。** 現状 165 種類ある。増やさない
- **`slate-*` / `gray-*` を新しく書かない。** 文字は ink の不透明度、罫は `line`
- **グラデーションを増やさない。** 現状 25 種類以上ある。面は単色で足りる
- **`components/ui/` に `"use client"` が要るものを置かない。** バレル経由で
  サーバーコンポーネントから読まれたときに壊れる（`components/admin/index.ts` の
  `TrafficOverview` と同じ問題）
- **ダークモードは対象外。** `dark:` は現在 0 箇所。やるなら全画面まとめて決める

---

## 6. まだ揃っていないところ

正直に書いておく。ここは順次寄せる。

| 箇所 | 状態 |
|---|---|
| 店舗カード | `ConsultShopCard` / `ShopResultCard` / `SpotCard` の3実装で角丸・枠・文字色が違う |
| モーダル・シート | `fixed inset-0` が24ファイルに個別実装。共通部品が無い |
| 中立色 | `slate-*` が既存コードに約950箇所。新規で増やさず、触った画面から ink に寄せる |
| `@radix-ui/react-scroll-area` | 唯一の利用箇所だった `ui/scroll-area.tsx` を削除したので未使用。次に依存を整理するときに落とす |

新しい画面をこの表の状態に合わせない。**このファイルの 1〜4 に合わせる。**
