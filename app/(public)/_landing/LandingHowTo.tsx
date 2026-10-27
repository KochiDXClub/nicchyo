import { PageContainer } from "@/components/ui";
import { BannerScreen, ConsultScreen, MapScreen } from "./HowToScreens";
import InView from "./InView";
import SectionHeading from "./SectionHeading";

const STEPS = [
  { no: "01", title: "地図でさがす", Screen: MapScreen, aria: "地図で「芋天」と入れると、その屋台だけが残り、下にお店のカードが出る" },
  { no: "02", title: "お店をひらく", Screen: BannerScreen, aria: "お店を押すと、写真と情報の大きなバナーがひらく" },
  { no: "03", title: "にちよさんに聞く", Screen: ConsultScreen, aria: "にちよさんに聞くと、答えとおすすめのお店が出る" },
] as const;

/**
 * nicchyoの使い方！ 動く3つのスマホ画面（地図・お店のバナー・相談）を並べ、説明は添えない。
 * 画面は本番の形に合わせた見本（HowToScreens）。表示の負担を軽くするため、画面の外では動きを止める
 */
export default function LandingHowTo() {
  return (
    <section aria-labelledby="landing-howto" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <SectionHeading id="landing-howto">nicchyoの使い方！</SectionHeading>
        <ol className="mt-8 grid gap-14 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ no, title, Screen, aria }, index) => (
            <li key={no} className="relative flex flex-col items-center text-center">
              <span aria-hidden className="font-display text-[2.75rem] leading-none text-amber-400 [text-shadow:3px_3px_0_#fff1c9]">
                {no}
              </span>
              <h3 className="mt-1.5 text-[19px] font-black text-nicchyo-ink">{title}</h3>
              <InView className="landing-phone landing-demo mt-4" >
                <div role="img" aria-label={aria}>
                  <Screen />
                </div>
              </InView>
              {/* 次の画面へ向かう、手描きの点線の矢印（広い画面だけ） */}
              {index < STEPS.length - 1 ? (
                <svg viewBox="0 0 100 60" aria-hidden className="absolute -right-12 top-[10.5rem] hidden h-[3.4rem] w-[5.6rem] md:block">
                  <path d="M6 44C22 6 62 4 88 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="1 7" className="text-amber-900" />
                  <path d="M88 30L76 28M88 30L84 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-900" />
                </svg>
              ) : null}
            </li>
          ))}
        </ol>
      </PageContainer>
    </section>
  );
}
