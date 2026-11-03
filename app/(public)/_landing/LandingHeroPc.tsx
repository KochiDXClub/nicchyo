import Link from "next/link";
import Image, { getImageProps } from "next/image";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/navigation/LanguageSwitcher";
import { PHOTOS } from "./content";
import NextSundayCalendar from "./NextSundayCalendar";
import type { LandingSunday } from "./upcomingSundays";
import "./landing.css";
import RevealOnScroll from "./RevealOnScroll";

/**
 * 広い画面（md以上）の最初の一画面。左に見出し・マップをみる・検索、右に日曜市の写真。
 * 写真の上には、「次の日曜市は、いつ？」と同じ日めくりカレンダーで、いちばん近い日曜の開催予定を載せる。
 * スマホは LandingHero の写真地の見た目を使う（この部品は md 未満では出ない）
 */
export default async function LandingHeroPc({ sundays, showOutingSupport = false }: { sundays: LandingSunday[]; showOutingSupport?: boolean }) {
  const t = await getT();
  const nav = [
    { href: "/calendar", label: t("開催のご案内") },
    { href: "/map?guide=menu", label: t("お手洗い・おでかけサポート") },
    { href: "/about", label: t("nicchyoについて") },
  ];
  const next = sundays[0];
  const { props: photoProps } = getImageProps({ src: PHOTOS.stalls.src, alt: t("屋台のテントが並ぶ、日曜市の通り"), width: PHOTOS.stalls.width, height: PHOTOS.stalls.height, sizes: "(min-width: 1344px) 640px, 50vw", loading: "eager", fetchPriority: "high" });

  return (
    <section aria-labelledby="landing-title-pc" className="hidden min-h-[100svh] flex-col bg-nicchyo-base md:flex">
      <header className="border-b border-line-warm">
        <div className="mx-auto flex h-20 max-w-[84rem] items-center justify-between gap-6 px-10">
          <div className="flex items-center gap-5">
            <Link href="/" aria-label="nicchyo">
              <Image src="/images/nicchyo-logo.webp" alt="nicchyo" width={516} height={240} priority className="h-12 w-auto" />
            </Link>
            <span aria-hidden className="h-9 w-px bg-line-warm" />
            <span className="text-xs leading-snug text-nicchyo-ink/70">
              {t("高知・日曜市を歩く")}
              <br />
              {t("デジタルマップ")}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <nav aria-label={t("トップページの案内")} className="flex items-center gap-8 text-sm font-bold text-nicchyo-ink/70">
              {nav.filter(item => item.href !== "/map?guide=menu" || showOutingSupport).map((item) => (
                <Link key={item.href} href={item.href} prefetch={false} className="transition hover:text-nicchyo-ink">
                  {item.label}
                </Link>
              ))}
            </nav>
            <LanguageSwitcher tone="page" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[84rem] flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-stretch gap-12 px-10 py-8 lg:gap-16">
        <RevealOnScroll when="enter" className="flex flex-col justify-center py-4">
          <h1 id="landing-title-pc" className="text-nicchyo-ink">
            <span className="sr-only">nicchyo：</span>
            <span className="block text-base font-bold tracking-wide text-nicchyo-ink/70 lg:text-lg">{t("高知高専生が開発した")}</span>
            <span className="mt-3 block text-5xl font-black leading-[1.2] tracking-wide lg:text-6xl">
              {t("日曜市の")}
              <br />
              {t("デジタルマップ")}
            </span>
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-nicchyo-ink/70">
            {t("お店を探して、気になる一軒へ。")}
            <br />
            {t("高知の日曜市を、地図といっしょに歩きませんか？")}
          </p>

          <Link href="/map" className={buttonClass({ size: "lg", className: "mt-9 h-16 w-full max-w-[36rem] justify-between px-7 text-xl shadow-float" })}>
            <span className="flex items-center gap-3">
              <MapPin aria-hidden className="h-6 w-6" />
              {t("マップをみる")}
            </span>
            <ArrowRight aria-hidden className="h-6 w-6" />
          </Link>

          {/* お店さがし。地図をひらき、検索バーにこの語を入れて絞り込む（/map?q=） */}
          <form
            action="/map"
            method="get"
            role="search"
            className="mt-4 flex w-full max-w-[36rem] min-w-0 items-center gap-2 rounded-chip bg-white py-2 pl-5 pr-2 shadow-chip ring-1 ring-line-warm"
          >
            <Search aria-hidden className="h-5 w-5 shrink-0 text-nicchyo-ink/40" />
            <label htmlFor="landing-search-pc" className="sr-only">
              {t("お店や品物をさがす")}
            </label>
            <input
              id="landing-search-pc"
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder={t("お店・品物から探す（例：芋天）")}
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/40"
            />
            <button type="submit" className={buttonClass({ variant: "ink", size: "sm", className: "h-11 px-6" })}>
              {t("さがす")}
            </button>
          </form>
        </RevealOnScroll>

        <RevealOnScroll when="enter" delayMs={120} className="relative aspect-[4/3] w-full self-center">
          <div className="absolute inset-0 overflow-hidden rounded-card shadow-lift">
            <picture>
              <source media="(max-width: 767px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
              <img {...photoProps} alt={photoProps.alt} className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          </div>
          {/* 写真の右上に、ちょっとはみ出して重ねる */}
          {next && (
            <Link
              href="/calendar"
              aria-label={t("開催カレンダーをひらく")}
              className="absolute -right-7 -top-9 z-10 origin-top-right scale-[0.8] transition-transform hover:-translate-y-1 motion-reduce:transition-none"
            >
              <NextSundayCalendar sunday={next} />
            </Link>
          )}
        </RevealOnScroll>
      </div>
    </section>
  );
}
