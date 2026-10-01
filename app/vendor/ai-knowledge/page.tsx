"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, ChevronRight, MessageCircle } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import {
  Button,
  buttonClass,
  CenteredLoading,
  EmptyState,
  PageContainer,
  PageShell,
  PageTitle,
  Surface,
} from "@/components/ui";
import type { AiNote } from "@/lib/vendor/aiNotes";
import NoteSheet from "./components/NoteSheet";
import { useAiNotes } from "./useAiNotes";

/** どこで使うかを短く言う */
function audienceLabel(note: AiNote): string {
  if (note.forVisitors && note.forVendor) return "お客さん・自分";
  return note.forVisitors ? "お客さんだけ" : "自分の相談だけ";
}

function MemoryCard({ note, onOpen }: { note: AiNote; onOpen: () => void }) {
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
              にちよさんがまだ思い出せません。開いて保存し直してください
            </span>
          )}
        </span>
        <ChevronRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-nicchyo-ink/40" />
      </button>
    </li>
  );
}

/**
 * にちよさんが覚えちゅうこと。
 *
 * 出店者トップの相談で、にちよさんが「覚えちょいてもかまん？」と聞いて覚えたこと
 * （にちよさんのノート）を並べ、見る・直す・忘れさせる。覚えさせる入口は相談が主で、
 * ここで自分で書いて覚えさせることもできる。
 */
export default function AiKnowledgePage() {
  const memories = useAiNotes();

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="にちよさんが覚えちゅうこと" />
      <PageContainer className="space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <GrandmaAvatar pose="idle" size="pinned" character={DEFAULT_CONSULT_CHARACTER} className="shrink-0" />
          <div className="consult-greeting consult-greeting--left min-w-0 flex-1 rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
            <p className="text-base font-bold leading-relaxed text-amber-900">
              相談で教えてもろうたことを覚えちゅうで。お客さんに聞かれたら、これで答えるき。違うところがあったら直してや。
            </p>
          </div>
        </div>

        {memories.status === "loading" && <CenteredLoading />}

        {memories.status === "error" && (
          <Surface className="text-center">
            <p className="text-base font-bold text-amber-900">うまく開けんかった。もういっぺん開いてみてや。</p>
            <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
              もういっぺん
            </Button>
          </Surface>
        )}

        {memories.status === "ready" && (
          <section aria-labelledby="memories-heading">
            <h2 id="memories-heading" className="mb-2.5 px-1 text-lg font-bold text-nicchyo-ink">
              覚えちゅうこと<span className="ml-1 text-sm font-semibold text-nicchyo-ink/55">{memories.notes.length}こ</span>
            </h2>
            {memories.notes.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="まだ覚えちゅうことはないで"
                description="出店者トップでにちよさんと話しよったら、お客さんに伝えたいこと（混む時間・おすすめの食べ方など）を聞いて覚えていくきね。"
                action={
                  <Link href="/my-shop" className={buttonClass({ size: "lg" })}>
                    にちよさんと話す
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {memories.notes.map((note) => (
                  <MemoryCard key={note.id} note={note} onOpen={() => memories.openNote(note)} />
                ))}
              </ul>
            )}
            <Button variant="quiet" size="md" className="mt-3 w-full" onClick={() => memories.openNote("new")}>
              自分で書いて覚えさせる
            </Button>
          </section>
        )}
      </PageContainer>

      <AnimatePresence>
        {memories.open && (
          <NoteSheet
            key={memories.open === "new" ? "new" : memories.open.id}
            note={memories.open === "new" ? null : memories.open}
            saving={memories.saving}
            error={memories.error}
            onClose={memories.close}
            onSave={memories.save}
            onDelete={memories.remove}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
