import { CalendarDays, History, MapPinned, Search } from "lucide-react";
import type { MapSettingsLimits } from "../useMapEditData";

export function MapEditHeader({ search, onSearchChange, occupiedCount, vacantCount, roadCount, landmarkCount, limits, onToggleHistory, hasUnsavedChanges, isSaving, pendingCount, onSave, saveBlocked = false }: {
  search: string; onSearchChange: (value: string) => void;
  occupiedCount: number; vacantCount: number; roadCount: number; landmarkCount: number;
  limits: MapSettingsLimits; onToggleHistory: () => void;
  hasUnsavedChanges: boolean; isSaving: boolean; pendingCount: number; onSave: () => void; saveBlocked?: boolean;
}) {
  return <header className="map-editor-header">
    <div className="map-editor-brand"><span className="map-editor-brand-icon"><MapPinned size={20} /></span><div><span className="map-editor-eyebrow">NICCHYO / ADMIN</span><h1>マップ編集</h1></div></div>
    <div className="map-editor-search"><Search size={17} aria-hidden="true" /><input aria-label="地図を検索" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="店番・店名・道・建物を検索" /></div>
    <div className="map-editor-header-actions">
      <a href="/admin/market-schedule" aria-label="出店予定管理を開く"><CalendarDays size={16} aria-hidden="true" /><span>出店予定</span></a>
      <button type="button" aria-label="保存履歴" onClick={onToggleHistory}><History size={16} aria-hidden="true" /><span>保存履歴</span></button>
      <button type="button" className="map-editor-save" onClick={onSave} disabled={saveBlocked || isSaving || !hasUnsavedChanges} title={saveBlocked ? "データベースの更新待ちです" : undefined}>{saveBlocked ? "DB更新待ち" : isSaving ? "保存中…" : hasUnsavedChanges ? `変更を保存 ${pendingCount}` : "保存済み"}</button>
    </div>
    <div className="map-editor-stats" aria-label="地図の登録状況"><span><b>{occupiedCount}</b> 出店</span><span title={`空き区画の上限 ${limits.maxUnassignedShopMarkers}`}><b>{vacantCount}</b> 空き</span><span><b>{roadCount}</b> 道</span><span title={`建物の上限 ${limits.maxLandmarks}`}><b>{landmarkCount}</b> 建物</span><span className="map-editor-stats-note">{hasUnsavedChanges ? `未保存の操作 ${pendingCount} 件` : "変更は保存されています"}</span></div>
  </header>;
}
