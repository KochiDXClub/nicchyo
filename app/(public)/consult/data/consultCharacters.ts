export type ConsultCharacterId =
  | "nichiyosan"
  | "yoichisan"
  | "miraikun"
  | "yosakochan";

export type ConsultCharacter = {
  id: ConsultCharacterId;
  name: string;
  subtitle: string;
  image: string;
  imageScale: string;
  imagePosition: string;
};

// AIに渡す人格（personality / speech_style）はここには持たせない。
// 運営が管理画面から編集できるよう ai_prompts で管理し、
// プロンプト組み立て時に lib/grandma/prompts/ 側で合流させる。

export const CONSULT_CHARACTERS: ConsultCharacter[] = [
  {
    id: "nichiyosan",
    name: "にちよさん",
    subtitle: "日曜市のことなんでも知っちゅう大ベテラン",
    image: "/images/obaasan_transparent.png",
    imageScale: "scale-125",
    imagePosition: "center 28%",
  },
  {
    id: "yoichisan",
    name: "よういちさん",
    subtitle: "日曜市を支えてきたジェントルマン",
    image: "/images/characters/ojichan.png",
    imageScale: "scale-125",
    imagePosition: "center 14%",
  },
  {
    id: "miraikun",
    name: "みらいくん",
    subtitle: "さわやかで希望あふれる高知の青年",
    image: "/images/characters/onisan.png",
    imageScale: "scale-125",
    imagePosition: "center 12%",
  },
  {
    id: "yosakochan",
    name: "よさこちゃん",
    subtitle: "明るく華やかで、みんなを元気づけてくれる土佐っ子",
    image: "/images/characters/onesan.png",
    imageScale: "scale-125",
    imagePosition: "center 22%",
  },
];

export const CONSULT_CHARACTER_BY_ID = new Map(
  CONSULT_CHARACTERS.map((character) => [character.id, character])
);

/** 話し手を選んでいないときの既定。最初に出てくるのはこの人 */
export const DEFAULT_CONSULT_CHARACTER_ID: ConsultCharacterId = "nichiyosan";

export const DEFAULT_CONSULT_CHARACTER =
  CONSULT_CHARACTER_BY_ID.get(DEFAULT_CONSULT_CHARACTER_ID) ?? CONSULT_CHARACTERS[0];

/**
 * 今回の話し手を1人決める。
 *
 * 選んだキャラがいればその人、いなければ既定のにちよさん。
 * 呼び出し側（API・マップの相談UI）が配列を前提にしているので、
 * 1人だけ入った配列で返す。以前の「2人の掛け合い」「5%で全員」は廃止した。
 *
 * ★ ここでランダムに選ばないこと。
 *   1回の返答は1人でも、質問のたびに話し手が入れ替わると、会話全体としては
 *   複数キャラの掛け合いに見える。しかも直近の会話は履歴としてモデルに渡るので、
 *   別のキャラの発言を手本にして掛け合いを続けようとする。
 *   話し手はユーザーが選ぶもので、選んでいなければ既定の1人に固定する。
 */
export function pickConsultCharacters(
  preferredCharacterId?: ConsultCharacterId | null
): ConsultCharacter[] {
  const preferredCharacter = preferredCharacterId
    ? CONSULT_CHARACTER_BY_ID.get(preferredCharacterId) ?? null
    : null;
  return [preferredCharacter ?? DEFAULT_CONSULT_CHARACTER];
}
