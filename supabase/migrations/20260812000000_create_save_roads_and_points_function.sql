-- PUT /api/admin/map-layout の道保存処理（map_roads upsert →
-- replace_map_route_points → 除外された道の削除）が3つの独立した呼び出しに
-- 分かれており、途中で失敗すると map_roads と map_route_points が不整合な
-- ままDBに残ってしまう問題があった。3つをまとめて1つのplpgsql関数（＝1トランザクション）
-- にし、途中で失敗した場合は全体がロールバックされるようにする。
CREATE OR REPLACE FUNCTION save_roads_and_points(
  p_roads jsonb,
  p_points jsonb,
  p_removed_road_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ① 道をupsert（route_points が road_id で参照するため、点の差し替えより先に行う）
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

  -- ② route_points を全件削除して再挿入する（replace_map_route_points と同じロジック。
  -- branch_from_id は自己参照FKのため、先にidのみ挿入してからUPDATEする）
  DELETE FROM map_route_points;

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

  -- ③ 除外された道を削除する（route_points の差し替え後なので外部キー制約に安全）
  IF p_removed_road_ids IS NOT NULL AND jsonb_array_length(p_removed_road_ids) > 0 THEN
    DELETE FROM map_roads
    WHERE id IN (SELECT jsonb_array_elements_text(p_removed_road_ids));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION save_roads_and_points(jsonb, jsonb, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION save_roads_and_points(jsonb, jsonb, jsonb) FROM anon, authenticated;
