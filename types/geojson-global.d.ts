/**
 * MapLibre 側の型（GeoJSON 名前空間）を全体で使えるようにする。
 *
 * 以前は Leaflet の型定義（@types/leaflet）が geojson を参照していたため、
 * GeoJSON 名前空間が暗黙に読み込まれていた。Leaflet を外した後も MapLibre の
 * 地図コードが GeoJSON 型を使うので、ここで明示的に読み込む。
 */
/// <reference types="geojson" />
