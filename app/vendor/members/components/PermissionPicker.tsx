"use client";

import { Badge } from "@/components/ui";
import {
  SHOP_PERMISSION_KEYS,
  SHOP_PERMISSION_META,
  SHOP_PERMISSION_PRESETS,
  type ShopPermission,
  type ShopPermissionPresetKey,
} from "@/lib/vendor/shopPermissions";

/**
 * メンバーにつける権限を選ぶ部品。招待リンクを作るときと、メンバーの権限を変えるときの両方で使う。
 * ひな形（お手伝い・スタッフ・副代表）で土台を作り、1つずつ付け外しできる。
 *
 * canToggle は「自分がつけ外ししてよい権限」。付けられない権限（自分が持っていないもの・
 * 副代表からは members_manage）は、押せない状態で出す（規則は lib/vendor/memberRules.ts）。
 * ひな形は、押せる権限の分だけ付ける（押せない権限の今の状態は変えない）。
 */
export default function PermissionPicker({
  value,
  onChange,
  canToggle,
  idPrefix,
  disabled = false,
}: {
  value: readonly ShopPermission[];
  onChange: (next: ShopPermission[]) => void;
  canToggle: (permission: ShopPermission) => boolean;
  idPrefix: string;
  disabled?: boolean;
}) {
  const presetKeys = (Object.keys(SHOP_PERMISSION_PRESETS) as ShopPermissionPresetKey[]).filter((key) =>
    // 副代表のひな形は members_manage を含む。付けられない人には出さない
    SHOP_PERMISSION_PRESETS[key].permissions.every((p) => canToggle(p) || value.includes(p)),
  );

  const applyPreset = (key: ShopPermissionPresetKey) => {
    const keep = value.filter((p) => !canToggle(p));
    const add = SHOP_PERMISSION_PRESETS[key].permissions.filter(canToggle);
    const next = new Set<ShopPermission>([...keep, ...add]);
    onChange(SHOP_PERMISSION_KEYS.filter((p) => next.has(p)));
  };

  const toggle = (permission: ShopPermission) => {
    const next = new Set(value);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange(SHOP_PERMISSION_KEYS.filter((p) => next.has(p)));
  };

  // いまのチェックがひな形とぴったり同じなら、そのひな形を選んでいる状態として見せ、中身の説明を出す
  // （説明を title に入れても、スマホでは見えない）
  const matched = presetKeys.find((key) => {
    const preset: readonly ShopPermission[] = SHOP_PERMISSION_PRESETS[key].permissions;
    return preset.length === value.length && preset.every((p) => value.includes(p));
  });

  return (
    <div className="space-y-3">
      <div role="group" aria-labelledby={`${idPrefix}-presets`}>
        <p id={`${idPrefix}-presets`} className="text-xs font-semibold text-nicchyo-ink/70">
          かんたんに選ぶ
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {presetKeys.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={matched === key}
              onClick={() => applyPreset(key)}
              className={`inline-flex h-11 items-center rounded-chip px-4 text-sm font-semibold shadow-sm transition disabled:pointer-events-none disabled:opacity-45 ${
                matched === key ? "bg-amber-600 text-white" : "border border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
              }`}
            >
              {SHOP_PERMISSION_PRESETS[key].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-nicchyo-ink/70">
          {matched
            ? `${SHOP_PERMISSION_PRESETS[matched].label}：${SHOP_PERMISSION_PRESETS[matched].description}`
            : "押すと、下のチェックがまとめて変わります。1つずつ付け外しもできます。"}
        </p>
      </div>

      <ul className="divide-y divide-line rounded-btn ring-1 ring-line">
        {SHOP_PERMISSION_KEYS.map((permission) => {
          const meta = SHOP_PERMISSION_META[permission];
          const allowed = canToggle(permission);
          const toggleable = allowed && !disabled;
          const id = `${idPrefix}-${permission}`;
          return (
            <li key={permission}>
              <label htmlFor={id} className={`flex items-start gap-3 px-3 py-2.5 ${toggleable ? "cursor-pointer" : "opacity-60"}`}>
                <input
                  id={id}
                  type="checkbox"
                  // シートの下に貼りつく保存バー（約 70px）の裏に、Tab で移ったチェックが隠れないようにする
                  className="mt-1 h-4 w-4 shrink-0 scroll-mb-24 accent-amber-600"
                  checked={value.includes(permission)}
                  disabled={!toggleable}
                  onChange={() => toggle(permission)}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-nicchyo-ink">
                    {meta.label}
                    {meta.sensitive && <Badge variant="caution">管理者に近い権限</Badge>}
                  </span>
                  <span className="block text-xs leading-relaxed text-nicchyo-ink/70">{meta.description}</span>
                  {/* 押せない理由（自分が持っていない権限・副代表からのメンバーの管理）。規則は lib/vendor/memberRules.ts */}
                  {!allowed && <span className="block text-xs text-nicchyo-ink/70">あなたは付け外しできません（代表者に頼んでください）</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
