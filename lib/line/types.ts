/**
 * LINE Messaging API Webhook & Message Types
 */

export interface LineWebhookPayload {
  destination: string;
  events: LineWebhookEvent[];
}

export type LineWebhookEvent =
  | LineMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LinePostbackEvent;

export interface LineEventBase {
  mode: "active" | "standby";
  timestamp: number;
  source: LineEventSource;
  webhookEventId: string;
  deliveryContext: {
    isRedelivery: boolean;
  };
}

export type LineEventSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export interface LineMessageEvent extends LineEventBase {
  type: "message";
  replyToken: string;
  message: LineMessageContent;
}

export type LineMessageContent =
  | LineTextMessageContent
  | LineImageMessageContent
  | LineStickerMessageContent
  | LineLocationMessageContent
  | LineOtherMessageContent;

export interface LineTextMessageContent {
  id: string;
  type: "text";
  text: string;
  emojis?: Array<{
    index: number;
    length: number;
    productId: string;
    emojiId: string;
  }>;
}

export interface LineImageMessageContent {
  id: string;
  type: "image";
  contentProvider: {
    type: "line" | "external";
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
}

export interface LineStickerMessageContent {
  id: string;
  type: "sticker";
  packageId: string;
  stickerId: string;
}

export interface LineLocationMessageContent {
  id: string;
  type: "location";
  title?: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface LineOtherMessageContent {
  id: string;
  type: "video" | "audio" | "file";
}

export interface LineFollowEvent extends LineEventBase {
  type: "follow";
  replyToken: string;
}

export interface LineUnfollowEvent extends LineEventBase {
  type: "unfollow";
}

export interface LinePostbackEvent extends LineEventBase {
  type: "postback";
  replyToken: string;
  postback: {
    data: string;
    params?: Record<string, string>;
  };
}

export type LineOutgoingMessage =
  | LineTextOutgoingMessage
  | LineFlexOutgoingMessage;

export interface LineQuickReplyItem {
  type: "action";
  action: {
    type: "message" | "uri" | "postback";
    label: string;
    text?: string;
    uri?: string;
    data?: string;
  };
}

export interface LineTextOutgoingMessage {
  type: "text";
  text: string;
  quickReply?: {
    items: LineQuickReplyItem[];
  };
}

export interface LineFlexOutgoingMessage {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
}
