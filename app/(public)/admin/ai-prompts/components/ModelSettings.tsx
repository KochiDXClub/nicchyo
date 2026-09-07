"use client";

/**
 * 機能ごとのAIモデル割り当て
 *
 * モデルの一覧も機能の一覧も **DBの台帳（ai_models / ai_use_cases）から取る**。
 * 自由入力にはしない。存在しないモデル名を保存できると、その機能の
 * 全リクエストが落ちる。
 *
 * 推論の深さはモデルごとに受け付ける値が違うので、モデルを選び直したときに
 * 前のモデルでしか使えない値が残らないよう、選択肢から外れたら未指定に戻す。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  CODE_AI_CATALOG,
  DEFAULT_AI_MODEL_SETTINGS,
  type AiModelDef,
  type AiModelSettingSet,
  type AiUseCaseDef,
  type ReasoningEffort,
} from "@/lib/ai/models";

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "考えない（最速）",
  minimal: "ほぼ考えない（最速）",
  low: "少し考える",
  medium: "ふつうに考える",
  high: "よく考える",
  xhigh: "とてもよく考える",
  max: "最大まで考える",
};

/** 1質問あたりの目安。相談1回のおおよその実測値（入力1,200 / 出力250 token） */
const TOKENS_PER_ASK = { input: 1200, output: 250 };
/** 表示用の概算レート。桁感が伝わればよいので固定でよい */
const USD_TO_YEN = 150;

function estimateCostYen(model: AiModelDef): string {
  const usd =
    (TOKENS_PER_ASK.input * model.pricing.input + TOKENS_PER_ASK.output * model.pricing.output) /
    1e6;
  return `1回あたり約 ${(usd * USD_TO_YEN).toFixed(3)} 円`;
}

type Choice = { modelId: string; reasoningEffort?: ReasoningEffort };

