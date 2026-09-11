/**
 * AIばあちゃん 不正利用検知ユーティリティ
 */

export type AbuseEvent = {
  type: "sql_injection" | "prompt_injection" | "spam" | "rate_limit";
  severity: 1 | 2 | 3;
  reason: string;
};

// SQLインジェクションパターン
const SQL_PATTERNS = [
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|CAST|CONVERT)\b/i,
  /('|--|\/\*|\*\/|;)\s*(SELECT|DROP|INSERT|UPDATE|DELETE)/i,
  /\bOR\b.+\b=\b/i,          // OR 1=1
  /\bAND\b.+\b=\b/i,         // AND 1=1
  /'\s*;\s*--/,               // '; --
  /xp_\w+/i,                  // xp_cmdshell etc
];

// プロンプトインジェクションパターン
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(everything|all|your|previous)/i,
  /you\s+are\s+now\s+(a|an|the)/i,
  /act\s+as\s+(a|an|if)/i,
  /\bDAN\b/,                   // Do Anything Now
  /jailbreak/i,
  /system\s+prompt/i,
  /new\s+instructions?:/i,
  /\{\{.{0,100}\}\}/,          // テンプレートインジェクション
  /\[INST\]|\[\/INST\]/,       // LLM制御トークン
  /<\|.{0,30}\|>/,
  /disregard\s+(all|any|your)/i,
  /プロンプト.{0,10}(無視|忘れ|変え)/,
  /(あなたは|君は|お前は).{0,20}(別の|新しい|違う).{0,10}(AI|ボット|キャラ)/,
];

// スパム・無意味テキスト検知
function detectSpam(text: string): boolean {
  if (!text || text.length < 2) return false;

  // 同じ文字が文字列の70%以上を占める（aaaaaaa等）
  const charCounts = new Map<string, number>();
  for (const char of text) charCounts.set(char, (charCounts.get(char) ?? 0) + 1);
  const maxCount = Math.max(...charCounts.values());
  if (maxCount / text.length > 0.7) return true;

  // 同じフレーズの繰り返し（3回以上）
  if (/(.{3,})\1{3,}/.test(text)) return true;

  // アルファベットのランダム羅列（5文字以上の母音のない連続）
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(text.replace(/\s/g, ""))) return true;

  return false;
}

export function detectAbuse(text: string): AbuseEvent | null {
  if (!text) return null;

  // SQLインジェクション（高深刻度）
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "sql_injection",
        severity: 3,
        reason: `SQLインジェクションパターン検知: ${pattern.toString().slice(0, 40)}`,
      };
    }
  }

  // プロンプトインジェクション（高深刻度）
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "prompt_injection",
        severity: 3,
        reason: `プロンプトインジェクションパターン検知: ${pattern.toString().slice(0, 40)}`,
      };
    }
  }

  // スパム（中深刻度）
  if (detectSpam(text)) {
    return {
      type: "spam",
      severity: 2,
      reason: "無意味・スパムテキスト検知",
    };
  }

  return null;
}
