"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiNote, AiNoteInput } from "@/lib/vendor/aiNotes";
import { AiNotesError, createAiNote, deleteAiNote, fetchAiNotes, updateAiNote } from "../_services/aiNotesService";

export type AiNotesStatus = "loading" | "ready" | "error";

/** シートで開いているもの。null は閉じている、"new" は新しく書くとき */
export type OpenNote = AiNote | "new" | null;

const messageOf = (err: unknown) =>
  err instanceof AiNotesError ? err.message : "うまく保存できんかった。もういっぺんやってみてや。";

/**
 * 「にちよさんが覚えちゅうこと」の画面の状態。1つずつその場で保存する（まとめて保存するボタンは無い）。
 * 覚えごとは、にちよさんのノート（store_knowledge、/api/vendor/ai-notes）に入っている。
 */
export function useAiNotes() {
  const [status, setStatus] = useState<AiNotesStatus>("loading");
  const [notes, setNotes] = useState<AiNote[]>([]);
  const [open, setOpen] = useState<OpenNote>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiNotes()
      .then((loaded) => {
        if (cancelled) return;
        setNotes(loaded.notes);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openNote = useCallback((note: AiNote | "new") => {
    setError(null);
    setOpen(note);
  }, []);

  const close = useCallback(() => {
    setError(null);
    setOpen(null);
  }, []);

  const save = useCallback(
    async (input: AiNoteInput) => {
      if (saving || !open) return;
      setSaving(true);
      setError(null);
      try {
        if (open === "new") {
          const created = await createAiNote(input);
          setNotes((current) => [...current, created]);
        } else {
          const updated = await updateAiNote(open.id, input);
          setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
        }
        setOpen(null);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setSaving(false);
      }
    },
    [open, saving]
  );

  const remove = useCallback(async () => {
    if (saving || !open || open === "new") return;
    setSaving(true);
    setError(null);
    try {
      await deleteAiNote(open.id);
      setNotes((current) => current.filter((note) => note.id !== open.id));
      setOpen(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }, [open, saving]);

  return {
    status,
    notes,
    open,
    saving,
    error,
    openNote,
    close,
    save,
    remove,
  };
}
