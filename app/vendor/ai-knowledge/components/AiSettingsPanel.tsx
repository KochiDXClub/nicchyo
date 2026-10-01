"use client";

import { AlertCircle } from "lucide-react";
import { Surface } from "@/components/ui";
import type { AiSettings } from "@/lib/vendor/aiNotes";
import { AudienceSwitch } from "./NoteSheet";

/**
 * お店の数字を、どのにちよさんにどこまで渡すか。
 * 閲覧数や売上の数そのものは、お客さんには渡さない（画面にもそう書いておく）。
 */
export default function AiSettingsPanel({
  settings,
  error,
  onChange,
}: {
  settings: AiSettings;
  error: string | null;
  onChange: (next: AiSettings) => void;
}) {
  return (
    <Surface>
      <h2 className="text-base font-bold text-nicchyo-ink">お店の数字の使い方</h2>
      <div className="mt-3 space-y-2">
        <AudienceSwitch
          label="自分の相談で、お店の数字を使う"
          hint="見られた回数・ハート・売れ筋をもとに、にちよさんが相談に乗ります"
          checked={settings.useStatsInVendorHelp}
          onChange={(checked) => onChange({ ...settings, useStatsInVendorHelp: checked })}
        />
        <AudienceSwitch
          label="お客さんに「よく売れている商品」を伝える"
          hint="商品の名前だけを伝えます。売れた数や順位は伝えません"
          checked={settings.sharePopularWithVisitors}
          onChange={(checked) => onChange({ ...settings, sharePopularWithVisitors: checked })}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-nicchyo-ink/55">
        見られた回数や売上の数そのものを、お客さんのにちよさんに渡すことはありません。
      </p>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-btn bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </Surface>
  );
}
