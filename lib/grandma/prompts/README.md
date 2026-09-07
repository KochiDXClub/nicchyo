# lib/grandma/prompts

AIに送るプロンプト文の置き場所。**プロンプトの文面を直すときは、まずここを見る。**

以前は次の6箇所に散らばっていた。

| 旧・置き場所 | 現在の置き場所 |
|---|---|
| `app/(public)/map/data/grandmaAiContext.ts` | `consultSystemPrompt.ts` |
| `app/(public)/consult/data/consultCharacters.ts` の `personality` / `speechStyle` | `consultCharacterProfiles.ts` |
| `lib/grandma/promptBuilder.ts` の会話構成 | `consultConversation.ts` |
| `app/api/grandma/shop-chat/route.ts` の `buildSystemPrompt()` | `shopChatPrompt.ts` |
| `app/api/grandma/itinerary/route.ts` のインラインプロンプト | `itineraryPrompt.ts` |
| `app/api/map-agent/route.ts` のインラインプロンプト | `mapAgentPrompt.ts` |

## ファイル構成

| ファイル | 中身 |
|---|---|
| `consultRules.ts` | 相談のプロンプト文（会話ルール・内容ルール・出力ルール）。**葉モジュール。何も import しない** |
| `consultSystemPrompt.ts` | 相談のシステムプロンプトの組み立て |
| `consultCharacterProfiles.ts` | キャラ4人の `personality` / `speechStyle`（AIに渡す人格設定） |
| `consultConversation.ts` | 掛け合いの構成パターンと、ストリーミング出力フォーマットの指示 |
| `shopChatPrompt.ts` | 店舗詳細ページのチャット |
| `itineraryPrompt.ts` | 旅程プランナー |
| `mapAgentPrompt.ts` | マップAIアシスタント |
| `promptKeys.ts` | DBで上書きできるキーの定義と、既定値へのフォールバック |
| `promptStore.server.ts` | `ai_prompts` からアクティブな文面を読む（サーバー専用） |

## 運営が調整してよい文 / コード側の契約

この一部はDBに出して管理画面から編集できるようにする（#567）。
そのため各定数には、どちらに属するかを次の目印で書いてある。

- `運営調整可` … 発話数・方言の濃さ・断り方など、日曜市を知っている人が決めるべき文面
- `コード契約` … 変えるとアプリが壊れる文面

DBで上書きできるのは `promptKeys.ts` の `AI_PROMPT_DEFS` に載っているキーだけ。
ここに `コード契約` の文面を足してはいけない。

「コード契約」の代表が `CONSULT_OUTPUT_RULES` と `buildStreamingFormatPrompt()`。
これらは `buildResponseSchema()` のJSON schema、`parseStreamingConsultOutput()` のパーサ、
`GrandmaChatter` の描画と対になっている。1行消すだけで相談機能が止まるので、
管理画面から編集できるようにしてはいけない。

## プロンプトキャッシュの都合

`buildGrandmaAiSystemPrompt()` の戻り値は、先頭から順に

1. 全リクエスト共通の固定文（イントロ〜出力ルール）
2. 毎回変わる部分（選ばれたキャラ、今回の会話構成）

の並びになっている。OpenAI のプロンプトキャッシュは**先頭一致の長さ**で効くので、
共通プレフィックスをできるだけ長く保つ必要がある。

**頻繁に書き換わる文を前方に足さないこと。** 可変になるものは必ず末尾に寄せる。
