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

export function pickConsultCharacters(
  preferredCharacterId?: ConsultCharacterId | null
): ConsultCharacter[] {
  const preferredCharacter = preferredCharacterId
    ? CONSULT_CHARACTER_BY_ID.get(preferredCharacterId) ?? null
    : null;
  if (Math.random() < 0.05) {
    if (!preferredCharacter) return [...CONSULT_CHARACTERS];
    return [
      preferredCharacter,
      ...CONSULT_CHARACTERS.filter((character) => character.id !== preferredCharacter.id),
    ];
  }
  const pool = preferredCharacter
    ? CONSULT_CHARACTERS.filter((character) => character.id !== preferredCharacter.id)
    : [...CONSULT_CHARACTERS];
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }
  if (!preferredCharacter) {
    return shuffled.slice(0, 2);
  }
  return [preferredCharacter, ...shuffled.slice(0, 1)];
}
