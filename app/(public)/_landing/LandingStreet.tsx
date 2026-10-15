import "./landing.css";
import InView from "./InView";
import { STREET_CHIPS } from "./content";

const GROUP_WIDTH = 1600;
const HEIGHT = 300;

/**
 * 「日曜市にようこそ！」の屋台通り。高知城・オーテピア・並木・屋台・のぼりを描いた1枚の絵
 * （public/images/landing/art/street.svg）を2枚つないで、ゆっくり横に流す。
 * 綱からは「毎週日曜・約1.3km・およそ300店」の札がぶら下がり、絵と一緒に流れる。
 *
 * 表示の負担を軽くするため、絵は <img> 1枚（DOM に屋台を並べない）、動きは transform だけ、
 * 画面の外では止める（InView）。「動きを減らす」設定では止めた形で見せる。
 * 2枚目は見せかけのコピーなので、読み上げからは外す
 */
export default function LandingStreet() {
  return (
    <section aria-labelledby="landing-street" className="mt-12 overflow-hidden md:mt-16">
      <h2 id="landing-street" className="px-5 text-center font-display text-2xl text-nicchyo-ink md:text-3xl">
        日曜市にようこそ！
      </h2>
      <InView className="landing-street landing-fade-x relative mt-3 overflow-hidden" >
        <div className="relative mx-auto" style={{ height: HEIGHT }}>
          <div className="landing-marq absolute left-1/2 top-0 -ml-[800px]" style={{ height: HEIGHT }}>
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="relative shrink-0"
                style={{ width: GROUP_WIDTH, height: HEIGHT }}
                aria-hidden={copy === 1 ? true : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG（最適化の対象外）。大きな1枚を CSS で動かす */}
                <img
                  src="/images/landing/art/street.svg"
                  alt=""
                  width={GROUP_WIDTH}
                  height={HEIGHT}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full max-w-none"
                />
                {/* 札をぶら下げる綱 */}
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${GROUP_WIDTH} ${HEIGHT}`} aria-hidden>
                  <path d="M470 10Q740 66 1010 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-amber-900" />
                  <circle cx="470" cy="10" r="3" className="fill-amber-900" />
                  <circle cx="1010" cy="10" r="3" className="fill-amber-900" />
                </svg>
                <ul className="m-0 list-none p-0">
                  {STREET_CHIPS.map((chip) => (
                    <li
                      key={chip.id}
                      className="landing-swing absolute inline-flex -translate-x-1/2 items-baseline gap-1 whitespace-nowrap rounded-chip bg-white px-4 py-2 shadow-chip ring-1 ring-line-warm"
                      style={{ left: `${chip.left}%`, top: `${chip.top}%` }}
                    >
                      <span className="font-display text-lg text-nicchyo-ink">{chip.main}</span>
                      <span className="text-xs font-bold text-amber-700">{chip.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </InView>
    </section>
  );
}
