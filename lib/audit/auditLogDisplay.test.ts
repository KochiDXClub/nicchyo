import { describe, expect, it } from "vitest";
import { describeAuditLog, roleLabel, type AuditLogRecord } from "./auditLogDisplay";

function log(partial: Partial<AuditLogRecord> & { action: string }): AuditLogRecord {
  return {
    actor_email: "admin@example.com",
    actor_role: "admin",
    target_type: null,
    target_id: null,
    target_name: null,
    details: null,
    ip_address: null,
    ...partial,
  };
}

// 例は本番の監査ログに実際に入っている形
describe("describeAuditLog（監査ログを読める言葉にする）", () => {
  it("カテゴリーの JSON は、名前を文に入れて見せ、英語のキーは出さない", () => {
    const view = describeAuditLog(
      log({ action: "category_created", target_type: "category", target_id: "6b45143a-c19a-44bf-971f-5a537740b959", details: '{"name":"野菜・果物"}' })
    );
    expect(view.actionLabel).toBe("カテゴリーを作成");
    expect(view.summary).toBe("カテゴリー「野菜・果物」を作りました");
    expect(view.targetLabel).toBe("カテゴリー");
    expect(JSON.stringify(view.facts)).not.toContain("name");
  });

  it("名前の残っていないカテゴリーの削除（details が {}）も文になる", () => {
    expect(describeAuditLog(log({ action: "category_deleted", details: "{}" })).summary).toBe("カテゴリーを削除しました");
  });

  it("店舗の代理編集は、保存した項目を管理画面と同じ呼び名にし、掲載許可の前後も日本語にする", () => {
    const view = describeAuditLog(
      log({
        action: "shop_edit",
        target_type: "vendor",
        target_name: "革職人服部",
        details: "代理編集: shop_name, category_id, rain_policy, sns_x, chome=3 / 掲載許可 pending → allowed",
      })
    );
    expect(view.summary).toBe("店舗「革職人服部」の情報を代わりに編集しました");
    expect(view.facts).toEqual([
      { label: "保存した項目", value: "店名、カテゴリー、雨天時、X、丁目" },
      { label: "丁目", value: "3" },
      { label: "掲載許可", value: "未取得 → 許可済み" },
    ]);
  });

  it("マップ編集の保存は、新規・更新の件数と出店者の名前（多ければ縮めて）を出す。ID は出さない", () => {
    const created = Array.from({ length: 7 }, (_, i) => ({ id: `id-${i}`, name: `一丁目 南 ${i + 1}` }));
    const view = describeAuditLog(
      log({ action: "map_edit_save_vendors", target_type: "vendor", details: JSON.stringify({ created, updated: [] }) })
    );
    expect(view.summary).toBe("マップ編集で出店者を保存しました（新規 7件・更新 0件）");
    expect(view.facts).toEqual([
      { label: "新しく作った出店者（7件）", value: "一丁目 南 1、一丁目 南 2、一丁目 南 3、一丁目 南 4、一丁目 南 5 ほか2件" },
    ]);
    expect(JSON.stringify(view.facts)).not.toContain("id-");
  });

  it("日本語の文で残っている details は、そのまま「内容」として出す", () => {
    const details = "現場登録: 店番なし の位置を記録（現在地・誤差約8m: 33.561654, 133.538924）。地図には反映していない";
    const view = describeAuditLog(log({ action: "shop_location_edit", target_name: "革職人服部", details }));
    expect(view.summary).toBe("店舗「革職人服部」の位置を記録しました");
    expect(view.facts).toEqual([{ label: "内容", value: details }]);
  });

  it("商品写真は、商品名を取り出して出す", () => {
    const view = describeAuditLog(
      log({ action: "product_image_upload", target_name: "六丁目 南 492(高陽堂)", details: "商品写真を代理でアップロード: 陶器" })
    );
    expect(view.summary).toBe("店舗「六丁目 南 492(高陽堂)」の商品写真を代わりに登録しました");
    expect(view.facts).toEqual([{ label: "商品", value: "陶器" }]);
  });

  it("開催日の状態は、前後を日曜市カレンダーと同じ言葉にする", () => {
    const view = describeAuditLog(
      log({
        action: "market_day_updated",
        target_id: "2026-10-18",
        details: JSON.stringify({ before: { status: "open", note: null }, after: { status: "cancelled", note: "台風のため" } }),
      })
    );
    expect(view.summary).toBe("2026-10-18 の開催の状態を変えました");
    expect(view.facts).toEqual([
      { label: "開催の状態", value: "開催 → 荒天中止" },
      { label: "お知らせの文", value: "台風のため" },
    ]);
  });

  it("ロールの英語は日本語にする", () => {
    expect(describeAuditLog(log({ action: "change_role", details: "ロールを vendor に変更" })).summary).toBe(
      "ユーザーのロールを「出店者」に変えました"
    );
    expect(describeAuditLog(log({ action: "invite_user", target_name: "a@example.com", details: "ロール: moderator で招待" })).facts).toEqual([
      { label: "内容", value: "ロール: モデレーターで招待" },
    ]);
    expect(roleLabel("super_admin")).toBe("最高管理者");
  });

  it("元の値（操作の名前・ID・details・IP）は「技術的な情報」に残す", () => {
    const view = describeAuditLog(
      log({ action: "category_updated", target_type: "category", target_id: "abc", details: '{"name":"花"}', ip_address: "203.0.113.1" })
    );
    expect(view.technical).toEqual([
      { label: "操作の名前", value: "category_updated" },
      { label: "対象の種類", value: "category" },
      { label: "対象のID", value: "abc" },
      { label: "記録された内容（そのまま）", value: '{"name":"花"}' },
      { label: "IPアドレス", value: "203.0.113.1" },
    ]);
  });

  it("知らない操作・知らない JSON でも英語のキーや ID は見せず、分かるキーだけ出す", () => {
    const view = describeAuditLog(
      log({ action: "something_new", target_type: "vendor", target_name: "店A", details: '{"vendor_id":"x","title":"春の市","flag":true}' })
    );
    expect(view.actionLabel).toBe("その他の操作");
    expect(view.summary).toBe("その他の操作（店舗「店A」）");
    expect(view.facts).toEqual([{ label: "タイトル", value: "春の市" }]);
  });
});
