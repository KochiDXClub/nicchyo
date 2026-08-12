/**
 * マップ編集画面（/admin/map-edit）で扱う区画の編集用データ型。
 * サーバー側（app/api/admin/map-layout/_shared.ts）とクライアント側
 * （app/(public)/map-edit/v3/types.ts）の両方から参照する共通定義。
 */
export type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
  chome?: string;
};
