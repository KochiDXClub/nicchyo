"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { originalReply, templateReply } from "@/lib/vendor/character/mockReply";
import { EMPTY_USAGE, type TestUsage } from "@/lib/vendor/character/testRateLimit";
import { TEMPLATE_CHARACTER_BY_ID, TEMPLATE_CHARACTERS } from "@/lib/vendor/character/templates";
import {
  EMPTY_DRAFT,
  type OriginalCharacterDraft,
  type ReviewStatus,
  type TemplateCharacter,
} from "@/lib/vendor/character/types";
import CharacterAvatar from "./components/CharacterAvatar";
import OriginalForm from "./components/OriginalForm";
import ReviewStatusCard from "./components/ReviewStatusCard";
import TemplatePicker from "./components/TemplatePicker";
import TestChat from "./components/TestChat";

type Tab = "template" | "original";

/** いま、お客さんがお店でAIに聞くときに答えるキャラ */
type ActiveCharacter = { kind: "template"; id: string } | { kind: "original"; snapshot: OriginalCharacterDraft };

const DEFAULT_TEMPLATE_ID = TEMPLATE_CHARACTERS[0].id;

/**
 * お店のAIキャラクター（モック）。
 * 保存・運営の審査・AIへの設定の受け渡しは未実装で、画面の流れと決まりごとを確かめるためのもの。
 *   - テンプレ10人：話し方は運営が調整済みで変えられない
 *   - オリジナル：自分のイラストと自由な話し方。運営の確認が済むまで、お客さんには出ない
 *   - 話し方を試す：10分100回まで
 */
export default function VendorCharacterPage() {
  const [tab, setTab] = useState<Tab>("template");
  const [active, setActive] = useState<ActiveCharacter>({ kind: "template", id: DEFAULT_TEMPLATE_ID });
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATE_ID);
  const [draft, setDraft] = useState<OriginalCharacterDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<ReviewStatus>({ state: "draft" });
  /** 承認された内容。内容を直しても、再確認が済むまではこちらをお客さんに出す */
  const [approved, setApproved] = useState<OriginalCharacterDraft | null>(null);
  const [usage, setUsage] = useState<TestUsage>(EMPTY_USAGE);

  const activeView = useMemo(() => {
    if (active.kind === "original") return { name: active.snapshot.name, image: active.snapshot.illustrationUrl };
    const t = TEMPLATE_CHARACTER_BY_ID.get(active.id) ?? TEMPLATE_CHARACTERS[0];
    return { name: t.name, image: t.image ?? null };
  }, [active]);

  const selectedTemplate = TEMPLATE_CHARACTER_BY_ID.get(selectedId) ?? TEMPLATE_CHARACTERS[0];

  function handleDraftChange(patch: Partial<OriginalCharacterDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    // 承認ずみの内容を直したら、もう一度確認が要る
    if (status.state !== "draft") setStatus({ state: "draft" });
  }

  function handleSubmit() {
    setStatus({ state: "pending", submittedAt: new Date().toISOString() });
  }

  function handleMockReview(result: "approved" | "rejected") {
    const reviewedAt = new Date().toISOString();
    if (result === "approved") {
      setStatus({ state: "approved", reviewedAt });
      setApproved(draft);
    } else {
      setStatus({
        state: "rejected",
        reviewedAt,
        reason: "イラストが、他の方の作品に似ているため確認できませんでした。",
      });
    }
  }

  function useTemplate(character: TemplateCharacter) {
    setActive({ kind: "template", id: character.id });
  }

  const originalInUse = active.kind === "original";

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="お店のキャラクター" />
      <PageContainer>
        {/* 保存も運営への申請もまだ動かない。本物の出店者が申請したと思い込まないよう、先頭で伝える */}
        <p role="note" className="mb-5 rounded-btn bg-amber-50 px-4 py-3 text-sm font-bold leading-relaxed text-amber-900 ring-1 ring-amber-200">
          準備中の画面です。選んだ内容は保存されず、運営への申請もまだ届きません。
        </p>
        <Surface className="mb-5 flex items-center gap-4">
          <CharacterAvatar name={activeView.name} image={activeView.image} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-nicchyo-ink/55">いま、お店で答えているキャラ</p>
            <p className="text-lg font-bold text-nicchyo-ink">{activeView.name}</p>
            <p className="text-xs leading-relaxed text-nicchyo-ink/70">お客さんがお店のことをAIに聞くと、このキャラが答えます。</p>
          </div>
        </Surface>

        <div className="mb-5 flex gap-1.5 rounded-chip bg-white p-1.5 shadow-card ring-1 ring-line" role="group" aria-label="キャラの選び方">
          {([
            ["template", "テンプレから選ぶ"],
            ["original", "オリジナルを作る"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "h-11 flex-1 rounded-chip text-sm font-bold transition",
                tab === key ? "bg-amber-600 text-white shadow-sm" : "text-nicchyo-ink/70 hover:text-nicchyo-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "template" ? (
          <div className="space-y-5">
            <TemplatePicker
              selectedId={selectedId}
              activeId={active.kind === "template" ? active.id : null}
              onSelect={setSelectedId}
              onUse={useTemplate}
            />
            <TestChat
              resetKey={`template:${selectedTemplate.id}`}
              name={selectedTemplate.name}
              image={selectedTemplate.image}
              greeting={selectedTemplate.greeting}
              reply={(message) => templateReply(selectedTemplate, message)}
              usage={usage}
              onUsageChange={setUsage}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <OriginalForm draft={draft} status={status} onChange={handleDraftChange} onSubmit={handleSubmit} />
            <TestChat
              resetKey="original"
              name={draft.name || "オリジナルのキャラ"}
              image={draft.illustrationUrl}
              greeting={`${draft.firstPerson || "わたし"}が、お店のことを案内します。`}
              reply={(message) => originalReply(draft, message)}
              usage={usage}
              onUsageChange={setUsage}
            />
            <ReviewStatusCard
              status={status}
              inUse={originalInUse}
              onUse={() => approved && setActive({ kind: "original", snapshot: approved })}
              onMockReview={handleMockReview}
            />
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}
