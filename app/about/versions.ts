/**
 * バージョン履歴
 *
 * nicchyo は develop ブランチで開発を進め、リリースのタイミングで
 * main ブランチへ「verX.Y: <概要> / Develop (#PR番号)」という
 * コミットメッセージでまとめてマージしています。
 *
 * この配列は、その各リリースで「来訪者から見て何が変わったか」を
 * 人の手で短くまとめたものです。開発の詳細な変更点はコミット本文に
 * 残っているため、ここには来訪者向けの要約のみを追記してください。
 *
 * 新しいバージョンをリリースしたら、配列の先頭に追記します。
 *
 * リリースをいつ・どうやって行うかは docs/RELEASE.md に定めています。
 */

export type VersionEntry = {
  /** 例: "v1.3" */
  version: string;
  /** リリース日（YYYY-MM-DD） */
  date: string;
  /** マージコミットのタイトルにある概要 */
  title: string;
  /** 来訪者向けに要約した変更点（3〜5件程度） */
  highlights: string[];
  /** main へのマージに含まれる develop 側の代表PR番号（任意） */
  prNumber?: number;
};

export const versionHistory: VersionEntry[] = [
  {
    version: "v1.3",
    date: "2026-05-19",
    title: "セキュリティ強化・パフォーマンス改善・技術的負債解消",
    highlights: [
      "マップの道路・丁目エリアマーカー表示とズーム操作を改善",
      "ショップバナーを刷新し、ことづて・AI相談をバナー内から直接開けるように",
      "nicchyo について紹介するページ（このページ）を整備",
    ],
    prNumber: 278,
  },
  {
    version: "v1.2",
    date: "2026-05-14",
    title: "デザインシステム移行・UI刷新・技術的負債解消・型安全性向上",
    highlights: [
      "AI相談の会話品質と提案カードの使い勝手を改善",
      "出店者向け「マイ店舗」ページに使い方ガイドを追加",
      "検索・ショップバナーの表示を整理",
    ],
    prNumber: 255,
  },
];

export const currentVersion: VersionEntry = versionHistory[0];
