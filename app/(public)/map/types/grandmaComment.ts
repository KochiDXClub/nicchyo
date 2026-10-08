export type GrandmaCommentGenre =
  | 'monologue'
  | 'event'
  | 'notice'
  | 'tutorial';

export interface GrandmaComment {
  id: string;
  text: string;
  genre: GrandmaCommentGenre;
  /**
   * Optional icon or emoji to distinguish the genre (speech bubble badge)
   */
  icon?: string;
  /**
   * Optional link for deep navigation (e.g., map/events)
   */
  link?: {
    href: string;
    label: string;
  };
  /**
   * Optional shop id for map highlighting.
   */
  shopId?: number;
}
