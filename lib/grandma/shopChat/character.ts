import {
  CONSULT_CHARACTER_BY_ID,
  DEFAULT_CONSULT_CHARACTER,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "@/app/(public)/consult/data/consultCharacters";
import type { AiPromptSet } from "@/lib/grandma/prompts/promptKeys";

// お店の相談で話すキャラクター。
//
// 「このお店では誰が答えるか」を決めるのはここ1か所だけにする。
// いまは全店が既定のにちよさん。出店者が選んだキャラ（テンプレ・承認ずみのオリジナル）を
// 引けるようになったら、characterId の渡し先（resolveShopCharacterId）だけを差し替える。

/** 画面に出す分（人格の文面はサーバーの外に出さない） */
export type ShopChatCharacterView = Pick<
  ConsultCharacter,
  "id" | "name" | "subtitle" | "image" | "imageScale" | "imagePosition" | "greeting"
>;

export type ShopChatCharacter = {
  view: ShopChatCharacterView;
  /** AIに渡す人格の文面 */
  profile: string;
};

/**
 * このお店のキャラの id を返す。選んでいない・使えないときは null（既定のキャラになる）。
 * TODO: 出店者のキャラ設定（テンプレ選択・承認ずみのオリジナル）を読む
 */
export function resolveShopCharacterId(_vendorId: string | undefined): ConsultCharacterId | null {
  return null;
}

export function resolveShopCharacter(
  characterId: ConsultCharacterId | null,
  prompts: AiPromptSet
): ShopChatCharacter {
  const character = (characterId ? CONSULT_CHARACTER_BY_ID.get(characterId) : null) ?? DEFAULT_CONSULT_CHARACTER;
  const { id, name, subtitle, image, imageScale, imagePosition, greeting } = character;
  return {
    view: { id, name, subtitle, image, imageScale, imagePosition, greeting },
    profile: prompts[`consult.character.${id}.profile`] ?? "",
  };
}
