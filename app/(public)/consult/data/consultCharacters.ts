export type ConsultCharacterId =
  | "nichiyosan"
  | "yoichisan"
  | "miraikun"
  | "yosakochan";

/**
 * 相談ページを開いたとき・話し手を選び直したときに言う、最初のひとこと。
 *
 * AI の返答ではなく画面の文言なので、ここに直接置く（API を待たずに出したいし、
 * 待たせて出すものでもない）。人ごとに口調が違うので、呼びかけも人ごとに持つ。
 */
export type ConsultGreetingScript = {
  /** 時間帯ごとの呼びかけ */
  morning: string;
  afternoon: string;
  evening: string;
  /** 呼びかけのあとに続くひとこと。選ばれるたびに次の1つへ進む */
  lines: readonly string[];
};

export type ConsultCharacter = {
  id: ConsultCharacterId;
  name: string;
  subtitle: string;
  image: string;
  imageScale: string;
  imagePosition: string;
  greeting: ConsultGreetingScript;
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
    // 日曜市の大ベテラン。土佐弁で、ゆっくり構える
    greeting: {
      morning: "おはよう。",
      afternoon: "こんにちは。",
      evening: "こんばんは。",
      lines: [
        "今日はええ風やねぇ、ゆっくり歩きや。",
        "この通りのことなら、なんでも聞いてや。",
        "旬のもんが知りたかったら、わしに聞きや。",
        "人が多いときは、端の道が歩きやすいよ。",
        "困ったことがあったら、遠慮せんと言うてね。",
        "はじめてでも大丈夫。ちゃんと案内するきに。",
      ],
    },
  },
  {
    id: "yoichisan",
    name: "よういちさん",
    subtitle: "日曜市を支えてきたジェントルマン",
    image: "/images/characters/ojichan.png",
    imageScale: "scale-125",
    imagePosition: "center 14%",
    // 市を支えてきたジェントルマン。落ち着いた丁寧語
    greeting: {
      morning: "おはようございます。",
      afternoon: "こんにちは。",
      evening: "こんばんは。",
      lines: [
        "ようこそ日曜市へ。ご案内しますよ。",
        "お探しのものがあれば、遠慮なくどうぞ。",
        "この市は三百年続いております。ゆっくり歩いてみてください。",
        "気になるお店があれば、お教えします。",
        "混み合う前に回るのが、うまい歩き方です。",
        "何から見ましょうか。お付き合いしますよ。",
      ],
    },
  },
  {
    id: "miraikun",
    name: "みらいくん",
    subtitle: "さわやかで希望あふれる高知の青年",
    image: "/images/characters/onisan.png",
    imageScale: "scale-125",
    imagePosition: "center 12%",
    // さわやかな高知の青年。明るい敬語
    greeting: {
      morning: "おはようございます！",
      afternoon: "こんにちは！",
      evening: "こんばんは！",
      lines: [
        "日曜市、はじめてですか？ 案内しますね。",
        "気になること、どんどん聞いてください！",
        "今日はどこから回りましょうか。",
        "食べ歩きなら、いいお店を知ってますよ。",
        "写真映えする場所も紹介できます！",
        "歩きながらでも聞いてくださいね。",
      ],
    },
  },
  {
    id: "yosakochan",
    name: "よさこちゃん",
    subtitle: "明るく華やかで、みんなを元気づけてくれる土佐っ子",
    image: "/images/characters/onesan.png",
    imageScale: "scale-125",
    imagePosition: "center 22%",
    // 明るく華やかな土佐っ子。元気のいい土佐弁
    greeting: {
      morning: "おはよー！",
      afternoon: "こんにちは！",
      evening: "こんばんはー！",
      lines: [
        "よう来たね！ 今日はめいっぱい楽しんでいこ！",
        "なんでも聞いて！ 一緒に回ろうや。",
        "おいしいもん、ようけあるきね！",
        "迷うたら声かけて。案内するき！",
        "せっかくやき、端から端まで歩いてみいや。",
        "今日はどこ行く？ わたしが決めてもええ？",
      ],
    },
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
