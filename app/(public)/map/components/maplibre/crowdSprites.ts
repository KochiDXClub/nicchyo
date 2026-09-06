/**
 * 人影スプライトの描き起こし（MapLibre 用）
 *
 * 種類（8）× 左右反転（2）× 歩きのコマ（2）＝ 32 枚。
 * 表示は 20×34px 程度なので、pixelRatio 倍で描いても合計は数十 KB に収まる。
 */

import {
  CROWD_FRAME_COUNT,
  CROWD_ICON_HEIGHT_PX,
  CROWD_ICON_WIDTH_PX,
  CROWD_KINDS,
  generateCrowdSvg,
  type CrowdKind,
} from "../../config/crowdParts";
import { rasterizeSvg } from "./stallSprites";

export interface CrowdSprite {
  id: string;
  image: ImageData;
  pixelRatio: number;
}

/** icon-image の式（MapViewMapLibre 側）と同じ組み立て方にする */
export function crowdImageId(kind: CrowdKind, flip: 0 | 1, frame: number): string {
  return `person:${kind}:${flip}:${frame}`;
}

export async function buildCrowdSprites(pixelRatio = 2): Promise<CrowdSprite[]> {
  const jobs: Promise<CrowdSprite | null>[] = [];
  for (const kind of CROWD_KINDS) {
    for (const flip of [0, 1] as const) {
      for (let frame = 0; frame < CROWD_FRAME_COUNT; frame += 1) {
        const svg = generateCrowdSvg(kind, frame, flip === 1, {
          width: CROWD_ICON_WIDTH_PX,
          height: CROWD_ICON_HEIGHT_PX,
        });
        jobs.push(
          rasterizeSvg(svg, CROWD_ICON_WIDTH_PX, pixelRatio, CROWD_ICON_HEIGHT_PX)
            .then((image) => ({ id: crowdImageId(kind, flip, frame), image, pixelRatio }))
            .catch((error: unknown) => {
              // 1 枚の失敗で全体を止めない（その人影は出ないだけ）
              console.warn("[crowdSprites]", kind, flip, frame, error);
              return null;
            })
        );
      }
    }
  }
  return (await Promise.all(jobs)).filter((s): s is CrowdSprite => s !== null);
}
