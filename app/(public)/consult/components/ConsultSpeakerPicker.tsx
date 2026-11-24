import { X } from "lucide-react";
import { useT } from "@/lib/i18n/LocaleContext";
import { CONSULT_CHARACTERS, type ConsultCharacterId } from "../data/consultCharacters";
import ConsultSheet from "./ConsultSheet";

export default function ConsultSpeakerPicker({ selected, onPick, onClose }: {
  selected: ConsultCharacterId;
  onPick: (id: ConsultCharacterId) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <ConsultSheet label={t("だれに聞く？")} onClose={onClose}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-amber-900">{t("だれに聞く？")}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("閉じる")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200 text-amber-800"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {CONSULT_CHARACTERS.map((character) => {
          const isCurrent = character.id === selected;
          return (
            <li key={character.id}>
              <button
                type="button"
                aria-pressed={isCurrent}
                onClick={() => onPick(character.id)}
                className={`flex w-full items-center gap-3 rounded-card border p-3 text-left transition active:scale-[0.99] ${
                  isCurrent
                    ? "border-amber-400 bg-amber-50"
                    : "border-amber-100 bg-white"
                }`}
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card border border-amber-100 bg-amber-50">
                  {/* 一覧では next/image の最適化より、行の切り抜き指定をそのまま使う方が崩れない */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={character.image}
                    alt=""
                    className={`h-full w-full object-cover ${character.imageScale}`}
                    style={{ objectPosition: character.imagePosition }}
                    draggable={false}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-nicchyo-ink">
                    {t(character.name)}
                  </span>
                  <span className="mt-0.5 block text-xs text-nicchyo-ink/70">
                    {t(character.subtitle)}
                  </span>
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-[11px] font-bold text-white">
                    {t("いま")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ConsultSheet>
  );
}
