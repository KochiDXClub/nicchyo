import { ArrowDown, ArrowRight } from "lucide-react";
import { HANDOVER_NOTE, TEAM_FLOW } from "@/lib/support/team";

/**
 * 運営体制の図
 *
 * 名前を並べた組織図にはしない。協賛を検討する側が知りたいのは
 * 「誰がいるか」より「お金がどこに入って、最後に誰へ届くのか」なので、
 * 支える人 → 運営する人 → 届く先 の流れで出す。
 *
 * 真ん中（運営）だけ面を立てて、両側が外の人だと分かるようにする。
 * 狭い画面では縦に積み、矢印も下向きに差し替える。
 */

export default function TeamStructure() {
  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-4">
        {TEAM_FLOW.map((column, index) => (
          <div key={column.key} className="contents">
            <div
              className={
                column.key === "operate"
                  ? "rounded-[18px] bg-white p-5 shadow-[0_1px_2px_rgba(58,58,58,0.04),0_14px_32px_-26px_rgba(146,64,14,0.5)] ring-1 ring-nicchyo-ink/[0.08]"
                  : "rounded-[18px] p-5 ring-1 ring-nicchyo-ink/[0.07]"
              }
            >
              <p
                className={`text-[11px] font-bold tracking-[0.14em] ${
                  column.key === "operate" ? "text-amber-700" : "text-nicchyo-ink/40"
                }`}
              >
                {column.label}
              </p>
              <ul className="mt-4 space-y-3.5">
                {column.members.map((member) => (
                  <li key={member.role}>
                    <span className="block text-[14px] font-bold leading-snug">{member.role}</span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-nicchyo-ink/50">
                      {member.doing}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 列と列のあいだ。横並びのときは右向き、縦積みのときは下向き */}
            {index < TEAM_FLOW.length - 1 && (
              <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden>
                <ArrowDown className="h-4 w-4 text-nicchyo-ink/25 lg:hidden" />
                <ArrowRight className="hidden h-4 w-4 text-nicchyo-ink/25 lg:block" />
              </div>
            )}
          </div>
        ))}
      </div>

      {HANDOVER_NOTE && (
        <p className="mt-7 border-t border-nicchyo-ink/[0.07] pt-6 text-[13px] leading-[1.95] text-nicchyo-ink/55">
          {HANDOVER_NOTE}
        </p>
      )}
    </div>
  );
}
