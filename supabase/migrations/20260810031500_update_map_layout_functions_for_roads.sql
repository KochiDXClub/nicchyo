-- map_roads 追加に伴い、既存の map-layout 用トランザクション関数を更新する。
-- CREATE OR REPLACE で既存関数を差し替える（20260515000001 で作成したものは編集しない）。

-- ─── replace_map_route_points ────────────────────────────────────────────
-- road_id を保持したまま全件削除→再挿入する
CREATE OR REPLACE FUNCTION replace_map_route_points(p_points jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM map_route_points;

  -- branch_from_id は自己参照 FK のため、まず branch_from_id なしで挿入してから UPDATE する
  IF p_points IS NOT NULL AND jsonb_array_length(p_points) > 0 THEN
    INSERT INTO map_route_points (id, latitude, longitude, sort_order, road_id)
    SELECT
      elem->>'id',
      (elem->>'latitude')::double precision,
      (elem->>'longitude')::double precision,
      (elem->>'sort_order')::integer,
      elem->>'road_id'
    FROM jsonb_array_elements(p_points) AS elem;

    UPDATE map_route_points rp
    SET branch_from_id = elem->>'branch_from_id'
    FROM jsonb_array_elements(p_points) AS elem
    WHERE rp.id = elem->>'id'
      AND (elem->>'branch_from_id') IS NOT NULL
      AND (elem->>'branch_from_id') <> '';
  END IF;
END;
$$;

-- ─── restore_map_layout_snapshot ─────────────────────────────────────────
-- p_roads を追加し、map_roads の復元にも対応する。
-- Postgresは引数の数が異なる関数を別オーバーロードとして扱うため、
-- CREATE OR REPLACE だけでは 20260515000001 で作成した4引数版が残ってしまう
-- （p_roads省略で呼び出すと道路非対応の古いロジックが実行されてしまう）。
-- 5引数版に一本化するため、明示的に旧シグネチャを削除する。
DROP FUNCTION IF EXISTS restore_map_layout_snapshot(jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION restore_map_layout_snapshot(
  p_shops        jsonb,
  p_landmarks    jsonb,
  p_route_points jsonb,
  p_route_config jsonb,
  p_roads        jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today text := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD');
BEGIN
  -- ① market_locations を upsert（スナップショット内容で更新。district（丁目）も
  -- 含めないと、緯度経度・店番だけ戻って丁目だけ現在値のままという不完全な復元になる）
  IF p_shops IS NOT NULL AND jsonb_array_length(p_shops) > 0 THEN
    INSERT INTO market_locations (id, store_number, latitude, longitude, district)
    SELECT
      elem->>'locationId',
      (elem->>'position')::integer,
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      elem->>'chome'
    FROM jsonb_array_elements(p_shops) AS elem
    ON CONFLICT (id) DO UPDATE SET
      store_number = EXCLUDED.store_number,
      latitude     = EXCLUDED.latitude,
      longitude    = EXCLUDED.longitude,
      district     = EXCLUDED.district;
  END IF;

  -- ② location_assignments を全クリア（現在の全 location に紐づくもの）
  DELETE FROM location_assignments
  WHERE location_id IN (SELECT id FROM market_locations);

  -- ③ location_assignments を再挿入（vendor が紐づくもののみ）
  IF p_shops IS NOT NULL AND jsonb_array_length(p_shops) > 0 THEN
    INSERT INTO location_assignments (location_id, vendor_id, market_date)
    SELECT
      elem->>'locationId',
      elem->>'vendorId',
      v_today
    FROM jsonb_array_elements(p_shops) AS elem
    WHERE (elem->>'vendorId') IS NOT NULL AND (elem->>'vendorId') <> '';
  END IF;

  -- ④ スナップショットにない market_locations を削除
  IF p_shops IS NOT NULL AND jsonb_array_length(p_shops) > 0 THEN
    DELETE FROM market_locations
    WHERE id NOT IN (
      SELECT elem->>'locationId'
      FROM jsonb_array_elements(p_shops) AS elem
    );
  ELSE
    DELETE FROM market_locations;
  END IF;

  -- ⑤ map_landmarks を upsert（スナップショット内容で更新）
  IF p_landmarks IS NOT NULL AND jsonb_array_length(p_landmarks) > 0 THEN
    INSERT INTO map_landmarks (key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom)
    SELECT
      elem->>'key',
      elem->>'name',
      elem->>'description',
      elem->>'url',
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      (elem->>'widthPx')::integer,
      (elem->>'heightPx')::integer,
      (elem->>'showAtMinZoom')::boolean
    FROM jsonb_array_elements(p_landmarks) AS elem
    ON CONFLICT (key) DO UPDATE SET
      name            = EXCLUDED.name,
      description     = EXCLUDED.description,
      image_url       = EXCLUDED.image_url,
      latitude        = EXCLUDED.latitude,
      longitude       = EXCLUDED.longitude,
      width_px        = EXCLUDED.width_px,
      height_px       = EXCLUDED.height_px,
      show_at_min_zoom = EXCLUDED.show_at_min_zoom;
  END IF;

  -- ⑥ スナップショットにない map_landmarks を削除
  IF p_landmarks IS NOT NULL AND jsonb_array_length(p_landmarks) > 0 THEN
    DELETE FROM map_landmarks
    WHERE key NOT IN (
      SELECT elem->>'key'
      FROM jsonb_array_elements(p_landmarks) AS elem
    );
  ELSE
    DELETE FROM map_landmarks;
  END IF;

  -- ⑦ map_roads を upsert し、スナップショットにないものを削除
  -- map_route_points.road_id が参照しているため、道の削除より先に route_points を
  -- 差し替える（⑧）と外部キー制約に引っかかるため、road は route_points の後に削除する
  IF p_roads IS NOT NULL AND jsonb_array_length(p_roads) > 0 THEN
    INSERT INTO map_roads (id, name, kind, width_meters)
    SELECT
      elem->>'id',
      elem->>'name',
      elem->>'kind',
      (elem->>'widthMeters')::double precision
    FROM jsonb_array_elements(p_roads) AS elem
    ON CONFLICT (id) DO UPDATE SET
      name         = EXCLUDED.name,
      kind         = EXCLUDED.kind,
      width_meters = EXCLUDED.width_meters,
      updated_at   = now();
  END IF;
  -- p_roads が「空配列」（要素0件）の場合はここでは何もしない。道の削除は⑨で行う
  -- （NULLとの違いは⑨のコメントを参照）。

  -- ⑧ map_route_points を全削除し、スナップショットから再挿入
  -- branch_from_id 自己参照 FK のため、先に id のみ挿入してから UPDATE する
  DELETE FROM map_route_points;

  IF p_route_points IS NOT NULL AND jsonb_array_length(p_route_points) > 0 THEN
    INSERT INTO map_route_points (id, latitude, longitude, sort_order, road_id)
    SELECT
      elem->>'id',
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      (elem->>'order')::integer,
      elem->>'roadId'
    FROM jsonb_array_elements(p_route_points) AS elem;

    UPDATE map_route_points rp
    SET branch_from_id = elem->>'branchFromId'
    FROM jsonb_array_elements(p_route_points) AS elem
    WHERE rp.id = elem->>'id'
      AND (elem->>'branchFromId') IS NOT NULL
      AND (elem->>'branchFromId') <> '';
  END IF;

  -- ⑨ スナップショットにない map_roads を削除（route_points の差し替え後なので安全）
  --
  -- p_roads の NULL と空配列（[]）を区別して扱う:
  --   - NULL: 「roads未対応の古いスナップショット」を意味し、roadsを一切変更しない
  --     （map_layout_snapshots.roads_json はこのPRでNULL許容に変更しており、
  --     このPR以前に作成されたスナップショット行はNULLのまま残る）
  --   - 空配列: 「保存時点で道が0件だった」という明示的な状態を意味し、
  --     market_locations・map_landmarks と同様に「意図的な全削除」として扱う
  --     （createMapLayoutSnapshot は roads を必ず実配列として書き込むため、
  --     このPR以降に作られたスナップショットの roads_json がNULLになることはない）
  IF p_roads IS NOT NULL THEN
    DELETE FROM map_roads
    WHERE id NOT IN (
      SELECT elem->>'id'
      FROM jsonb_array_elements(p_roads) AS elem
    );
  END IF;

  -- ⑩ map_route_configs を upsert
  IF p_route_config IS NOT NULL AND p_route_config <> 'null'::jsonb THEN
    INSERT INTO map_route_configs (key, road_half_width_meters, snap_distance_meters, visible_distance_meters)
    VALUES (
      p_route_config->>'key',
      (p_route_config->>'roadHalfWidthMeters')::double precision,
      (p_route_config->>'snapDistanceMeters')::double precision,
      (p_route_config->>'visibleDistanceMeters')::double precision
    )
    ON CONFLICT (key) DO UPDATE SET
      road_half_width_meters  = EXCLUDED.road_half_width_meters,
      snap_distance_meters    = EXCLUDED.snap_distance_meters,
      visible_distance_meters = EXCLUDED.visible_distance_meters,
      updated_at              = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_map_route_points(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION replace_map_route_points(jsonb) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION restore_map_layout_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION restore_map_layout_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb) FROM anon, authenticated;
