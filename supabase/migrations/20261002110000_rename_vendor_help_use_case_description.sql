-- 出店者の相談（vendorHelp）の説明文を、「使い方ガイド」から「よくある質問」に合わせて直す。
--
-- 20260930150000_create_vendor_help_logs.sql が 'on conflict do nothing' で入れた行は、
-- コード側の既定値（lib/ai/models.ts）を直しても、このテーブルの説明文は古いままで、
-- 管理画面（AIモデルの設定）にそのまま出る。
-- 説明文が元のままの行だけを直す（運営が書き換えていたら、そのままにする）。

update public.ai_use_cases
   set description = '出店者トップで、出店者がアプリの使い方を聞くヘルプデスク。よくある質問とその店の登録内容を元に、200文字程度で答える。'
 where key = 'vendorHelp'
   and description = '出店者トップで、出店者がアプリの使い方を聞くヘルプデスク。使い方ガイドとその店の登録内容を元に、200文字程度で答える。';
