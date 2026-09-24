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
  return change === "better" ? "✅ 改善" : change === "worse" ? "⚠️ 悪化" : "—";
}

function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

/** PR 本文・CI のサマリー・AI の作業確認に貼る Markdown */
export function diffToMarkdown(diff) {
  const lines = [];
  lines.push(`## コード健康診断（${diff.before.label} → ${diff.after.label}）`);
  lines.push("");
  lines.push(
    diff.failed
      ? "**⚠️ 共通化・デザインのルールに対して悪化があります。下の「悪化した箇所」を直すか、理由を PR に書いてください。**"
      : "**✅ 悪化はありません。**"
  );
  lines.push("");
  lines.push(`変更ファイル ${diff.changedFiles.length} 件 / 行数 ${signed(diff.lineDelta)} / コピペ行 ${signed(diff.dupDelta)}`);
  lines.push("");
  lines.push("| 指標 | 目標 | before | after | |");
  lines.push("|---|---|---|---|---|");
  for (const m of diff.metrics) {
    const target = `${m.better === "lower" ? "≤" : "≥"} ${fmt(m.target, m.unit)}`;
    lines.push(`| ${m.label} | ${target} | ${fmt(m.before, m.unit)} | ${fmt(m.after, m.unit)} | ${mark(m.change)} |`);
  }
  for (const r of diff.rules) {
    if (r.before === 0 && r.after === 0) continue;
    lines.push(`| ${r.label} | 減らす | ${r.before} | ${r.after} | ${mark(r.change)} |`);
  }

  if (diff.ruleRegressions.length > 0) {
    lines.push("");
    lines.push("### 悪化した箇所（ルール）");
    for (const r of diff.ruleRegressions) {
      const values = r.newValues.length > 0 ? `（${r.newValues.map((v) => `\`${v}\``).join(", ")}）` : "";
      lines.push(`- \`${r.path}\` ${r.label}: ${r.before} → ${r.after}${values}`);
    }
  }
  if (diff.duplicationRegressions.length > 0) {
    lines.push("");
    lines.push("### 悪化した箇所（コピペ）");
    for (const d of diff.duplicationRegressions.slice(0, 10)) {
      lines.push(`- \`${d.path}\` コピペ行 ${d.before} → ${d.after}`);
      for (const p of d.partners) {
        lines.push(`  - L${p.self.start}-${p.self.end} ≒ \`${p.other.path}\` L${p.other.start}-${p.other.end}（${p.lines}行）`);
      }
    }
  }
  return lines.join("\n");
}
