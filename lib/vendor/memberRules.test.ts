import { describe, expect, it } from "vitest";
import { canGrantPermissions, canLeaveShop, canManageMember, canTransferOwnership, type MemberRef } from "./memberRules";

const owner: MemberRef = { userId: "o", role: "owner", permissions: [] };
const deputy: MemberRef = { userId: "d", role: "member", permissions: ["store_edit", "post", "members_manage"] };
const deputy2: MemberRef = { userId: "d2", role: "member", permissions: ["members_manage"] };
const helper: MemberRef = { userId: "h", role: "member", permissions: ["post"] };

describe("canGrantPermissions", () => {
  it("代表者はどの権限でも付けられる（members_manage を含む）", () => {
    expect(canGrantPermissions(owner, ["store_edit", "members_manage"])).toBe(true);
  });

  it("副代表は、自分が持つ権限だけ付けられる", () => {
    expect(canGrantPermissions(deputy, ["store_edit", "post"])).toBe(true);
    expect(canGrantPermissions(deputy, ["analytics"])).toBe(false);
  });

  it("副代表でも members_manage は付けられない（権限が連鎖して広がらないように）", () => {
    expect(canGrantPermissions(deputy, ["members_manage"])).toBe(false);
  });

  it("members_manage を持たないメンバーは何も付けられない", () => {
    expect(canGrantPermissions(helper, ["post"])).toBe(false);
  });
});

describe("canManageMember", () => {
  it("代表者は代表者以外の誰でも動かせるが、自分と代表者自身は動かせない", () => {
    expect(canManageMember(owner, helper)).toBe(true);
    expect(canManageMember(owner, deputy)).toBe(true);
    expect(canManageMember(owner, owner)).toBe(false);
  });

  it("副代表は members_manage を持たないメンバーだけ動かせる", () => {
    expect(canManageMember(deputy, helper)).toBe(true);
    expect(canManageMember(deputy, deputy2)).toBe(false);
  });

  it("副代表も代表者は動かせず、自分自身も動かせない", () => {
    expect(canManageMember(deputy, owner)).toBe(false);
    expect(canManageMember(deputy, deputy)).toBe(false);
  });

  it("members_manage を持たないメンバーは誰も動かせない", () => {
    expect(canManageMember(helper, { userId: "x", role: "member", permissions: [] })).toBe(false);
  });
});

describe("canTransferOwnership / canLeaveShop", () => {
  it("引き継ぎは代表者から、同じ店舗のメンバーへだけ", () => {
    expect(canTransferOwnership(owner, helper)).toBe(true);
    expect(canTransferOwnership(owner, owner)).toBe(false);
    expect(canTransferOwnership(deputy, helper)).toBe(false);
  });

  it("代表者は引き継ぎなしに店舗を抜けられない", () => {
    expect(canLeaveShop(owner)).toBe(false);
    expect(canLeaveShop(helper)).toBe(true);
  });
});
