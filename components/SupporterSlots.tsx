import Image from "next/image";
import Link from "next/link";
import {
  assignSupporterColors,
  buildSupporterSlots,
  SUPPORTERS,
  type Supporter,
} from "@/lib/support/supporters";

/**
 * 協賛・支援の掲載枠
 *
 * 埋まっている枠と空いている枠を同じ形・同じ大きさで並べる。空き枠を破線で出すのは、
 * 「協賛するとここに載る」を言葉で説明するより、枠を見せた方が早いから。
 * 埋まった枠と形が違うと、何が得られるかが伝わらない。
 *
 * 金額を入れてある協賛には、枠の下に色と金額を添える。これがメーターの凡例も兼ねる
 * （メーターの塗りは色だけで人を区別しているので、名前と金額を並べた場所が要る）。
 */
export default function SupporterSlots({
  supporters = SUPPORTERS,
  className = "",
}: {
  supporters?: Supporter[];
  className?: string;
}) {
  const slots = buildSupporterSlots(supporters);
  const colors = assignSupporterColors(supporters);

  return (
    <div className={className}>
      <ul className="grid grid-cols-3 gap-2.5">
        {slots.map((slot, index) => (
          <li key={slot?.name ?? `empty-${index}`}>
            {slot ? (
              <FilledSlot supporter={slot} color={colors[index]} />
            ) : (
              // 最初の空き枠にだけ言葉を入れる。空欄が3つ並ぶより、1つ目が
              // 募集中だと分かる方が、何を差し上げられるかが伝わる
              <EmptySlot isFirstOpen={index === supporters.length} />
            )}
          </li>
        ))}
      </ul>
      {/* 掲載枠の説明より、まず礼を先に置く。枠の案内は空きが残っているときだけでよい */}
      <p className="mt-3 text-[12px] leading-relaxed text-nicchyo-ink/40">
        {supporters.length > 0 && "ご支援いただき、ありがとうございます。"}
        {slots.some((slot) => slot === null) && "この枠に、お名前またはロゴを掲載いたします"}
      </p>
    </div>
  );
}

const SLOT_SHAPE = "flex h-20 items-center justify-center rounded-xl px-2 text-center";

function FilledSlot({ supporter, color }: { supporter: Supporter; color: string | null }) {
  const body = supporter.logoUrl ? (
    <Image
      src={supporter.logoUrl}
      alt={supporter.name}
      width={160}
      height={80}
      className="max-h-12 w-auto object-contain"
    />
  ) : (
    <span className="text-[13px] font-bold leading-snug text-nicchyo-ink">{supporter.name}</span>
  );

  const shape = `${SLOT_SHAPE} bg-white ring-1 ring-nicchyo-ink/[0.08]`;

  return (
    <>
      {supporter.url ? (
        <Link
          href={supporter.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${shape} transition hover:ring-nicchyo-ink/20`}
        >
          {body}
        </Link>
      ) : (
        <div className={shape}>{body}</div>
      )}

      {/* 金額を出している協賛だけ。メーターのどの色がこの人かを、ここで結びつける */}
      {supporter.amountJpy !== undefined && color !== null && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] tabular-nums text-nicchyo-ink/50">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {supporter.amountJpy.toLocaleString("ja-JP")}円
        </p>
      )}
    </>
  );
}

function EmptySlot({ isFirstOpen = false }: { isFirstOpen?: boolean }) {
  if (!isFirstOpen) {
    return <div className={`${SLOT_SHAPE} border border-dashed border-nicchyo-ink/20`} aria-hidden />;
  }
  return (
    <div className={`${SLOT_SHAPE} border border-dashed border-amber-600/45 bg-amber-50/40`}>
      <span className="text-[11.5px] font-bold leading-snug text-amber-700/85">
        募集して
        <br />
        おります
      </span>
    </div>
  );
}
