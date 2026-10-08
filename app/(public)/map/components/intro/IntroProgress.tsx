'use client';

/**
 * 進み具合。いまどの節にいるかを点の並びで示し、押せばその節へ飛ぶ。
 *
 * いま居る点だけ長く伸ばす。通り過ぎた点は薄い緑、まだの点は灰色。
 * 「あと何節あるか」が読む前に分かるので、長い案内でも先が見える。
 */
export default function IntroProgress({
  active,
  labels,
  onSelect,
}: {
  active: number;
  labels: readonly string[];
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="案内の進み具合" className="-ml-2 flex items-center">
      {labels.map((label, i) => {
        const state = i === active ? 'current' : i < active ? 'done' : 'todo';
        return (
          <button
            key={label}
            type="button"
            aria-current={i === active ? 'step' : undefined}
            aria-label={label}
            onClick={() => onSelect(i)}
            className="flex h-11 w-7 items-center justify-center focus-visible:outline-none"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                state === 'current'
                  ? 'w-6 bg-nicchyo-primary'
                  : state === 'done'
                    ? 'w-1.5 bg-nicchyo-primary/45'
                    : 'w-1.5 bg-nicchyo-ink/15'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
