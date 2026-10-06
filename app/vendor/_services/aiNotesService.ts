import type { AiNote, AiNoteInput, AiSettings } from "@/lib/vendor/aiNotes";

/** 画面にそのまま出せる理由つきのエラー（API が返した日本語の文言） */
export class AiNotesError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    // 回数の上限は、API の文言（英語のことがある）より分かりやすく言い直す
    if (res.status === 429) throw new AiNotesError("続けて保存しすぎました。少し待ってからもういっぺんやってみてや。");
    throw new AiNotesError(payload.error ?? "うまく保存できんかった。もういっぺんやってみてや。");
  }
  return payload as T;
}

export function fetchAiNotes(): Promise<{ notes: AiNote[]; settings: AiSettings }> {
  return request("/api/vendor/ai-notes");
}

export async function createAiNote(input: AiNoteInput): Promise<AiNote> {
  const { note } = await request<{ note: AiNote }>("/api/vendor/ai-notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return note;
}

export async function updateAiNote(id: string, input: AiNoteInput): Promise<AiNote> {
  const { note } = await request<{ note: AiNote }>(`/api/vendor/ai-notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return note;
}

export async function deleteAiNote(id: string): Promise<void> {
  await request(`/api/vendor/ai-notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveAiSettings(settings: AiSettings): Promise<AiSettings> {
  const { settings: saved } = await request<{ settings: AiSettings }>("/api/vendor/ai-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return saved;
}
