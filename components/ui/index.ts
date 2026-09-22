/**
 * 共通UIの入口。新しく画面を書くときは、まずここに欲しいものがあるか見る。
 * 無ければ足す。ページの中に同じものを作らない（docs/DESIGN_SYSTEM.md）。
 *
 * ここに置くのはサーバー・クライアントどちらからでも読めるものだけにする。
 * フックや window を使うものを混ぜると、サーバーコンポーネントから読んだ側が壊れる。
 */
export { Button, buttonClass, type ButtonProps } from "./button";
export { Surface, type SurfaceProps } from "./surface";
export { Badge, type BadgeProps } from "./badge";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { EmptyMessage } from "./empty-message";
export { PageShell, PageContainer, PageHeader, type PageWidth } from "./page-shell";
export { LoadingSpinner, CenteredLoading } from "./loading-spinner";