function UseCaseRow({
  def,
  models,
  value,
  savedAt,
  fellBack,
  onChange,
}: {
  def: AiUseCaseDef;
  models: readonly AiModelDef[];
  value: Choice;
  savedAt?: string;
  /** 保存されていたモデルが台帳から消えて、既定値に戻っている */
  fellBack?: boolean;
  onChange: (useCase: string, next: Choice) => void;
}) {
  const model = models.find((item) => item.id === value.modelId);
  const efforts = model?.reasoningEfforts ?? [];
  const isDefault = !savedAt;

  const handleModelChange = useCallback(
    (modelId: string) => {
      const next = models.find((item) => item.id === modelId);
      // 前のモデルでしか使えない深さが残ると、保存時に弾かれる
      const keepEffort =
        value.reasoningEffort && next?.reasoningEfforts.includes(value.reasoningEffort)
          ? value.reasoningEffort
          : undefined;
      onChange(def.useCase, { modelId, reasoningEffort: keepEffort });
    },
    [def.useCase, models, onChange, value.reasoningEffort]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-bold text-slate-900">{def.label}</span>
        {isDefault ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            既定のまま
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-slate-500">{def.description}</p>

      {fellBack ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[12px] leading-relaxed text-red-800">
          前に選んでいたモデルが選べなくなったため、いまは既定のモデルで動いています。
          選び直して保存してください。
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`model-${def.useCase}`}
            className="text-[12px] font-semibold text-slate-600"
          >
            使うモデル
          </label>
          <select
            id={`model-${def.useCase}`}
            value={value.modelId}
            onChange={(event) => handleModelChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
          >
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {efforts.length > 0 ? (
          <div>
            <label
              htmlFor={`effort-${def.useCase}`}
              className="text-[12px] font-semibold text-slate-600"
            >
              どれくらい考えさせるか
            </label>
            <select
              id={`effort-${def.useCase}`}
              value={value.reasoningEffort ?? ""}
              onChange={(event) =>
                onChange(def.useCase, {
                  modelId: value.modelId,
                  reasoningEffort: (event.target.value || undefined) as
                    | ReasoningEffort
                    | undefined,
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
            >
              <option value="">おまかせ（{EFFORT_LABELS[efforts[0]]}）</option>
              {efforts.map((effort) => (
                <option key={effort} value={effort}>
                  {EFFORT_LABELS[effort]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {model ? (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
          {model.description}
          <span className="ml-1 whitespace-nowrap text-slate-400">（{estimateCostYen(model)}）</span>
        </p>
      ) : (
        <p className="mt-3 text-[12px] font-semibold text-red-600">
          このモデルは選べなくなっています。選び直してください。
        </p>
      )}

      {savedAt ? (
        <p className="mt-2 text-[11px] text-slate-400">
          最終更新: {new Date(savedAt).toLocaleString("ja-JP")}
        </p>
      ) : null}
    </div>
  );
}

export function ModelSettings() {
  const [models, setModels] = useState<readonly AiModelDef[]>(CODE_AI_CATALOG.models);
  const [useCases, setUseCases] = useState<readonly AiUseCaseDef[]>(CODE_AI_CATALOG.useCases);
  const [saved, setSaved] = useState<AiModelSettingSet>(DEFAULT_AI_MODEL_SETTINGS);
  const [draft, setDraft] = useState<AiModelSettingSet>(DEFAULT_AI_MODEL_SETTINGS);
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [fellBack, setFellBack] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-models");
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as {
        models: AiModelDef[];
        useCases: AiUseCaseDef[];
        settings: AiModelSettingSet;
        savedAt: Record<string, string>;
        fellBack: string[];
      };
      setModels(json.models);
      setUseCases(json.useCases);
      setSaved(json.settings);
      setDraft(json.settings);
      setSavedAt(json.savedAt ?? {});
      setFellBack(json.fellBack ?? []);
    } catch {
      showToast.error("モデル台帳の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback((useCase: string, next: Choice) => {
    setDraft((current) => ({ ...current, [useCase]: next }));
  }, []);

  const changed = useMemo(
    () =>
      useCases
        .filter(
          (def) =>
            draft[def.useCase]?.modelId !== saved[def.useCase]?.modelId ||
            draft[def.useCase]?.reasoningEffort !== saved[def.useCase]?.reasoningEffort
        )
        .map((def) => def.useCase),
    [draft, saved, useCases]
  );

  const handleSave = useCallback(async () => {
    if (changed.length === 0) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(changed.map((useCase) => [useCase, draft[useCase]]));
      const res = await fetch("/api/admin/ai-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success("保存しました");
      await load();
    } catch {
      showToast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [changed, draft, load]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">AIを使っている機能とモデル</h2>
        <p className="text-[13px] text-slate-500">
          機能ごとに別のモデルを割り当てられます。速さが体験に直結する相談・チャットと、
          じっくり考えさせたい回り方プランでは、向いているモデルが違います。
        </p>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
        変更すると<strong>次の質問からすぐ反映されます</strong>。
        モデルを変えると返事の文体や長さも変わるので、切り替えたあとは実際に
        その機能を1〜2回試してください。おかしければ元のモデルに選び直せば戻ります。
      </p>

      {loading ? (
        <p className="text-[13px] text-slate-500">読み込み中...</p>
      ) : (
        <>
          {useCases.map((def) => (
            <UseCaseRow
              key={def.useCase}
              def={def}
              models={models}
              value={draft[def.useCase] ?? DEFAULT_AI_MODEL_SETTINGS[def.useCase]}
              savedAt={savedAt[def.useCase]}
              fellBack={fellBack.includes(def.useCase)}
              onChange={handleChange}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton
              onClick={handleSave}
              isLoading={saving}
              loadingText="保存中..."
              disabled={changed.length === 0}
              className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white"
            >
              {changed.length > 0 ? `${changed.length}件を保存` : "変更なし"}
            </LoadingButton>
            {changed.length > 0 ? (
              <button
                type="button"
                onClick={() => setDraft(saved)}
                className="text-[13px] text-slate-500 underline"
              >
                変更を取り消す
              </button>
            ) : null}
          </div>

          <p className="text-[12px] leading-relaxed text-slate-400">
            選べるモデルの一覧はデータベースの台帳（ai_models）から読んでいます。
            新しいモデルを増やす・提供終了したモデルを隠すには、開発側でマイグレーションが要ります。
            機能そのものの追加もコード側の対応が必要です。
          </p>
        </>
      )}
    </section>
  );
}
