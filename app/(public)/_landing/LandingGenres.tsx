import Image from "next/image";
import Link from "next/link";
import {
  Carrot,
  Palette,
  ShoppingBag,
  Sprout,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageContainer } from "@/components/ui";
import {
  getShopCategoryColor,
  type ShopCategory,
} from "../map/config/shopCategories";
import { GENRES } from "./content";
import SectionHeading from "./SectionHeading";

const GENRE_ICONS: Record<ShopCategory, LucideIcon> = {
  食材: Carrot,
  食べ物: UtensilsCrossed,
  "道具・工具": Wrench,
  "植物・苗": Sprout,
  "手作り・工芸": Palette,
  生活雑貨: ShoppingBag,
  アクセサリー: Palette,
};

/**
 * ジャンルからさがす。押すと地図をひらき、そのカテゴリで絞り込む（/map?category=）。
 * 出店者が登録した、そのカテゴリの店の写真を丸く見せる（無いカテゴリは、地図の屋台と同じカテゴリ色を薄く敷いたアイコン）。文字はジャンル名だけ
 */
export default function LandingGenres({
  photos,
}: {
  photos: Record<string, { image: string; name: string }>;
}) {
  return (
    <section aria-labelledby="landing-genres" className="mt-14">
      <PageContainer width="wide">
        <SectionHeading id="landing-genres" label="GENRE">
          ジャンルからさがす
        </SectionHeading>
        <ul className="mt-5 grid grid-cols-3 gap-2.5 md:grid-cols-6">
          {GENRES.map(({ label, category }) => {
            const Icon = GENRE_ICONS[category];
            const color = getShopCategoryColor(category);
            const photo = photos[category];
            return (
              <li key={category}>
                <Link
                  href={`/map?category=${encodeURIComponent(category)}`}
                  className="flex flex-col items-center gap-2 rounded-card bg-white px-2 py-4 text-[13px] font-bold text-nicchyo-ink shadow-card ring-1 ring-line transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {photo ? (
                    <Image
                      src={photo.image}
                      alt=""
                      width={96}
                      height={96}
                      className="h-14 w-14 rounded-full object-cover ring-2"
                      style={{ ["--tw-ring-color" as string]: color }}
                    />
                  ) : (
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      // カテゴリ色はデータ（shopCategories）から選ぶので、Tailwind のクラスにできない
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      <Icon aria-hidden className="h-6 w-6" />
                    </span>
                  )}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </PageContainer>
    </section>
  );
}
