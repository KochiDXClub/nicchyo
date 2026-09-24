// 2つの集計結果（before / after）を比べ、何が良くなり何が悪くなったかをまとめる。

import { METRICS, RULES } from "./rules.mjs";

// 全体のコピペ行がこれ以上増えたら「悪化」とみなす（1つの塊の最小単位）
const DUP_LINES_TOLERANCE = 8;

function direction(better, before, after) {
  if (after === before) return "same";
  const improved = better === "lower" ? after < before : after > before;
  return improved ? "better" : "worse";
}

export function diffReports(before, after) {
  const metrics = METRICS.map((m) => {
    const b = before.metrics[m.id];
    const a = after.metrics[m.id];
    return { id: m.id, label: m.label, unit: m.unit, target: m.target, better: m.better, before: b, after: a, change: direction(m.better, b, a) };
  });

  const rules = RULES.map((r) => {
    const b = before.rules[r.id].value;
    const a = after.rules[r.id].value;
    return { id: r.id, label: r.label, before: b, after: a, change: direction("lower", b, a) };
  });

  const beforeFiles = new Map(before.files.map((f) => [f.path, f]));
  const afterFiles = new Map(after.files.map((f) => [f.path, f]));
  const changedFiles = [];
  for (const f of after.files) {
    const prev = beforeFiles.get(f.path);
    if (!prev) changedFiles.push({ path: f.path, status: "added" });
    else if (prev.hash !== f.hash) changedFiles.push({ path: f.path, status: "modified" });
  }
  for (const f of before.files) {
    if (!afterFiles.has(f.path)) changedFiles.push({ path: f.path, status: "deleted" });
  }

  // 変更したファイルの中で、ルールに当たる数が増えたもの
  const ruleRegressions = [];
  for (const { path } of changedFiles) {
    const a = afterFiles.get(path);
    if (!a) continue;
    const b = beforeFiles.get(path);
    for (const rule of RULES) {
      const nowHit = a.ruleHits[rule.id];
      if (!nowHit) continue;
      const prevHit = b?.ruleHits[rule.id];
      const prevCount = prevHit?.count ?? 0;
      if (nowHit.count <= prevCount) continue;
      const prevValues = new Set(prevHit?.values ?? []);
      ruleRegressions.push({
        rule: rule.id,
        label: rule.label,
        path,
        before: prevCount,
        after: nowHit.count,
        newValues: nowHit.values.filter((v) => !prevValues.has(v)).slice(0, 5),
      });
    }
  }

  // 変更したファイルで増えたコピペと、その相手
  const changedSet = new Set(changedFiles.map((f) => f.path));
  const duplicationRegressions = [];
  for (const path of changedSet) {
    const a = afterFiles.get(path);
    if (!a) continue;
    const prevDup = beforeFiles.get(path)?.dupLines ?? 0;
    if (a.dupLines <= prevDup) continue;
    const partners = after.clones
      .filter((c) => c.a.path === path || c.b.path === path)
      .slice(0, 5)
      .map((c) => (c.a.path === path ? { self: c.a, other: c.b, lines: c.lines } : { self: c.b, other: c.a, lines: c.lines }));
    duplicationRegressions.push({ path, before: prevDup, after: a.dupLines, partners });
  }
  duplicationRegressions.sort((x, y) => y.after - y.before - (x.after - x.before));

  const dupDelta = after.totals.duplicatedLines - before.totals.duplicatedLines;
  const lineDelta = after.totals.lines - before.totals.lines;
  const worsenedRules = rules.filter((r) => r.change === "worse");
  const failed = worsenedRules.length > 0 || dupDelta >= DUP_LINES_TOLERANCE;

  return {
    before: { label: before.label, lines: before.totals.lines },
    after: { label: after.label, lines: after.totals.lines },
    lineDelta,
    dupDelta,
    metrics,
    rules,
    changedFiles,
    ruleRegressions,
    duplicationRegressions,
    failed,
  };
}

function fmt(v, unit = "") {
  return `${v}${unit === "%" ? "%" : ""}`;
}

function mark(change) {
  return change === "better" ? "✅ 改善" : change === "worse" ? "⚠️ 悪化" : "➖";
}

function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

