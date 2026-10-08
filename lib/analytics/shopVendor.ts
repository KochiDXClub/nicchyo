/**
 * 店番号 → 出店者。地図（app/(public)/map/services/shopDb.ts）と同じ決め方にそろえる。
 *
 * 地図は、出店者ごとに「いちばん新しい market_date の配置」を選び、その屋台に出店者を置いている。
 * なので「屋台のいちばん新しい配置の出店者」ではなく、
 * 「自分のいちばん新しい配置が、その屋台にある出店者」を探す（来週以降の配置を先に入れていても、
 * 同じ屋台に別の出店者が入る週でも、地図に出ている出店者と食い違わない）。
 */
export type Assignment = {
  vendor_id: string | null;
  location_id: string | null;
  market_date: string | null;
};

/** 出店者ごとの最新の配置（shopDb.ts の latestAssignmentByVendor と同じ比べ方） */
function latestByVendor(assignments: readonly Assignment[]): Map<string, Assignment> {
  const latest = new Map<string, Assignment>();
  for (const row of assignments) {
    if (!row.vendor_id || !row.location_id) continue;
    const current = latest.get(row.vendor_id);
    if (!current) {
      latest.set(row.vendor_id, row);
      continue;
    }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) latest.set(row.vendor_id, row);
  }
  return latest;
}

/**
 * その屋台（locationIds）にいま出ている出店者。ちょうど1人に決まらなければ null
 * （決まらないときは、別のお店に回数を付けてしまうより、記録しないほうが安全）。
 */
export function vendorForStore(
  assignmentsOfCandidates: readonly Assignment[],
  locationIds: ReadonlySet<string>
): string | null {
  const here = [...latestByVendor(assignmentsOfCandidates).entries()]
    .filter(([, assignment]) => assignment.location_id && locationIds.has(assignment.location_id))
    .map(([vendorId]) => vendorId);
  return here.length === 1 ? here[0] : null;
}
