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
};
