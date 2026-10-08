/**
 * Role に応じたテーマを取得するカスタムフック
 *
 * 【使い方】
 * ```typescript
 * import { useRoleTheme } from '@/lib/theme/useRoleTheme';
 *
 * function MyComponent() {
 *   const theme = useRoleTheme();
 *
 *   return (
 *     <div className={theme.headerBg}>
 *       <h1 className={theme.headerText}>タイトル</h1>
 *     </div>
 *   );
 * }
 * ```
 *
 * 【将来の拡張】
 * - Firebase Auth 移行時も、このフックは変更不要
 * - AuthContext が返す user.role が Firebase Custom Claims から来るだけ
 */

'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { getRoleTheme, type RoleTheme } from './roleTheme';
import { useMemo } from 'react';

/**
 * ログイン中のユーザーの role に応じたテーマを取得
 *
 * @returns role に対応する RoleTheme オブジェクト
 *
 * @example
 * ```typescript
 * const theme = useRoleTheme();
 * // admin でログイン中
 * // => { headerBg: 'bg-gradient-to-r from-blue-700...', ... }
 * ```
 */
export function useRoleTheme(): RoleTheme {
  const { user } = useAuth();

  // role が変更されたときのみ再計算（パフォーマンス最適化）
  const theme = useMemo(() => {
    return getRoleTheme(user?.role);
  }, [user?.role]);

  return theme;
}

/**
 * 将来の拡張メモ
 *
 * 【ダークモード対応】
 * ```typescript
 * export function useRoleTheme(mode?: 'light' | 'dark'): RoleTheme {
 *   const { user } = useAuth();
 *   const systemMode = useSystemColorScheme(); // システム設定を取得
 *   const actualMode = mode || systemMode;
 *
 *   const theme = useMemo(() => {
 *     const baseTheme = getRoleTheme(user?.role);
 *     return actualMode === 'dark' ? baseTheme.dark : baseTheme.light;
 *   }, [user?.role, actualMode]);
 *
 *   return theme;
 * }
 * ```
 *
 * 【ユーザーカスタムテーマ】
 * ```typescript
 * export function useRoleTheme(): RoleTheme {
 *   const { user } = useAuth();
 *   const [customTheme, setCustomTheme] = useState<RoleTheme | null>(null);
 *
 *   useEffect(() => {
 *     if (user?.id) {
 *       // Firestore からユーザーのカスタムテーマを取得
 *       const userTheme = await getUserTheme(user.id);
 *       setCustomTheme(userTheme);
 *     }
 *   }, [user?.id]);
 *
 *   const theme = useMemo(() => {
 *     return customTheme || getRoleTheme(user?.role);
 *   }, [user?.role, customTheme]);
 *
 *   return theme;
 * }
 * ```
 */
