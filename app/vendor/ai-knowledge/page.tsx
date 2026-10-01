"use client";

export const dynamic = "force-dynamic";

import { AnimatePresence } from "framer-motion";
import { AlertCircle, ChevronRight, Plus } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AiNote } from "@/lib/vendor/aiNotes";
import AiSettingsPanel from "./components/AiSettingsPanel";
import KnownFacts from "./components/KnownFacts";
import NoteSheet from "./components/NoteSheet";
import TryAsk from "./components/TryAsk";
import { useAiNotes } from "./useAiNotes";

/** 届け先を短く言う */
function audienceLabel(note: AiNote): string {
  if (note.forVisitors && note.forVendor) return "お客さん・自分";
  return note.forVisitors ? "お客さんだけ" : "自分の相談だけ";
}

function NoteCard({ note, onOpen }: { note: AiNote; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-card bg-white p-4 text-left shadow-card ring-1 ring-line transition hover:bg-nicchyo-base active:scale-[0.99] motion-reduce:active:scale-100"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-bold text-nicchyo-ink">{note.title}</span>
            <span className="text-xs text-nicchyo-ink/55">{audienceLabel(note)}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm leading-relaxed text-nicchyo-ink/70">{note.content}</span>
          {!note.searchable && (
            <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-800">
              <AlertCircle size={13} aria-hidden="true" />
              にちよさんがまだ探せません。開いて保存し直してください
            </span>
          )}
        </span>
        <ChevronRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-nicchyo-ink/40" />
      </button>
    </li>
  );
}

/**
 * にちよさんに教える（にちよさんのノート）。
 * 「トピックタイトル・本文」のノートを1枚ずつ書き、どのにちよさんに教えるかを選ぶ。
 */
export default function AiKnowledgePage() {
  const { user } = useAuth();
  const notes = useAiNotes();

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="にちよさんに教える" />
      <PageContainer className="space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <GrandmaAvatar pose="idle" size="pinned" character={DEFAULT_CONSULT_CHARACTER} className="shrink-0" />
          <div className="consult-greeting consult-greeting--left min-w-0 flex-1 rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
            <p className="text-base font-bold leading-relaxed text-amber-900">
              「混む時間」「お支払い方法」みたいに、トピックごとに1枚ずつ教えてや。聞かれたら、ここに書いたことで答えるきね。
            </p>
          </div>
        </div>

        {notes.status === "loading" && <CenteredLoading />}

        {notes.status === "error" && (
          <Surface className="text-center">
            <p className="text-base font-bold text-amber-900">うまく開けんかった。もういっぺん開いてみてや。</p>
            <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
              もういっぺん
            </Button>
          </Surface>
        )}

        {notes.status === "ready" && (
          <>
            <section aria-labelledby="notes-heading">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <h2 id="notes-heading" className="text-lg font-bold text-nicchyo-ink">
                  ノート<span className="ml-1 text-sm font-semibold text-nicchyo-ink/55">{notes.notes.length}枚</span>
                </h2>
              </div>
              {notes.notes.length === 0 ? (
                <Surface className="text-center">
                  <p className="text-base font-semibold text-nicchyo-ink">まだノートがありません</p>
                  <p className="mt-1 text-sm text-nicchyo-ink/70">
                    おすすめ・混む時間・お支払い方法など、お客さんによく聞かれることから書いてみてや。
                  </p>
                </Surface>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {notes.notes.map((note) => (
                    <NoteCard key={note.id} note={note} onOpen={() => notes.openNote(note)} />
                  ))}
                </ul>
              )}
              <Button size="lg" className="mt-3 w-full" onClick={() => notes.openNote("new")}>
                <Plus size={18} aria-hidden="true" />
                ノートを書く
              </Button>
            </section>

            {user && <TryAsk vendorId={user.id} />}

            {user && <KnownFacts vendorId={user.id} />}

            <AiSettingsPanel settings={notes.settings} error={notes.settingsError} onChange={notes.changeSettings} />
          </>
        )}
      </PageContainer>

      <AnimatePresence>
        {notes.open && (
          <NoteSheet
            key={notes.open === "new" ? "new" : notes.open.id}
            note={notes.open === "new" ? null : notes.open}
            saving={notes.saving}
            error={notes.error}
            onClose={notes.close}
            onSave={notes.save}
            onDelete={notes.remove}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
