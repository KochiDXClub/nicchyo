import { AboutIconName } from "./AboutIcon";
import { currentVersion, type VersionEntry } from "./versions";
import { GITHUB_REPO_URL } from "@/lib/siteLinks";
import { siteText } from "@/lib/siteCopy";

export type CharacterItem = {
  img: string;
  name: string;
  role: string;
  desc: string;
  bg: string;
};

export type AchievementItem = {
  emoji: string;
  label: string;
  value: string;
  sub: string;
  /** AboutStory 側で実データに差し替える対象を識別するキー（任意） */
  dynamicKey?: "weeklyVisitors";
};

/** 項目の先頭に置く印。絵文字か、サイトの他の画面と同じ線画アイコン（lucide）のどちらか */
export type PainPointIconName = "bug" | "lightbulb" | "code";

export type PainPointItem = {
  emoji?: string;
  icon?: PainPointIconName;
  text: string;
};

export type SlideRichContent =
  | { type: "supporters" }
  | { type: "characters"; items: CharacterItem[] }
  | { type: "achievements"; items: AchievementItem[] }
  | { type: "painPoints"; items: PainPointItem[] }
  | { type: "version"; entry: VersionEntry };

export type AboutSlide = {
  id: string;
  title: string;
  description: string;
  iconName?: AboutIconName;
  richContent?: SlideRichContent;
  action?: {
    label: string;
    href: string;
    primary?: boolean;
    /** サイトの外（GitHub など）。新しいタブで開く */
    external?: boolean;
  };
};

// 文言はスプレッドシートで編集する（docs/SITE_COPY.md）。スライドの順番・アイコン・リンク先・項目の数はここで決める
export const aboutSlides: AboutSlide[] = [
  {
    id: "intro",
    title: siteText("about.intro.title"),
    description: siteText("about.intro.description"),
  },
  {
    id: "painPoints",
    title: siteText("about.painPoints.title"),
    description: siteText("about.painPoints.description"),
    richContent: {
      type: "painPoints",
      items: [
        { emoji: "🗺️", text: siteText("about.painPoints.1") },
        { emoji: "🔍", text: siteText("about.painPoints.2") },
        { emoji: "😶", text: siteText("about.painPoints.3") },
      ],
    },
  },
  {
    id: "concept",
    title: siteText("about.concept.title"),
    description: siteText("about.concept.description"),
    iconName: "route",
  },
  {
    id: "map",
    title: siteText("about.map.title"),
    description: siteText("about.map.description"),
    iconName: "map",
    action: {
      label: siteText("about.map.action"),
      href: "/map",
      primary: true,
    },
  },
  {
    id: "search",
    title: siteText("about.search.title"),
    description: siteText("about.search.description"),
    iconName: "spark",
    action: {
      label: siteText("about.search.action"),
      href: "/search",
    },
  },
  {
    id: "consult",
    title: siteText("about.consult.title"),
    description: siteText("about.consult.description"),
    richContent: {
      type: "characters",
      items: [
        { img: "/images/obaasan_transparent.png", name: siteText("about.consult.1.name"), role: siteText("about.consult.1.role"), desc: siteText("about.consult.1.desc"), bg: "bg-orange-50" },
        { img: "/images/characters/ojichan.png", name: siteText("about.consult.2.name"), role: siteText("about.consult.2.role"), desc: siteText("about.consult.2.desc"), bg: "bg-sky-50" },
        { img: "/images/characters/onisan.png", name: siteText("about.consult.3.name"), role: siteText("about.consult.3.role"), desc: siteText("about.consult.3.desc"), bg: "bg-green-50" },
        { img: "/images/characters/onesan.png", name: siteText("about.consult.4.name"), role: siteText("about.consult.4.role"), desc: siteText("about.consult.4.desc"), bg: "bg-pink-50" },
      ],
    },
    action: {
      label: siteText("about.consult.action"),
      href: "/consult",
    },
  },
  {
    id: "story",
    title: siteText("about.story.title"),
    description: siteText("about.story.description"),
    iconName: "notebook",
    action: {
      label: siteText("about.story.action"),
      href: "/story",
    },
  },
  {
    id: "calendar",
    title: siteText("about.calendar.title"),
    description: siteText("about.calendar.description"),
    iconName: "event",
    action: {
      label: siteText("about.calendar.action"),
      href: "/calendar",
    },
  },
  {
    id: "facilities",
    title: siteText("about.facilities.title"),
    description: siteText("about.facilities.description"),
    iconName: "compass",
    action: {
      label: siteText("about.facilities.action"),
      href: "/map?guide=menu",
    },
  },
  {
    id: "achievements",
    title: siteText("about.achievements.title"),
    description: siteText("about.achievements.description"),
    richContent: {
      type: "achievements",
      items: [
        { emoji: "🏆", label: siteText("about.achievements.1.label"), value: siteText("about.achievements.1.value"), sub: siteText("about.achievements.1.sub") },
        { emoji: "🤝", label: siteText("about.achievements.2.label"), value: siteText("about.achievements.2.value"), sub: siteText("about.achievements.2.sub") },
        { emoji: "👥", label: siteText("about.achievements.3.label"), value: siteText("about.achievements.3.value"), sub: siteText("about.achievements.3.sub"), dynamicKey: "weeklyVisitors" },
      ],
    },
    action: {
      label: siteText("about.achievements.action"),
      href: "/activities",
    },
  },
  {
    id: "supporters",
    title: siteText("about.supporters.title"),
    description: siteText("about.supporters.description"),
    richContent: { type: "supporters" },
    action: {
      label: siteText("about.supporters.action"),
      href: "/support",
    },
  },
  {
    id: "team",
    title: siteText("about.team.title"),
    description: siteText("about.team.description"),
    iconName: "discover",
  },
  {
    id: "opensource",
    title: siteText("about.opensource.title"),
    description: siteText("about.opensource.description"),
    richContent: {
      type: "painPoints",
      items: [
        { icon: "bug", text: siteText("about.opensource.1") },
        { icon: "lightbulb", text: siteText("about.opensource.2") },
        { icon: "code", text: siteText("about.opensource.3") },
      ],
    },
    action: {
      label: siteText("about.opensource.action"),
      href: GITHUB_REPO_URL,
      external: true,
    },
  },
  {
    id: "roadmap",
    title: siteText("about.roadmap.title"),
    description: siteText("about.roadmap.description"),
    richContent: {
      type: "painPoints",
      items: [
        { emoji: "🗺️", text: siteText("about.roadmap.1") },
        { emoji: "📈", text: siteText("about.roadmap.2") },
        { emoji: "🌱", text: siteText("about.roadmap.3") },
      ],
    },
  },
  {
    // 見出しと説明はリリースノート（versions.ts）から作るのでシートの対象外
    id: "version",
    title: `nicchyo ${currentVersion.version}`,
    description: currentVersion.title,
    richContent: {
      type: "version",
      entry: currentVersion,
    },
    action: {
      label: siteText("about.version.action"),
      href: "/about/versions",
    },
  },
  {
    id: "cta",
    title: siteText("about.cta.title"),
    description: siteText("about.cta.description"),
    iconName: "map",
    action: {
      label: siteText("about.cta.action"),
      href: "/map",
      primary: true,
    },
  },
];
