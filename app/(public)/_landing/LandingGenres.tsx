import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { getShopCategoryColor } from "../map/config/shopCategories";
import { GENRES } from "./content";
import SectionHeading from "./SectionHeading";

/**
 * 「何に興味ある？」。店舗カテゴリ7つを、白いタイルで並べる。
 * 押すと地図をひらき、そのカテゴリで絞り込む（/map?category=）。絵は public/images/landing/art/
 */
export default function LandingGenres() {
  return (
    <section aria-labelledby="landing-genres" className="mt-16 md:mt-20">
      <PageContainer width="wide">
        <SectionHeading id="landing-genres">何に興味ある？</SectionHeading>
        <ul className="mt-6 grid grid-cols-4 gap-3 md:grid-cols-7">
          {GENRES.map(({ category, art }) => (
            <li key={category}>
              <Link
                href={`/map?category=${encodeURIComponent(category)}`}
                className="flex h-full flex-col items-center gap-1.5 rounded-card bg-white px-1.5 py-3 text-center text-[10px] font-bold leading-tight tracking-tight text-nicchyo-ink shadow-card ring-1 ring-line transition hover:ring-2 motion-reduce:transition-none md:text-[13px]"
                // 押せる合図の縁は、地図の屋台と同じカテゴリ色
                style={{ ["--tw-ring-color" as string]: `${getShopCategoryColor(category)}66` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG（最適化の対象外） */}
                <img src={art} alt="" width={64} height={64} className="h-12 w-12 md:h-14 md:w-14" />
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}
