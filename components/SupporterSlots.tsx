import Image from "next/image";
import Link from "next/link";
import { buildSupporterSlots, type Supporter } from "@/lib/support/supporters";

/**
 * 協賛・支援の掲載枠
 *
 * 埋まっている枠と空いている枠を同じ形・同じ大きさで並べる。空き枠を破線で出すのは、
 * 「協賛するとここに載る」を言葉で説明するより、枠を見せた方が早いから。
 * 埋まった枠と形が違うと、何が得られるかが伝わらない。
 */
export default function SupporterSlots({
  supporters,
  className = "",
}: {
  supporters?: Supporter[];
  className?: string;
}) {
  const slots = buildSupporterSlots(supporters);

  return (
    <div className={className}>
      <ul className="grid grid-cols-3 gap-2.5">
        {slots.map((slot, index) => (
          <li key={slot?.name ?? `empty-${index}`}>
            {slot ? <FilledSlot supporter={slot} /> : <EmptySlot />}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-nicchyo-ink/40">
        ここにお名前とロゴが入ります
      </p>
    </div>
  );
}

const SLOT_SHAPE = "flex h-20 items-center justify-center rounded-xl px-2 text-center";

function FilledSlot({ supporter }: { supporter: Supporter }) {
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

  if (supporter.url) {
    return (
      <Link
        href={supporter.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${shape} transition hover:ring-nicchyo-ink/20`}
      >
        {body}
      </Link>
    );
  }

  return <div className={shape}>{body}</div>;
}

function EmptySlot() {
  return (
    <div
      className={`${SLOT_SHAPE} border border-dashed border-nicchyo-ink/20`}
      aria-hidden
    />
  );
}
