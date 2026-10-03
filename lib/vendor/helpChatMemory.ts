import { parseProposalFrame, serializeProposal, type HelpProposal } from "@/lib/vendor/helpProposals";

/**
 * 出店者トップの、にちよさんへの相談（useVendorHelpChat）の「最後の答え」を、少しのあいだ覚えておく。
 *
 * ページを移って戻ってきたとき、答えが消えて「今日もおつかれさま！」に戻ってしまわないように、
 * 答えを返し終えてから 10 分のあいだは、同じタブでは最後の質問と答えを出し直す。
 * - 覚えるのは、このタブのあいだだけ（sessionStorage）。タブを閉じる・10 分たつと消える
 * - 持ち主（ログイン中のアカウント）ごとに分ける。同じタブで別の人がログインしても、前の人の相談は出ない
 * - sessionStorage が使えない環境（プライベートウィンドウなど）では、何も覚えない
 */
export const HELP_MEMORY_TTL_MS = 10 * 60 * 1000;

const PREFIX = "vendor-help-memory:";

export type HelpTurn = { role: "user" | "assistant"; text: string };

export type HelpMemory = {
  question: string;
  answer: string;
  /** まだ確かめていない変更案（あれば、戻ってきたときも確認の続きができる） */
  proposal: HelpProposal | null;
  /** 続けて聞いたときに話がつながるよう、サーバーへ渡すこれまでのやりとり */
  history: HelpTurn[];
};

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isTurn(value: unknown): value is HelpTurn {
  if (typeof value !== "object" || value === null) return false;
  const turn = value as Record<string, unknown>;
  return (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string";
}

/** 答えを覚える。時刻は保存した今。失敗しても何もしない */
export function saveHelpMemory(ownerId: string, memory: HelpMemory, now = Date.now()): void {
  try {
    storage()?.setItem(
      PREFIX + ownerId,
      JSON.stringify({
        savedAt: now,
        question: memory.question,
        answer: memory.answer,
        proposal: memory.proposal ? serializeProposal(memory.proposal) : null,
        history: memory.history,
      }),
    );
  } catch {
    // 覚えられなくても、答えは画面に出ている
  }
}

/** 覚えている答えを読む。10 分たっている・壊れている・無いときは null（古いものはここで消す） */
export function loadHelpMemory(ownerId: string, now = Date.now()): HelpMemory | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + ownerId);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const fresh = typeof data.savedAt === "number" && now - data.savedAt >= 0 && now - data.savedAt < HELP_MEMORY_TTL_MS;
    if (!fresh || typeof data.question !== "string" || typeof data.answer !== "string" || !data.question || !data.answer) {
      store.removeItem(PREFIX + ownerId);
      return null;
    }
    return {
      question: data.question,
      answer: data.answer,
      proposal: typeof data.proposal === "string" ? parseProposalFrame(data.proposal) : null,
      history: Array.isArray(data.history) ? data.history.filter(isTurn) : [],
    };
  } catch {
    return null;
  }
}

/** 覚えている答えを消す（相談を閉じたとき） */
export function clearHelpMemory(ownerId: string): void {
  try {
    storage()?.removeItem(PREFIX + ownerId);
  } catch {
    // 消せなくても、10 分で出なくなる
  }
}
