/**
 * 店のAIキャラ。店ごとに見た目と口調を持ち、投稿にひとこと添える。
 * いまはデモ（/demo/story）だけが持つ。出店者が設定できるようになったら API からも返す。
 */
export type StoryCharacter = {
  /** キャラの名前（例: 「研ぎ師のてっちゃん」） */
  name: string;
  imageUrl: string;
  /** 投稿に添えるひとこと。店主の書いた本文（body）とは別に、キャラの吹き出しで出す */
  line: string;
};

export type StoryItem = {
  id: string;
  body: string | null;
  image_url: string;
  expires_at: string;
  created_at: string;
  vendor: {
    id: string;
    shop_name: string | null;
    shop_image_url: string | null;
    // 店舗詳細（/shops/[code]）へのリンク用。出店割当が無い場合は null。
    store_number: number | null;
  } | null;
  character?: StoryCharacter | null;
};
