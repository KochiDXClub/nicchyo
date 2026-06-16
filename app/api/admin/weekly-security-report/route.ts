import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface PageVisitRow {
  visitor_key: string | null;
  path: string | null;
  duration_seconds: number | null;
  visit_date: string | null;
  created_at?: string | null;
}

interface ShopInteractionRow {
  visitor_key: string | null;
  shop_id: string | null;
  event_type: string | null;
  ip_address: string | null;
  created_at: string | null;
}

interface CouponImpressionRow {
  visitor_key: string | null;
  coupon_id: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string | null;
}

interface CouponIssuanceRow {
  visitor_key: string | null;
  market_date: string | null;
  issue_reason: string | null;
  created_at: string | null;
}

interface CouponRedemptionRow {
  visitor_key: string | null;
  vendor_id: string | null;
  amount_discounted: number | null;
  created_at: string | null;
}

interface AnomalyItem {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  detail: string;
}

interface WeeklyStats {
  totalVisitors: number;
  totalPageVisits: number;
  totalShopInteractions: number;
  totalCouponIssuances: number;
  totalCouponRedemptions: number;
  topPaths: Array<{ path: string; count: number }>;
  topVisitorsByPageVisit: Array<{ visitor_key: string; count: number }>;
  topVisitorsByShopInteraction: Array<{ visitor_key: string; count: number }>;
  topIpsByShopInteraction: Array<{ ip: string; count: number }>;
  couponFarmingCandidates: Array<{ visitor_key: string; issuances: number }>;
  anomalies: AnomalyItem[];
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function tokyoIsoDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function topN<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// ─── データ収集 ───────────────────────────────────────────────────────────────

async function fetchWeekData(weekStart: string, weekEnd: string) {
  const supabase = getServiceClient();

  const [pageVisits, shopInteractions, couponImpressions, couponIssuances, couponRedemptions] =
    await Promise.all([
      supabase
        .from("web_page_analytics")
        .select("visitor_key, path, duration_seconds, visit_date")
        .gte("visit_date", weekStart)
        .lte("visit_date", weekEnd)
        .limit(5000),
      supabase
        .from("shop_interactions")
        .select("visitor_key, shop_id, event_type, ip_address, created_at")
        .gte("created_at", `${weekStart}T00:00:00+09:00`)
        .lte("created_at", `${weekEnd}T23:59:59+09:00`)
        .limit(5000),
      supabase
        .from("coupon_impressions")
        .select("visitor_key, coupon_id, source, ip_address, created_at")
        .gte("created_at", `${weekStart}T00:00:00+09:00`)
        .lte("created_at", `${weekEnd}T23:59:59+09:00`)
        .limit(5000),
      supabase
        .from("coupon_issuances")
        .select("visitor_key, market_date, issue_reason, created_at")
        .gte("created_at", `${weekStart}T00:00:00+09:00`)
        .lte("created_at", `${weekEnd}T23:59:59+09:00`)
        .limit(2000),
      supabase
        .from("coupon_redemption_logs")
        .select("visitor_key, vendor_id, amount_discounted, created_at")
        .gte("created_at", `${weekStart}T00:00:00+09:00`)
        .lte("created_at", `${weekEnd}T23:59:59+09:00`)
        .limit(2000),
    ]);

  return {
    pageVisits: (pageVisits.data ?? []) as PageVisitRow[],
    shopInteractions: (shopInteractions.data ?? []) as ShopInteractionRow[],
    couponImpressions: (couponImpressions.data ?? []) as CouponImpressionRow[],
    couponIssuances: (couponIssuances.data ?? []) as CouponIssuanceRow[],
    couponRedemptions: (couponRedemptions.data ?? []) as CouponRedemptionRow[],
  };
}

// ─── 統計解析 ─────────────────────────────────────────────────────────────────

function analyzeData(data: Awaited<ReturnType<typeof fetchWeekData>>): WeeklyStats {
  const { pageVisits, shopInteractions, couponImpressions, couponIssuances, couponRedemptions } = data;

  // ページ別カウント
  const pathCount = countBy(pageVisits, (r) => r.path);
  const visitorPageCount = countBy(pageVisits, (r) => r.visitor_key);
  const visitorShopCount = countBy(shopInteractions, (r) => r.visitor_key);
  const ipShopCount = countBy(shopInteractions, (r) => r.ip_address);
  const visitorCouponIssuanceCount = countBy(couponIssuances, (r) => r.visitor_key);

  const totalVisitors = new Set(pageVisits.map((r) => r.visitor_key).filter(Boolean)).size;

  // クーポン集計（同一visitor_keyが3枚以上は要注目）
  const couponFarmingCandidates = topN(visitorCouponIssuanceCount, 10)
    .filter(([, count]) => count >= 3)
    .map(([visitor_key, issuances]) => ({ visitor_key: `${visitor_key}`, issuances }));

  const anomalies: AnomalyItem[] = [];

  // 異常1: ページ過多アクセス（1週間で200ページ以上）
  for (const [vk, count] of topN(visitorPageCount, 5)) {
    if (count >= 200) {
      anomalies.push({
        type: "high_page_access",
        severity: count >= 500 ? "high" : "medium",
        description: "異常なページアクセス頻度",
        detail: `visitor_key ${vk.slice(0, 12)}... が ${count} ページにアクセス`,
      });
    }
  }

  // 異常2: 同一IPからの大量ショップ操作（1週間で500以上）
  for (const [ip, count] of topN(ipShopCount, 5)) {
    if (count >= 500) {
      anomalies.push({
        type: "high_ip_shop_interaction",
        severity: count >= 1000 ? "high" : "medium",
        description: "同一IPからの大量ショップ操作",
        detail: `IP ${ip} から ${count} 回のショップ操作`,
      });
    }
  }

  // 異常3: クーポン大量取得
  if (couponFarmingCandidates.length > 0) {
    for (const { visitor_key, issuances } of couponFarmingCandidates.slice(0, 3)) {
      anomalies.push({
        type: "coupon_farming",
        severity: issuances >= 5 ? "high" : "medium",
        description: "クーポン大量取得の疑い",
        detail: `visitor_key ${visitor_key.slice(0, 12)}... が ${issuances} 枚のクーポンを取得`,
      });
    }
  }

  // 異常4: /admin や /api へのアクセス試行（クライアントから）
  const suspiciousPaths = pageVisits.filter(
    (r) => r.path && (r.path.startsWith("/admin") || r.path.includes("../") || r.path.includes("..\\"))
  );
  if (suspiciousPaths.length > 0) {
    anomalies.push({
      type: "suspicious_path_access",
      severity: "high",
      description: "不審なパスへのアクセス試行",
      detail: `${suspiciousPaths.length} 件の不審なパスアクセス`,
    });
  }

  // 異常5: クーポン印象数に比べて換金率が異常に高い
  const impressionVisitors = new Set(couponImpressions.map((r) => r.visitor_key).filter(Boolean));
  const redemptionVisitors = new Set(couponRedemptions.map((r) => r.visitor_key).filter(Boolean));
  const suspiciousRedemptions = [...redemptionVisitors].filter((v) => !impressionVisitors.has(v));
  if (suspiciousRedemptions.length > 5) {
    anomalies.push({
      type: "redemption_without_impression",
      severity: "medium",
      description: "クーポン表示ログなしでの換金",
      detail: `${suspiciousRedemptions.length} 件のインプレッションなし換金`,
    });
  }

  return {
    totalVisitors,
    totalPageVisits: pageVisits.length,
    totalShopInteractions: shopInteractions.length,
    totalCouponIssuances: couponIssuances.length,
    totalCouponRedemptions: couponRedemptions.length,
    topPaths: topN(pathCount, 10).map(([path, count]) => ({ path: `${path}`, count })),
    topVisitorsByPageVisit: topN(visitorPageCount, 5).map(([v, count]) => ({
      visitor_key: `${v}`.slice(0, 16) + "...",
      count,
    })),
    topVisitorsByShopInteraction: topN(visitorShopCount, 5).map(([v, count]) => ({
      visitor_key: `${v}`.slice(0, 16) + "...",
      count,
    })),
    topIpsByShopInteraction: topN(ipShopCount, 5).map(([ip, count]) => ({
      ip: `${ip}`,
      count,
    })),
    couponFarmingCandidates,
    anomalies,
  };
}

// ─── Claude分析 ───────────────────────────────────────────────────────────────

async function analyzeWithClaude(stats: WeeklyStats, weekStart: string, weekEnd: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "（Claude APIキー未設定のため分析スキップ）";

  const client = new Anthropic({ apiKey });

  const prompt = `
あなたはWebアプリケーションのセキュリティアナリストです。
以下は日本の観光プラットフォーム「nicchyo（高知・日曜市案内）」の週次アクセスデータです。
${weekStart} ～ ${weekEnd} の集計結果を分析し、200字以内の日本語サマリーを返してください。

## 統計
- 週間ユニーク訪問者: ${stats.totalVisitors}人
- ページ閲覧数: ${stats.totalPageVisits}件
- ショップ操作: ${stats.totalShopInteractions}件
- クーポン発行: ${stats.totalCouponIssuances}件
- クーポン換金: ${stats.totalCouponRedemptions}件

## 検出された異常（${stats.anomalies.length}件）
${stats.anomalies.map((a) => `- [${a.severity.toUpperCase()}] ${a.description}: ${a.detail}`).join("\n") || "なし"}

## 指示
- リスクの全体評価（low/medium/high/critical）を最初に角括弧で示す
- 主な懸念点と推奨アクションを簡潔に記述
- 問題がなければ「今週は正常な利用パターンでした」と記述
`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

// ─── HTMLレポート生成 ─────────────────────────────────────────────────────────

function riskColor(level: string): string {
  return { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", critical: "#7c3aed" }[level] ?? "#6b7280";
}

function riskLabel(level: string): string {
  return { low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL" }[level] ?? level.toUpperCase();
}

function generateHtml(
  stats: WeeklyStats,
  summary: string,
  riskLevel: string,
  weekStart: string,
  weekEnd: string,
  reportDate: string
): string {
  const color = riskColor(riskLevel);
  const anomalyRows = stats.anomalies
    .map(
      (a) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;
            background:${a.severity === "high" ? "#fef2f2" : a.severity === "medium" ? "#fffbeb" : "#f0fdf4"};
            color:${a.severity === "high" ? "#dc2626" : a.severity === "medium" ? "#d97706" : "#16a34a"};">
            ${escapeHtml(a.severity.toUpperCase())}
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;">${escapeHtml(a.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${escapeHtml(a.detail)}</td>
      </tr>`
    )
    .join("");

  const pathRows = stats.topPaths
    .map(
      ({ path, count }) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:13px;color:#374151;">${escapeHtml(path)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280;">${count.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>nicchyo セキュリティレポート ${reportDate}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
  <div style="max-width:860px;margin:0 auto;padding:40px 24px;">

    <!-- ヘッダー -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px;">
      <div>
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.15em;color:#9ca3af;">NICCHYO SECURITY REPORT</p>
        <h1 style="margin:6px 0 0;font-size:26px;font-weight:800;color:#111827;">週次セキュリティレポート</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">対象期間: ${weekStart} ～ ${weekEnd}　／　生成日: ${reportDate}</p>
      </div>
      <div style="text-align:center;background:${color}15;border:2px solid ${color};border-radius:12px;padding:14px 24px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${color};">リスクレベル</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:${color};">${riskLabel(riskLevel)}</p>
      </div>
    </div>

    <!-- AI サマリー -->
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">AI分析サマリー</h2>
      <p style="margin:0;font-size:15px;line-height:1.8;color:#374151;white-space:pre-wrap;">${escapeHtml(summary)}</p>
    </div>

    <!-- 統計カード -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px;">
      ${[
        ["訪問者数", stats.totalVisitors, "#3b82f6"],
        ["ページ閲覧", stats.totalPageVisits, "#8b5cf6"],
        ["ショップ操作", stats.totalShopInteractions, "#ec4899"],
        ["クーポン発行", stats.totalCouponIssuances, "#f59e0b"],
        ["クーポン換金", stats.totalCouponRedemptions, "#10b981"],
        ["異常検知", stats.anomalies.length, stats.anomalies.length > 0 ? "#ef4444" : "#22c55e"],
      ]
        .map(
          ([label, value, c]) => `
      <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <p style="margin:0;font-size:12px;color:#9ca3af;font-weight:600;">${label}</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:${c};">${Number(value).toLocaleString()}</p>
      </div>`
        )
        .join("")}
    </div>

    <!-- 異常一覧 -->
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">
        検出された異常 (${stats.anomalies.length}件)
      </h2>
      ${
        stats.anomalies.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">重要度</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">種別</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">詳細</th>
            </tr>
          </thead>
          <tbody>${anomalyRows}</tbody>
        </table>`
          : `<p style="margin:0;color:#6b7280;font-size:14px;">今週は異常は検出されませんでした。</p>`
      }
    </div>

    <!-- アクセスパス上位 -->
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">アクセスパス上位10</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">パス</th>
            <th style="padding:6px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">閲覧数</th>
          </tr>
        </thead>
        <tbody>${pathRows}</tbody>
      </table>
    </div>

    <p style="margin:32px 0 0;text-align:center;font-size:12px;color:#9ca3af;">
      Generated by nicchyo security-report system ・ ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;
}

// ─── Discord通知 ──────────────────────────────────────────────────────────────

async function sendDiscordNotification(
  stats: WeeklyStats,
  summary: string,
  riskLevel: string,
  weekStart: string,
  weekEnd: string,
  reportDate: string
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  // VERCEL_PROJECT_PRODUCTION_URL はVercelが自動設定する本番ドメイン（設定不要）
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : null);
  const reportUrl = appUrl ? `${appUrl}/reports/${reportDate}` : null;

  const colorMap: Record<string, number> = {
    low: 0x22c55e,
    medium: 0xf59e0b,
    high: 0xef4444,
    critical: 0x7c3aed,
  };
  const embedColor = colorMap[riskLevel] ?? 0x6b7280;

  const fields = [
    { name: "対象期間", value: `${weekStart} ～ ${weekEnd}`, inline: true },
    { name: "リスクレベル", value: `**${riskLevel.toUpperCase()}**`, inline: true },
    { name: "異常検知", value: `${stats.anomalies.length}件`, inline: true },
    { name: "訪問者数", value: `${stats.totalVisitors.toLocaleString()}人`, inline: true },
    { name: "ページ閲覧", value: `${stats.totalPageVisits.toLocaleString()}件`, inline: true },
    { name: "クーポン発行/換金", value: `${stats.totalCouponIssuances}/${stats.totalCouponRedemptions}`, inline: true },
  ];

  const description = summary.length > 300 ? summary.slice(0, 297) + "..." : summary;

  const payload = {
    embeds: [
      {
        title: "📊 nicchyo 週次セキュリティレポート",
        description,
        color: embedColor,
        fields,
        footer: { text: `生成日: ${reportDate}` },
        ...(reportUrl ? { url: reportUrl } : {}),
      },
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ─── メイン処理 ───────────────────────────────────────────────────────────────

async function runWeeklyReport(): Promise<{
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  riskLevel: string;
  anomalyCount: number;
  totalVisitors: number;
}> {
  const today = new Date();
  const reportDate = tokyoIsoDate(today);

  // 過去7日間を集計対象
  const weekEndDate = new Date(today);
  weekEndDate.setDate(weekEndDate.getDate() - 1); // 前日まで
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setDate(weekStartDate.getDate() - 6);

  const weekEnd = tokyoIsoDate(weekEndDate);
  const weekStart = tokyoIsoDate(weekStartDate);

  // データ収集
  const rawData = await fetchWeekData(weekStart, weekEnd);

  // 統計解析
  const stats = analyzeData(rawData);

  // リスクレベル判定
  const highCount = stats.anomalies.filter((a) => a.severity === "high").length;
  const mediumCount = stats.anomalies.filter((a) => a.severity === "medium").length;
  const riskLevel =
    highCount >= 3 ? "critical" : highCount >= 1 ? "high" : mediumCount >= 3 ? "medium" : "low";

  // Claude分析
  const summary = await analyzeWithClaude(stats, weekStart, weekEnd);

  // HTML生成
  const html = generateHtml(stats, summary, riskLevel, weekStart, weekEnd, reportDate);

  // Supabase保存
  const supabase = getServiceClient();
  const { error } = await supabase.from("security_reports").upsert(
    {
      report_date: reportDate,
      week_start: weekStart,
      week_end: weekEnd,
      html_content: html,
      summary,
      risk_level: riskLevel,
      anomaly_count: stats.anomalies.length,
      total_page_visits: stats.totalPageVisits,
      total_visitors: stats.totalVisitors,
      total_coupon_actions: stats.totalCouponIssuances + stats.totalCouponRedemptions,
    },
    { onConflict: "report_date" }
  );

  if (error) throw new Error(`DB upsert error: ${error.message}`);

  // Discord通知
  await sendDiscordNotification(stats, summary, riskLevel, weekStart, weekEnd, reportDate);

  return {
    reportDate,
    weekStart,
    weekEnd,
    riskLevel,
    anomalyCount: stats.anomalies.length,
    totalVisitors: stats.totalVisitors,
  };
}

// ─── ルートハンドラー ─────────────────────────────────────────────────────────

function checkAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  const authHeader = req.headers.get("authorization");
  return authHeader?.replace("Bearer ", "") === cronSecret;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runWeeklyReport();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[weekly-security-report]", message);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runWeeklyReport();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[weekly-security-report]", message);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
