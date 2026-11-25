# /map

マップページ（app/(public)/map/）に関するタスクを開始する前に、以下を確認してから作業に入る。

1. `app/(public)/map/config/roadConfig.ts` — 座標系の基準を確認
2. `app/(public)/map/components/maplibre/MapViewMapLibre.tsx` — 現在のレイヤー構成を確認
3. `app/(public)/map/hooks/` — 既存のカスタムフックを確認

マップの座標はすべて `roadConfig.ts` を Single Source of Truth として扱う。
ズーム最適化は `utils/zoomCalculator.ts` を参照する。
