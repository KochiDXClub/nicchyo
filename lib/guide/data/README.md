# kochi-walk-network.json

日曜市（追手筋）周辺の歩行者ネットワーク。案内エンジン（`lib/guide`）が
「必ず道の上を通る」経路を引くために使う。

- 出典: © OpenStreetMap contributors（ODbL）。Overpass API から取得し、
  `highway` が footway / path / steps / pedestrian / cycleway / crossing / residential /
  living_street / unclassified / tertiary / secondary / primary（各 link 含む）の道だけを残した
  （service と access=private/no は除外）
- 範囲: 南 33.5555 / 西 133.5285 / 北 33.5695 / 東 133.5480（追手筋を中心に約 1.5km × 1.8km）
- 形式: `{ bbox: [s, w, n, e], nodes: [[lat, lng], ...], ways: [[name, kind, [nodeIndex, ...]], ...] }`
  - `kind` は `path`（歩道・小道・階段）か `street`（車道）
  - 交差点は同じ nodeIndex を共有することで表現する
- 更新: 取得スクリプトは `scripts/` に無い（Overpass の問い合わせと圧縮は
  セッション内の一時スクリプトで行った）。更新時は同じ条件で取得し直し、
  6桁に丸めた座標で保存する

範囲の外にいる人は、いちばん近い道まで直線でつないでから道の上を歩く経路になる。
