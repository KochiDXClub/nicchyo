/**
 * /admin/settings で設定するマップ編集の上限の既定値（system_settings の key="map" が無いとき）。
 * 設定画面・設定 API・マップ編集 API・マップ編集画面の4か所が同じ値を使うよう、ここに1本化する。
 */
export const DEFAULT_MAX_LANDMARKS = 80;

/**
 * 空き区画（出店者のいない区画）の上限。区画分けツールで道に空き区画をまとめて
 * 作るため、全区画ぶん（店番の上限と同程度）まで置けるようにしている。
 */
export const DEFAULT_MAX_UNASSIGNED_SHOP_MARKERS = 300;
