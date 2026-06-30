export type StoryItem = {
  id: string;
  image_url: string;
  caption: string | null;
  posted_at: string;
  expires_at: string;
  vendor: {
    id: string;
    shop_name: string | null;
    shop_image_url: string | null;
  } | null;
};
