"use client";

/**
 * AIモデルの対話テスト
 *
 * モデルを切り替える前に「実際にどう答えるか・何秒かかるか」をその場で見るための道具。
 * 選んだモデル × 質問の組み合わせを **同時に** 投げて、横に並べて比べる。
 *
 * 呼ぶのは本番の相談と同じ本体（/api/admin/ai-models/test → handleConsultAsk）。
 * 所要時間は埋め込み・店舗検索・モデル呼び出しを含む、来訪者が待つのと同じ時間。
 * 相談ログには残らない。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  CODE_AI_CATALOG,
  DEFAULT_AI_MODEL_SETTINGS,
  type AiModelDef,
  type AiModelSettingSet,
  type ReasoningEffort,
} from "@/lib/ai/models";
import type { AiModelTestResult } from "@/lib/ai/modelTest";

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "考えない",
  minimal: "ほぼ考えない",
  low: "少し考える",
  medium: "ふつうに考える",
  high: "よく考える",
  xhigh: "とてもよく考える",
  max: "最大まで考える",
};

/** 来訪者がよく聞く形の質問。店舗検索・スポット案内・季節ものが一通り通る */
const PRESET_QUESTIONS = [
  "アイスが食べられるお店はある？",
  "お土産におすすめの果物を教えて",
  "トイレはどこにある？",
];

const MAX_QUESTIONS = 5;

type Selection = { on: boolean; reasoningEffort?: ReasoningEffort };

type CellState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: AiModelTestResult }
  | { status: "failed"; message: string };

