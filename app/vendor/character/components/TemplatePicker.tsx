"use client";

import { Check, Lock } from "lucide-react";
import { Badge, Button, Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { TEMPLATE_CHARACTERS } from "@/lib/vendor/character/templates";
import type { TemplateCharacter } from "@/lib/vendor/character/types";
import CharacterAvatar from "./CharacterAvatar";

type Props = {
  selectedId: string;
  /** いま、お客さんに出ているキャラ */
  activeId: string | null;
  onSelect: (id: string) => void;
  onUse: (character: TemplateCharacter) => void;
};

/** テンプレキャラ10人から選ぶ。話し方は運営が調整済みで、ここでは変えられない */
export default function TemplatePicker({ selectedId, activeId, onSelect, onUse }: Props) {
  const selected = TEMPLATE_CHARACTERS.find((c) => c.id === selectedId) ?? TEMPLATE_CHARACTERS[0];
  const isActive = selected.id === activeId;

  return (
    <div>
      <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-nicchyo-ink/55">
        <Lock size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
        日曜市の世界観をそろえるため、テンプレのキャラの話し方は変えられません。
      </p>

      <ul aria-label="テンプレキャラ" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TEMPLATE_CHARACTERS.map((character) => {
          const picked = character.id === selected.id;
          return (
            <li key={character.id}>
              <button
                type="button"
                aria-pressed={picked}
                onClick={() => onSelect(character.id)}
                className={cn(
                  "flex h-full w-full flex-col items-center gap-2 rounded-card bg-white p-3 text-center shadow-card ring-1 transition active:scale-95 motion-reduce:active:scale-100",
                  picked ? "ring-2 ring-amber-500" : "ring-line"
                )}
              >
                <CharacterAvatar name={character.name} image={character.image} />
                <span className="text-sm font-bold text-nicchyo-ink">{character.name}</span>
                {character.id === activeId && <Badge variant="amber">使用中</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      <Surface elevation="lifted" className="mt-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <CharacterAvatar name={selected.name} image={selected.image} />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-nicchyo-ink">{selected.name}</h3>
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">{selected.tagline}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        <p className="mt-3 rounded-btn bg-nicchyo-base px-4 py-3 text-sm leading-relaxed text-nicchyo-ink">
          「{selected.greeting}」
        </p>
        <Button className="mt-4 w-full" disabled={isActive} onClick={() => onUse(selected)}>
          <Check size={18} aria-hidden="true" />
          {isActive ? "このキャラを使っています" : `${selected.name}をお店のキャラにする`}
        </Button>
      </Surface>
    </div>
  );
}
