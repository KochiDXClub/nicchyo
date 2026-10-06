import type { ReactNode } from "react";
import type { TourScene } from "@/lib/vendor/tours";
import type { SceneProps } from "../primitives";
import { AnalyticsHeroScene, AnalyticsQuestionsScene } from "./analytics";
import { ChatScene } from "./chat";
import { ClosedDayScene, HomeActionsScene } from "./home";
import { InquiriesSendScene } from "./inquiries";
import { MemoryLearnScene, MemoryToggleScene } from "./memory";
import { PostPeriodScene, PostPhotoScene, PostsRepostScene } from "./post";
import { StoreGroupsScene } from "./store";

/**
 * デモの一覧。steps は工程の数で、lib/vendor/tours.ts のスライドの字幕（captions）の数と同じにする。
 * 新しいデモを足したら、TourScene（lib/vendor/tours.ts）にも名前を足す。
 */
export const SCENES: Record<TourScene, { steps: number; render: (props: SceneProps) => ReactNode }> = {
  "chat-hours": { steps: 4, render: (props) => <ChatScene {...props} variant="hours" /> },
  "chat-payment": { steps: 4, render: (props) => <ChatScene {...props} variant="payment" /> },
  "home-actions": { steps: 3, render: (props) => <HomeActionsScene {...props} /> },
  "closed-day": { steps: 3, render: (props) => <ClosedDayScene {...props} /> },
  "store-groups": { steps: 3, render: (props) => <StoreGroupsScene {...props} /> },
  "post-photo": { steps: 4, render: (props) => <PostPhotoScene {...props} /> },
  "post-period": { steps: 3, render: (props) => <PostPeriodScene {...props} /> },
  "posts-repost": { steps: 3, render: (props) => <PostsRepostScene {...props} /> },
  "analytics-hero": { steps: 3, render: (props) => <AnalyticsHeroScene {...props} /> },
  "analytics-questions": { steps: 3, render: (props) => <AnalyticsQuestionsScene {...props} /> },
  "memory-learn": { steps: 3, render: (props) => <MemoryLearnScene {...props} /> },
  "memory-toggle": { steps: 3, render: (props) => <MemoryToggleScene {...props} /> },
  "inquiries-send": { steps: 4, render: (props) => <InquiriesSendScene {...props} /> },
};
