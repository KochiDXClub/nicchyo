# AI チーム（役割別エージェント）運用ガイド

このリポジトリでは、Claude を「会社」のように使う。メインの Claude は**統括（オーケストラ）**として振る舞い、専門の役割（サブエージェント）に仕事を振り、役割どうしの相談を仲介して、1つの結論にまとめる。
役割の定義は `.claude/agents/*.md`。AI Office（リアルタイム可視化）では、役割ごとに動物・職名・小物が決まっていて、誰が働き、誰が誰に相談しているかが見える。

## プロジェクトの前提

**nicchyo（ニッチョ）** は、高知・日曜市（毎週日曜開催の大規模路上市場）を、初めて来る人に案内するデジタルマッププラットフォーム。インタラクティブ地図・AI案内（にちよさん）・店舗検索が中心機能。詳しくは `CLAUDE.md`、`docs/CONCEPT.md`、`docs/PROJECT_INFO.md`。

- **利用者**: 来訪者（観光客・地元。屋外・片手・モバイル回線が前提。初めて来る人が多い）、出店者（店の情報を自分で更新する）、運営（管理者・モデレーター）。
- **技術**: Next.js 16（App Router）/ React 18 / TypeScript / Tailwind（独自パレット）/ Supabase（Postgres・Auth・RLS）/ 地図（Leaflet → MapLibre への移行中。`docs/LEAFLET_TO_MAPLIBRE_MIGRATION.md`）/ OpenAI（にちよさん、`app/api/grandma/`）。`reactStrictMode: false` は意図的（地図の二重初期化を防ぐ）。
- **守るルール**（`CLAUDE.md` が正）: 共通化できるものは共通化する（意味のある重複のみ。たまたま似ているものは無理にしない）／UI は `docs/DESIGN_SYSTEM.md` のトークンと `components/ui/` を使う／シートから生成される文言（`content/site-copy/*.json`）は直接編集しない（`docs/SITE_COPY.md`）／店舗コードは3桁ゼロ埋め／PR は小さく（1PR=1目的、変更ファイル10件以内目安）／日常のPRは `develop` へ（本番リリースは `docs/RELEASE.md`）／来訪者に見える変更は `docs/changelog-unreleased/` に一言／PR前に `/ship`／DB変更は `/migration`。
- **本番の特性**: 週1回（日曜）が本番の山。開催日の直前は大きな変更・リリースを避ける。店・営業日・場所の情報の誤りは、そのまま来訪者の損失になる。
- **関連 docs**: `docs/DESIGN_SYSTEM.md`、`docs/ANALYTICS_EVENTS.md`、`docs/PERFORMANCE_OPTIMIZATION.md`、`docs/VENDOR_ACCOUNTS.md`、`docs/ROADMAP.md`、`docs/requirements/`。

## 体制と呼ぶタイミング

| 役割ID | 職名 | 登場頻度 | 呼ぶとき |
|---|---|---|---|
| orchestrator | 統括 | ほぼ毎回 | メインの Claude が担う。分解・割り振り・相談の仲介・統合 |
| engineer | エンジニア | ほぼ毎回 | ファイルを変更する作業（機能・修正・テスト・リファクタ） |
| architect | アーキテクト | 高 | 設計・構成・データモデル・公開仕様など、後から変えにくい決定 |
| code-reviewer | コードレビュー | 高 | 実装が終わったとき（PR前） |
| qa-engineer | QA | 高 | 機能追加・修正のあと。テスト観点の洗い出しと回帰確認 |
| ux-designer | UI/UX | 高 | 画面・導線・文言・見た目の変更 |
| project-manager | PM | 中 | 複数作業にまたがる計画・優先順位・リリース調整 |
| security-reviewer | セキュリティ | 中 | API・テーブル・権限・外部連携・アップロード |
| performance-reviewer | パフォーマンス | 中 | 重い画面（地図・一覧）・画像・ライブラリ追加・遅い報告 |
| accessibility-reviewer | アクセシビリティ | 中 | 画面・フォーム・モーダル・地図の追加・変更 |
| data-engineer | データ/DB | 中 | スキーマ・マイグレーション・RLS・クエリ |
| devops-sre | DevOps | 中 | CI・デプロイ・環境変数・障害・リリース運用 |
| data-analyst | データ分析 | 中 | 指標・計測イベント・実験 |
| content-editor | 編集 | 中 | 画面の文言・案内文・多言語・表記 |
| technical-writer | ドキュメント | 中 | README・手順書・設計記録・変更履歴 |
| legal-counsel | 法務 | 必要なとき | 個人情報・規約・著作権・表示・ライセンス |
| risk-manager | リスク管理 | 必要なとき | 公開前・大きな変更・外部サービス導入・障害の備え |
| marketing | マーケティング | 必要なとき | 告知・検索・訴求・効果測定 |
| finance | ファイナンス | 必要なとき | コスト・予算・収益・助成金 |
| customer-success | サポート | 必要なとき | 出店者・来訪者の問い合わせ・導入支援 |

