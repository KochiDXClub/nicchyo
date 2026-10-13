import { Landmark as LandmarkIcon } from 'lucide-react';
import { getSpotKindMeta } from '@/lib/spots/spotMeta';
import type { SpotKind } from '@/lib/spots';

/**
 * 種類のアイコン。/facilities と地図で使っている専用画像をそのまま使い、
 * 専用画像が無い種類（観光地）は線画で代える。絵文字は使わない。
 */
export default function SpotKindIcon({ kind, size = 36 }: { kind: SpotKind; size?: number }) {
  const { iconUrl } = getSpotKindMeta(kind);
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={iconUrl} alt="" width={size} height={size} className="object-contain drop-shadow-sm" draggable={false} aria-hidden />
    );
  }
  return <LandmarkIcon size={Math.round(size * 0.83)} strokeWidth={2.2} className="text-nicchyo-ink" aria-hidden />;
}
