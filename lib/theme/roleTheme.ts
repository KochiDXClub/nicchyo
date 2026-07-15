/**
 * Role ベースのUIテーマ定義
 *
 * 【設計方針】
 * - role ごとに異なる配色を適用し、視覚的に役割を区別
 * - コンポーネント内で role を直接判定せず、このファイルで集中管理
 * - 将来 role が増えても、ここに追加するだけで対応可能
 *
 * 【色の選定基準】
 * - super_admin: 赤系 → 公的管理者、落ち着いた赤（警告色にならないようトーン調整）
 * - vendor: 青系 → 信頼感と親しみやすさの両立、派手すぎない青
 * - general_user: アンバー系 → デフォルトテーマ（未ログイン時と同じ）
 * - default（未ログイン）: アンバー系 → プロジェクトのデフォルトカラー
 *
 * 【アクセシビリティ】
 * - 白文字とのコントラスト比を確保（WCAG AA 準拠）
 * - 色覚多様性を考慮し、明度差を確保
 */

import type { UserRole } from '@/lib/auth/types';

/**
 * Role テーマの型定義
 */
export interface RoleTheme {
  /** ヘッダーの背景グラデーション（Tailwind クラス） */
  headerBg: string;

  /** ヘッダーの文字色（Tailwind クラス） */
  headerText: string;

  /** アクセントカラー（ボタンやバッジなど） */
  accent: {
    /** 背景色 */
    bg: string;
    /** 文字色 */
    text: string;
    /** ホバー時の背景色 */
    hoverBg: string;
  };

  /** テーマの説明（デバッグ用） */
  description: string;
}

/**
 * Role ごとのテーマ定義
 *
 * 【将来の拡張】
 * role が増えた場合は、この定義に追加するだけで自動的に反映される
 */
export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  /**
   * スーパー管理者テーマ（高知市・高専）
   * - 赤系のグラデーション（落ち着いたトーン）
   * - 公的管理者であることが直感的に分かる
   * - 警告色にならないよう rose を混ぜて柔らかく調整
   */
  super_admin: {
    headerBg: 'bg-gradient-to-r from-red-700 via-rose-600 to-red-700',
    headerText: 'text-white',
    accent: {
      bg: 'bg-red-600',
      text: 'text-white',
      hoverBg: 'hover:bg-red-700',
    },
    description: '管理者テーマ（赤系・公的管理者）',
  },

  admin: {
    headerBg: 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600',
    headerText: 'text-white',
    accent: {
      bg: 'bg-red-500',
      text: 'text-white',
      hoverBg: 'hover:bg-red-600',
    },
    description: '管理者テーマ（赤系・admin）',
  },

  /**
   * 出店者テーマ
   * - 青系のグラデーション（派手すぎない、親しみやすいトーン）
   * - 信頼感と親しみやすさを両立
   * - マップ全体の配色・可読性とのバランスを考慮
   * - sky を混ぜて明るく爽やかな印象に
   */
  vendor: {
    headerBg: 'bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600',
    headerText: 'text-white',
    accent: {
      bg: 'bg-blue-600',
      text: 'text-white',
      hoverBg: 'hover:bg-blue-700',
    },
    description: '出店者テーマ（青系・信頼感と親しみやすさ）',
  },

  /**
   * 一般ユーザーテーマ（観光客・市民、未ログイン）
   * - アンバー・オレンジ系のグラデーション
   * - デフォルトテーマと同じ配色を使用
   * - プロジェクトの標準カラーを維持
   * - 日曜市の暖かい雰囲気を表現
   */
  general_user: {
    headerBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600',
    headerText: 'text-white',
    accent: {
      bg: 'bg-amber-600',
      text: 'text-white',
      hoverBg: 'hover:bg-amber-700',
    },
    description: '一般ユーザーテーマ（アンバー系・デフォルト）',
  },

  /**
   * モデレーターテーマ
   * - パープル系のグラデーション
   * - コンテンツ管理者としての役割を表現
   * - 管理者とは区別される柔らかい印象
   */
  moderator: {
    headerBg: 'bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700',
    headerText: 'text-white',
    accent: {
      bg: 'bg-purple-600',
      text: 'text-white',
      hoverBg: 'hover:bg-purple-700',
    },
    description: 'モデレーターテーマ（パープル系・コンテンツ管理）',
  },
};

/**
 * デフォルトテーマ（未ログイン時）
 * - プロジェクトのデフォルトカラー（アンバー系）を使用
 */
export const DEFAULT_THEME: RoleTheme = {
  headerBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600',
  headerText: 'text-white',
  accent: {
    bg: 'bg-amber-600',
    text: 'text-white',
    hoverBg: 'hover:bg-amber-700',
  },
  description: 'デフォルトテーマ（未ログイン）',
};

/**
 * Role に応じたテーマを取得する
 *
 * @param role - ユーザーの役割（null の場合はデフォルトテーマ）
 * @returns 該当するテーマ設定
 *
 * @example
 * ```typescript
 * const theme = getRoleTheme('super_admin');
 * // => { headerBg: 'bg-gradient-to-r from-blue-700...', ... }
 * ```
 */
export function getRoleTheme(role: UserRole | null | undefined): RoleTheme {
  if (!role) {
    return DEFAULT_THEME;
  }

  return ROLE_THEMES[role] || DEFAULT_THEME;
}

/**
 * 将来の拡張メモ
 *
 * 【新しい role を追加する場合】
 * 1. lib/auth/types.ts の UserRole 型に新しい role を追加
 * 2. ROLE_THEMES に新しい role のテーマ定義を追加
 * 3. それだけで自動的に全体に反映される
 *
 * 【Firebase Auth 移行時】
 * - このファイルは変更不要
 * - AuthContext から取得する user.role がFirebase Custom Claims から来るようになるだけ
 *
 * 【ダークモード対応する場合】
 * - RoleTheme に light / dark の定義を追加
 * - useRoleTheme フックでシステム設定を考慮
 *
 * 【カスタムテーマを許可する場合】
 * - Firestore に user ごとのテーマ設定を保存
 * - getRoleTheme() でユーザー設定を優先する
 */
