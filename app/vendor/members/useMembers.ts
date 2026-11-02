"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMembers, type MembersResponse } from "../_services/membersService";

/** メンバー一覧と、自分の立場。変更したあとは reload で読み直す */
export function useMembers() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await fetchMembers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "メンバーを読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