function cellKey(modelId: string, questionIndex: number) {
  return `${modelId}#${questionIndex}`;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}秒`;
}

function ResultCell({ cell }: { cell: CellState }) {
  if (cell.status === "idle") {
    return <p className="text-[12px] text-slate-400">未実行</p>;
  }
  if (cell.status === "running") {
    return <p className="text-[12px] text-slate-500">返事を待っています...</p>;
  }
  if (cell.status === "failed") {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-2 text-[12px] leading-relaxed text-red-800">
        {cell.message}
      </p>
    );
  }

  const { result } = cell;
  if (!result.ok) {
    return (
      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-red-700">
          失敗（{formatSeconds(result.elapsedMs)}）
        </p>
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-[12px] leading-relaxed text-red-800">
          {result.debugError ?? result.errorMessage ?? result.reply ?? "原因不明"}
        </p>
        {result.debugError ? (
          <p className="text-[11px] leading-relaxed text-slate-500">
            来訪者に見える文面: {result.errorMessage ?? result.reply}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-emerald-700">
        {formatSeconds(result.elapsedMs)}
      </p>
      <div className="space-y-1">
        {result.turns.length > 0 ? (
          result.turns.map((turn, index) => (
            <p key={index} className="text-[13px] leading-relaxed text-slate-800">
              <span className="font-semibold text-slate-600">{turn.speakerName}</span>
              <span className="mx-1 text-slate-400">:</span>
              {turn.text}
            </p>
          ))
        ) : (
          <p className="text-[13px] leading-relaxed text-slate-800">{result.reply}</p>
        )}
      </div>
      {result.shops.length > 0 ? (
        <p className="text-[12px] text-slate-500">
          紹介した店:{" "}
          {result.shops.map((shop) => `${shop.name}（${shop.id}）`).join("、")}
        </p>
      ) : null}
      {result.followUpQuestion ? (
        <p className="text-[12px] text-slate-400">続きの提案: {result.followUpQuestion}</p>
      ) : null}
    </div>
  );
}

export function ModelPlayground() {
  const [models, setModels] = useState<readonly AiModelDef[]>(CODE_AI_CATALOG.models);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [questions, setQuestions] = useState<string[]>(PRESET_QUESTIONS);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [running, setRunning] = useState(false);

  // 初期選択は「いま相談に使っているモデル」と「コード側の既定モデル」。
  // 切り替え前後を並べて見るのがいちばん多い使い方なので
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let catalogModels: readonly AiModelDef[] = CODE_AI_CATALOG.models;
      let currentModelId = DEFAULT_AI_MODEL_SETTINGS.consult.modelId;
      let currentEffort: ReasoningEffort | undefined;
      try {
        const res = await fetch("/api/admin/ai-models");
        if (res.ok) {
          const json = (await res.json()) as {
            models: AiModelDef[];
            settings: AiModelSettingSet;
          };
          catalogModels = json.models;
          currentModelId = json.settings.consult.modelId;
          currentEffort = json.settings.consult.reasoningEffort;
        }
      } catch {
        // 台帳が読めなくてもコード側の定義で試せる
      }
      if (cancelled) return;
      setModels(catalogModels);
      setSelection(
        Object.fromEntries(
          catalogModels.map((model) => [
            model.id,
            {
              on:
                model.id === currentModelId ||
                model.id === DEFAULT_AI_MODEL_SETTINGS.consult.modelId,
              reasoningEffort: model.id === currentModelId ? currentEffort : undefined,
            } satisfies Selection,
          ])
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedModels = useMemo(
    () => models.filter((model) => selection[model.id]?.on),
    [models, selection]
  );
  const validQuestions = useMemo(
    () => questions.map((q) => q.trim()).filter((q) => q.length >= 4),
    [questions]
  );
  const totalCalls = selectedModels.length * validQuestions.length;

  const toggleModel = useCallback((modelId: string) => {
    setSelection((current) => ({
      ...current,
      [modelId]: { ...current[modelId], on: !current[modelId]?.on },
    }));
  }, []);

  const changeEffort = useCallback((modelId: string, value: string) => {
    setSelection((current) => ({
      ...current,
      [modelId]: {
        on: current[modelId]?.on ?? false,
        reasoningEffort: (value || undefined) as ReasoningEffort | undefined,
      },
    }));
  }, []);

  const run = useCallback(async () => {
    if (totalCalls === 0 || running) return;
    setRunning(true);

    const runningCells: Record<string, CellState> = {};
    selectedModels.forEach((model) => {
      validQuestions.forEach((_, questionIndex) => {
        runningCells[cellKey(model.id, questionIndex)] = { status: "running" };
      });
    });
    setCells(runningCells);

    // 全部同時に投げる。所要時間の比較は、同じタイミングで測らないと意味が薄い
    await Promise.all(
      selectedModels.flatMap((model) =>
        validQuestions.map(async (question, questionIndex) => {
          const key = cellKey(model.id, questionIndex);
          let next: CellState;
          try {
            const res = await fetch("/api/admin/ai-models/test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                modelId: model.id,
                reasoningEffort: selection[model.id]?.reasoningEffort,
                question,
              }),
            });
            if (res.status === 429) {
              next = { status: "failed", message: "回数の上限に達しました。少し待ってから試してください" };
            } else if (!res.ok) {
              next = { status: "failed", message: `テストAPIが失敗しました（HTTP ${res.status}）` };
            } else {
              next = { status: "done", result: (await res.json()) as AiModelTestResult };
            }
          } catch {
            next = { status: "failed", message: "通信に失敗しました" };
          }
          setCells((current) => ({ ...current, [key]: next }));
        })
      )
    );

    setRunning(false);
  }, [running, selectedModels, selection, totalCalls, validQuestions]);

  /** モデルごとの平均所要時間（成功したものだけ） */
  const averageByModel = useMemo(() => {
    const result: Record<string, { avgMs: number; okCount: number; total: number }> = {};
    selectedModels.forEach((model) => {
      const done = validQuestions
        .map((_, index) => cells[cellKey(model.id, index)])
        .filter((cell): cell is Extract<CellState, { status: "done" }> => cell?.status === "done");
      const ok = done.filter((cell) => cell.result.ok);
      result[model.id] = {
        avgMs: ok.length > 0 ? ok.reduce((sum, cell) => sum + cell.result.elapsedMs, 0) / ok.length : 0,
        okCount: ok.length,
        total: done.length,
      };
    });
    return result;
  }, [cells, selectedModels, validQuestions]);

  const hasResults = Object.keys(cells).length > 0;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">モデルの対話テスト</h2>
        <p className="text-[13px] text-slate-500">
          切り替える前に、そのモデルが実際にどう答えるか・何秒かかるかをその場で試せます。
          相談ページと同じ仕組みで答えるので、本番と同じ返事になります。ここで試した内容は相談の記録には残りません。
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-[12px] font-semibold text-slate-600">比べるモデル</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {models.map((model) => {
            const sel = selection[model.id] ?? { on: false };
            return (
              <div
                key={model.id}
                className={`rounded-md border p-2 ${sel.on ? "border-slate-400 bg-slate-50" : "border-slate-200"}`}
              >
                <label className="flex items-center gap-2 text-[13px] text-slate-800">
                  <input
                    type="checkbox"
                    checked={sel.on}
                    onChange={() => toggleModel(model.id)}
                    disabled={running}
                  />
                  <span className="font-semibold">{model.label}</span>
                </label>
                {sel.on && model.reasoningEfforts.length > 0 ? (
                  <select
                    aria-label={`${model.label} の考えさせる深さ`}
                    value={sel.reasoningEffort ?? ""}
                    onChange={(event) => changeEffort(model.id, event.target.value)}
                    disabled={running}
                    className="mt-2 w-full rounded-md border border-slate-300 p-1.5 text-[12px] text-slate-800"
                  >
                    <option value="">おまかせ（{EFFORT_LABELS[model.reasoningEfforts[0]]}）</option>
                    {model.reasoningEfforts.map((effort) => (
                      <option key={effort} value={effort}>
                        {EFFORT_LABELS[effort]}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-[12px] font-semibold text-slate-600">
          質問（4文字以上、{MAX_QUESTIONS}問まで）
        </p>
        <div className="mt-2 space-y-2">
          {questions.map((question, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                maxLength={300}
                disabled={running}
                onChange={(event) =>
                  setQuestions((current) =>
                    current.map((q, i) => (i === index ? event.target.value : q))
                  )
                }
                className="w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
                disabled={running || questions.length <= 1}
                className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 disabled:opacity-40"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQuestions((current) => [...current, ""])}
            disabled={running || questions.length >= MAX_QUESTIONS}
            className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 disabled:opacity-40"
          >
            質問を追加
          </button>
          <button
            type="button"
            onClick={() => setQuestions(PRESET_QUESTIONS)}
            disabled={running}
            className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 disabled:opacity-40"
          >
            定番の3問に戻す
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton
          onClick={() => {
            if (totalCalls === 0) {
              showToast.error("モデルと質問を1つ以上選んでください");
              return;
            }
            void run();
          }}
          isLoading={running}
          loadingText="テスト中..."
          disabled={totalCalls === 0}
          className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white"
        >
          {totalCalls > 0
            ? `${selectedModels.length}モデル × ${validQuestions.length}問を同時に試す`
            : "モデルと質問を選ぶ"}
        </LoadingButton>
        <span className="text-[12px] text-slate-400">
          1回の実行で {totalCalls} 件の相談を投げます（OpenAI の費用がかかります）
        </span>
      </div>

      {hasResults ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left align-top">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-44 p-3 text-[12px] font-semibold text-slate-600">質問</th>
                {selectedModels.map((model) => {
                  const stats = averageByModel[model.id];
                  const effort = selection[model.id]?.reasoningEffort;
                  return (
                    <th key={model.id} className="min-w-[240px] p-3 text-[12px] font-semibold text-slate-700">
                      <div>{model.label}</div>
                      <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                        {model.reasoningEfforts.length > 0
                          ? `深さ: ${effort ? EFFORT_LABELS[effort] : `おまかせ（${EFFORT_LABELS[model.reasoningEfforts[0]]}）`}`
                          : "推論なし"}
                      </div>
                      {stats && stats.total > 0 ? (
                        <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                          平均 {stats.okCount > 0 ? formatSeconds(stats.avgMs) : "—"}（成功 {stats.okCount}/{stats.total}）
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {validQuestions.map((question, questionIndex) => (
                <tr key={questionIndex} className="border-b border-slate-100 last:border-b-0">
                  <td className="p-3 text-[13px] font-semibold text-slate-800">{question}</td>
                  {selectedModels.map((model) => (
                    <td key={model.id} className="p-3">
                      <ResultCell cell={cells[cellKey(model.id, questionIndex)] ?? { status: "idle" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
