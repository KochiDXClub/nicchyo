"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_AI_SETTINGS, type AiNote, type AiNoteInput, type AiSettings } from "@/lib/vendor/aiNotes";
import {
  AiNotesError,
  createAiNote,
  deleteAiNote,
  fetchAiNotes,
  saveAiSettings,
  updateAiNote,
} from "../_services/aiNotesService";

export type AiNotesStatus = "loading" | "ready" | "error";

/** シートで開いているもの。null は閉じている、"new" は新しく書くとき */
export type OpenNote = AiNote | "new" | null;

const messageOf = (err: unknown) =>
  err instanceof AiNotesError ? err.message : "うまく保存できんかった。もういっぺんやってみてや。";

/**
 * にちよさんのノートの画面の状態。ノートは1枚ずつその場で保存する（まとめて保存するボタンは無い）。
 */
export function useAiNotes() {
  const [status, setStatus] = useState<AiNotesStatus>("loading");
  const [notes, setNotes] = useState<AiNote[]>([]);
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [open, setOpen] = useState<OpenNote>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiNotes()
      .then((loaded) => {
        if (cancelled) return;
        setNotes(loaded.notes);
        setSettings(loaded.settings);
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

  /** 設定はスイッチを押したらすぐ保存する。保存できなかったら元に戻す */
  const changeSettings = useCallback(
    async (next: AiSettings) => {
      const previous = settings;
      setSettings(next);
      setSettingsError(null);
      try {
        await saveAiSettings(next);
      } catch (err) {
        setSettings(previous);
        setSettingsError(messageOf(err));
      }
    },
    [settings]
  );

  return {
    status,
    notes,
    settings,
    open,
    saving,
    error,
    settingsError,
    openNote,
    close,
    save,
    remove,
    changeSettings,
  };
}
