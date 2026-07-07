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
  } | null;
};