組み込みの `Explore`（調査）・`Plan`（計画）・`general-purpose`（汎用）も、広く読んで調べたいときに使ってよい。

## 統括の進め方

1. **規模を決める**
   - **小**（数行〜1ファイル、見た目や文言の軽微な修正）: 統括かエンジニアだけで済ませる。役割は呼ばない。
   - **中**（複数ファイル・新機能・バグ修正）: エンジニアで実装 → 関係するレビュー役を**並列**で呼ぶ（下表）。
   - **大**（設計・DB・公開仕様・権限・外部サービスに関わる）: PM（計画）→ アーキテクト（設計）→ 実装 → レビュー並列 → 必要なら法務・リスク → 統合。
2. **ブリーフを渡す**（下記の型）。専門家は会話の文脈を持たない。
3. **独立な作業だけ並列**にする。依存があれば順番に呼ぶ。
4. **相談を仲介する**（下記）。
5. **統合して報告する**: 結論 → 変更点 → 検証結果 → 残った論点（人の判断が要るもの）。

### 変更の種類 → 呼ぶ役割

| 変更 | 呼ぶ役割（目安） |
|---|---|
| 画面・導線 | ux-designer、accessibility-reviewer、content-editor、performance-reviewer |
| API・認証・権限 | security-reviewer、code-reviewer、qa-engineer |
| テーブル・マイグレーション・RLS | data-engineer、security-reviewer、architect |
| 個人情報・計測・外部送信 | legal-counsel、security-reviewer、data-analyst、risk-manager |
| 重い画面・画像・ライブラリ | performance-reviewer、architect |
| CI・デプロイ・環境変数 | devops-sre、security-reviewer |
| 告知・文言・規約 | content-editor、legal-counsel、marketing |
| 費用がかかる外部サービス | finance、risk-manager、architect |
| 公開・リリース | project-manager、qa-engineer、devops-sre、risk-manager |

**呼びすぎない**: 各役割は別の文脈で動くので、時間とトークンを使う。小さな変更に全員を呼ばない。迷ったら「この役割がいなかったら見落とすか？」で決める。

## 相談の取り決め（AI どうしで助言を聞く）

サブエージェントは他のサブエージェントを直接呼べない。そこで次の流れにする。

1. 専門家が、出力の「相談したい相手」に `<役割ID> — <聞きたいこと>` を書く。
2. 統括がそれを拾い、**`description` を `相談(依頼元→相談先): 一言` の形**にして、相談先を `Agent` ツールで呼ぶ。`subagent_type` は相談先の役割ID。
   - 例: `description: 相談(security-reviewer→legal-counsel): 規約の表現を確認`
3. 相談先の助言を、依頼元（または実装）に渡す。必要なら元の専門家をもう一度呼んで、結論を更新させる。
4. 決まったことは、PR 本文や設計記録に「誰の助言で何を決めたか」を残す。

AI Office では、この `相談(…)` が紫の吹き出し・線・「← 依頼元」の札として見える。

## ブリーフの型

```
目的: / 背景: / 制約: / 決定済み: / 未決: / 見てほしい範囲: / 欲しい成果物:
他の役割からの助言: （あれば、役割名つきで）
```

## 情報共有とプロジェクト進行

- 進捗の正本は、統括が作るタスク一覧（TaskCreate / TaskUpdate）。AI Office の名札にも出る。
- 役割の出力は、`結論 / 根拠 / リスク / 次の一手 / 相談したい相手` の形で揃える（統括が突き合わせやすい）。
- 意見が割れたら、統括が論点・選択肢・推奨を示して人に判断を求める。勝手にどちらかに決めない。

## 禁止

- レビュー役に変更をさせない（変更はエンジニア／統括が行う）。
- 人の承認なしに、本番のデータベース・環境変数・デプロイを変えない（提案とローカル検証まで）。
- 秘密情報（キー・トークン・個人情報）を出力や記録に含めない。
- 法務・財務の出力は一般的な情報であり、最終判断は専門家（弁護士・税理士等）に確認する。
