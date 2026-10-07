/**
 * グローバルの GeoJSON 名前空間（GeoJSON.Feature など）を使うための参照。
 *
 * これまでは @types/leaflet が @types/geojson を引き込んでいたため、
 * tsconfig の types を絞っていても GeoJSON の型が見えていた。
 * Leaflet の撤去後も使えるよう、ここで明示的に読み込む。
 */
/// <reference types="geojson" />
