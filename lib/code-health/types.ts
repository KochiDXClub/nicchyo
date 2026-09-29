// scripts/code-health/analyze.mjs の analyze() が返す形と、Supabase の
// code_health_snapshots テーブルに保存する形（scripts/code-health/save.mjs）に対応する型。

export interface RoleOrKindTotal {
  files: number;
  lines: number;
}

export interface RuleFileHit {
  path: string;
  count: number;
}

export interface RuleSummary {
  value: number;
  matches: number;
  fileCount: number;
  files: RuleFileHit[];
}

export interface CloneBlock {
  a: { path: string; start: number; end: number };
  b: { path: string; start: number; end: number };
  lines: number;
}

export interface SameNameGroup {
  name: string;
  paths: string[];
}

export interface LargeFile {
  path: string;
  lines: number;
  role: string;
}

/** code_health_snapshots.summary の中身 */
export interface SnapshotSummary {
  label: string;
  generatedAt: string;
  totals: {
    files: number;
    lines: number;
    productLines: number;
    sharedLines: number;
    duplicatedLines: number;
    significantLines: number;
    byKind: Record<string, RoleOrKindTotal>;
    byRole: Record<string, RoleOrKindTotal>;
  };
  metrics: Record<string, number>;
  rules: Record<string, RuleSummary>;
  clones: CloneBlock[];
  sameName: SameNameGroup[];
  largeFiles: LargeFile[];
}

/** code_health_snapshots.files の1要素 */
export interface SnapshotFile {
  path: string;
  kind: string;
  role: string;
  area: string;
  lines: number;
  dupLines: number;
  dupRatio: number;
  violations: number;
}

// テーブル1行分の型（CodeHealthSnapshotRow）は types/database.extensions.ts にある
// （Supabase クライアントの型付けとして使うため、DatabaseWithExtensions 側で定義する）