function targetText(m) {
  const value = `${m.target}${m.unit}`;
  if (m.target === 0 && m.better === "lower") return value;
  return `${value}${m.better === "lower" ? "以下" : "以上"}`;
}

// 表に必ず出す指標（第三者が「共通化が進んだか」を一目で読めるもの）
const HEADLINE_METRICS = new Set(["sharedRatio", "duplicationRatio"]);

/**
 * PR 本文の「共通基盤チェック」欄に貼る Markdown。
 * 結論1行 → 主要指標と変化した項目だけの表 → 悪化した箇所 → 理由欄、の順で、
 * 全項目と比較の条件は折りたたみに入れる。
 * @param {{ heading?: boolean }} options heading: 見出しを付ける（CI のサマリー用）
 */
export function diffToMarkdown(diff, options = {}) {
  const lines = [];
  if (options.heading) lines.push("## 共通基盤チェック", "");

  const itemCount = diff.metrics.length + diff.rules.length;
  const places = diff.ruleRegressions.length + diff.duplicationRegressions.length;
  const improved = [...diff.metrics, ...diff.rules].filter((m) => m.change === "better").length;
  if (diff.failed) {
    lines.push(`⚠️ **悪化あり（${places}か所）** — 共通化・コピペ・デザインのルール ${itemCount} 項目で比較`);
  } else {
    const extra = improved > 0 ? `、${improved}項目が改善` : "";
    lines.push(`✅ **悪化なし**${extra} — 共通化・コピペ・デザインのルール ${itemCount} 項目で比較`);
  }
  lines.push("");

  const rows = [
    ...diff.metrics.filter((m) => HEADLINE_METRICS.has(m.id) || m.change !== "same").map((m) => ({ ...m, targetLabel: targetText(m) })),
    ...diff.rules.filter((r) => r.change !== "same").map((r) => ({ ...r, unit: "", targetLabel: "減らす" })),
  ];
  lines.push("| 項目 | 目標 | 変更前 → 変更後 | |");
  lines.push("|---|---|---|---|");
  for (const m of rows) {
    lines.push(`| ${m.label} | ${m.targetLabel} | ${fmt(m.before, m.unit)} → ${fmt(m.after, m.unit)} | ${mark(m.change)} |`);
  }

  if (places > 0) {
    lines.push("", "**悪化した箇所**");
    for (const r of diff.ruleRegressions) {
      const values = r.newValues.length > 0 ? `（${r.newValues.map((v) => `\`${v}\``).join(", ")}）` : "";
      lines.push(`- \`${r.path}\`：${r.label} ${r.before} → ${r.after}${values}`);
    }
    for (const d of diff.duplicationRegressions.slice(0, 10)) {
      const [first, ...rest] = d.partners;
      const partner = first
        ? `（L${first.self.start}-${first.self.end} が \`${first.other.path}\` L${first.other.start}-${first.other.end} と同じ${rest.length ? ` ほか${rest.length}か所` : ""}）`
        : "";
      lines.push(`- \`${d.path}\`：コピペ ${d.before} → ${d.after} 行${partner}`);
    }
  }
  if (diff.failed) {
    lines.push("", "**悪化を残す理由・今後の対応**：<!-- 直さずにマージする場合は、ここに理由を書く -->");
  }

  lines.push("", "<details><summary>全項目・比較条件</summary>", "");
  lines.push(`${diff.before.label} → ${diff.after.label} ／ 変更ファイル ${diff.changedFiles.length} 件 ／ 行数 ${signed(diff.lineDelta)} ／ コピペ行 ${signed(diff.dupDelta)}`);
  lines.push("", "| 項目 | 目標 | 変更前 | 変更後 | |", "|---|---|---|---|---|");
  for (const m of diff.metrics) {
    lines.push(`| ${m.label} | ${targetText(m)} | ${fmt(m.before, m.unit)} | ${fmt(m.after, m.unit)} | ${mark(m.change)} |`);
  }
  for (const r of diff.rules) {
    lines.push(`| ${r.label} | 減らす | ${r.before} | ${r.after} | ${mark(r.change)} |`);
  }
  lines.push("", "各項目の意味は `docs/CODE_HEALTH.md`。`npm run code-health:diff` で再計測できる。", "", "</details>");
  return lines.join("\n");
}
