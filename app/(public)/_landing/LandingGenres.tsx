import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { getShopCategoryColor, resolveStallColors, type ShopCategory } from "../map/config/shopCategories";
import { GENRES } from "./content";

const SCALLOP_COUNT = 6;

/**
 * 屋台のひさし（縞と、垂れ下がる半円の縁飾り）。色は地図の屋台と同じカテゴリ色（濃い／薄い の交互）。
 * 色は店舗カテゴリのデータから決まるので、Tailwind のクラスではなく fill に直接渡す
 */
function Awning({ category }: { category: ShopCategory }) {
  const { base, light } = resolveStallColors(category);
  const width = 120 / SCALLOP_COUNT;
  return (
    <svg viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden className="block h-[26px] w-[calc(100%+12px)] -mx-1.5">
      {Array.from({ length: SCALLOP_COUNT }, (_, i) => {
        const fill = i % 2 === 0 ? base : light;
        const x = i * width;
        return (
          <g key={i} fill={fill}>
            <rect x={x} y={0} width={width} height={18} />
            <path d={`M${x} 18a${width / 2} 10 0 0 0 ${width} 0Z`} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 「何に興味ある？」。店舗カテゴリ7つを、屋台のひさし付きのタイルで並べる。
 * 押すと地図をひらき、そのカテゴリで絞り込む（/map?category=）。絵は public/images/landing/art/
 */
export default function LandingGenres() {
  return (
    <section aria-labelledby="landing-genres" className="mt-16 md:mt-20">
      <PageContainer width="wide">
        <h2 id="landing-genres" className="font-display text-2xl leading-snug text-nicchyo-ink md:text-3xl">
          何に興味ある？
        </h2>
        <ul className="mt-6 grid grid-cols-4 gap-3 md:grid-cols-7">
          {GENRES.map(({ category, art }, index) => (
            <li key={category} className={cn(index % 2 === 0 ? "md:-rotate-1" : "md:rotate-1", "transition-transform hover:rotate-0 motion-reduce:transition-none")}>
              <Link
                href={`/map?category=${encodeURIComponent(category)}`}
                className="group flex h-full flex-col items-center gap-1.5 overflow-hidden rounded-card bg-white px-1.5 pb-3 text-center text-[10px] font-bold leading-tight tracking-tight text-nicchyo-ink shadow-card ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:text-[13px]"
                // 屋台の屋根と同じ色の細い縁（hover で見える）
                style={{ ["--tw-ring-color" as string]: `${getShopCategoryColor(category)}33` }}
              >
                <Awning category={category} />
                {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG（最適化の対象外） */}
                <img src={art} alt="" width={64} height={64} className="mt-1.5 h-12 w-12 transition-transform group-hover:-translate-y-0.5 group-hover:scale-110 md:h-16 md:w-16 motion-reduce:transition-none" />
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}
