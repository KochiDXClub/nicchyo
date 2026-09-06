/**
 * お客さん（人影）イラストのカタログ（SVG 生成）
 *
 * 【目的】
 * 道の上にまばらに人影を置いて日曜市の「にぎわい」を出す。主役はあくまで屋台なので、
 * 屋台イラスト（stallParts.ts）と同じ手描き調・2〜3頭身に寄せ、彩度は落とし気味にする。
 *
 * 【座標系】
 * 60×100 の viewBox に立面（正面〜やや斜め）で描く。足元は y=96。
 * MapLibre のシンボルは icon-rotation-alignment: "viewport" なので、地図を回しても
 * この絵はいつも正立してこちらを向く。だから向き別スプライトは「左右反転」だけで足りる。
 *
 * 【コマ】
 * 歩きの 2 コマ（frame 0 = 足を開く / frame 1 = 足をそろえて少し伸び上がる）。
 * 3 コマ以上は要らない。カクつきはむしろ手描きが動いている感じになる。
 */

export type CrowdKind = "adult" | "child" | "granny" | "shopper";

export const CROWD_KINDS: readonly CrowdKind[] = ["adult", "child", "granny", "shopper"];

/** 歩きのコマ数（0 と 1 を交互に出す） */
export const CROWD_FRAME_COUNT = 2;

export const CROWD_VIEWBOX = { width: 60, height: 100 } as const;

/** 表示サイズ（px）。屋台（60px 角）の 6 割ほどの背丈にして主役を食わないようにする */
export const CROWD_ICON_HEIGHT_PX = 34;
export const CROWD_ICON_WIDTH_PX = Math.round(
  (CROWD_ICON_HEIGHT_PX * CROWD_VIEWBOX.width) / CROWD_VIEWBOX.height
);

interface CrowdColors {
  /** 上半身（服） */
  top: string;
  /** 下半身（ズボン・スカート） */
  bottom: string;
  /** 肌 */
  skin: string;
  /** 髪 */
  hair: string;
}

type HairStyle = "short" | "bob" | "bun";

interface FigureSpec {
  headCy: number;
  headR: number;
  torsoTop: number;
  torsoBottom: number;
  torsoHalfWidth: number;
  legBottom: number;
  legWidth: number;
  armWidth: number;
  hair: HairStyle;
  colors: CrowdColors;
  /** 前かがみの角度（足元を軸に回す。おばあちゃんだけ） */
  lean?: number;
  /** 買い物袋を提げる */
  bag?: boolean;
  /** 杖をつく */
  cane?: boolean;
}

const SKIN = "#f0c9a3";
const OUTLINE = "rgba(74,56,38,0.45)";
const OUTLINE_WIDTH = 1.6;
const GROUND_Y = 96;
const CENTER_X = CROWD_VIEWBOX.width / 2;

/**
 * 人物の体型と配色。
 * 現在地マーカー（青い三角矢印）と取り違えないよう、青系は使わない。
 */
const FIGURES: Record<CrowdKind, FigureSpec> = {
  adult: {
    headCy: 26,
    headR: 12,
    torsoTop: 37,
    torsoBottom: 63,
    torsoHalfWidth: 11,
    legBottom: 90,
    legWidth: 8,
    armWidth: 5.5,
    hair: "short",
    colors: { top: "#d9694f", bottom: "#5f5a52", skin: SKIN, hair: "#4a3a2c" },
  },
  child: {
    headCy: 40,
    headR: 11,
    torsoTop: 50,
    torsoBottom: 70,
    torsoHalfWidth: 9,
    legBottom: 91,
    legWidth: 6.5,
    armWidth: 4.5,
    hair: "bob",
    colors: { top: "#f0a93b", bottom: "#7b6a56", skin: SKIN, hair: "#5a4432" },
  },
  granny: {
    headCy: 30,
    headR: 11,
    torsoTop: 40,
    torsoBottom: 65,
    torsoHalfWidth: 10.5,
    legBottom: 90,
    legWidth: 7.5,
    armWidth: 5,
    hair: "bun",
    colors: { top: "#a4708a", bottom: "#6b6259", skin: SKIN, hair: "#ded8cf" },
    lean: 6,
    cane: true,
  },
  shopper: {
    headCy: 26,
    headR: 12,
    torsoTop: 37,
    torsoBottom: 63,
    torsoHalfWidth: 11,
    legBottom: 90,
    legWidth: 8,
    armWidth: 5.5,
    hair: "short",
    colors: { top: "#6f9c5a", bottom: "#5f5a52", skin: SKIN, hair: "#3f3529" },
    bag: true,
  },
};

const n = (value: number): string => Number(value.toFixed(2)).toString();

/** 足。frame 0 は開き、frame 1 はそろえて片足を少し浮かせる */
function legsPath(spec: FigureSpec, frame: number): string {
  const hipY = spec.torsoBottom - 2;
  const dx = spec.torsoHalfWidth * 0.45;
  const back =
    frame === 0
      ? `M${n(CENTER_X - dx)},${n(hipY)} L${n(CENTER_X - dx - 5)},${n(spec.legBottom)}`
      : `M${n(CENTER_X - dx)},${n(hipY)} L${n(CENTER_X - dx - 1)},${n(spec.legBottom)}`;
  const front =
    frame === 0
      ? `M${n(CENTER_X + dx)},${n(hipY)} L${n(CENTER_X + dx + 5)},${n(spec.legBottom - 1)}`
      : `M${n(CENTER_X + dx)},${n(hipY)} L${n(CENTER_X + dx + 2)},${n(spec.legBottom - 3)}`;
  const stroke = `stroke="${spec.colors.bottom}" stroke-width="${spec.legWidth}" stroke-linecap="round" fill="none"`;
  return `<path d="${back}" ${stroke}/><path d="${front}" ${stroke}/>`;
}

interface ArmEnds {
  back: [number, number];
  front: [number, number];
}

function armEnds(spec: FigureSpec, frame: number): ArmEnds {
  const shoulderY = spec.torsoTop + 5;
  const reach = (spec.torsoBottom - shoulderY) * 0.75;
  if (frame === 0) {
    return {
      back: [CENTER_X - spec.torsoHalfWidth - 4, shoulderY + reach],
      front: [CENTER_X + spec.torsoHalfWidth + 4, shoulderY + reach - 2],
    };
  }
  return {
    back: [CENTER_X - spec.torsoHalfWidth - 1.5, shoulderY + reach + 2],
    front: [CENTER_X + spec.torsoHalfWidth + 1.5, shoulderY + reach + 2],
  };
}

function armsPath(spec: FigureSpec, frame: number): string {
  const shoulderY = spec.torsoTop + 5;
  const ends = armEnds(spec, frame);
  const stroke = `stroke="${spec.colors.top}" stroke-width="${spec.armWidth}" stroke-linecap="round" fill="none"`;
  const shoulderDx = spec.torsoHalfWidth - 1;
  const hand = (p: [number, number]) =>
    `<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(spec.armWidth * 0.46)}" fill="${spec.colors.skin}"/>`;
  return (
    `<path d="M${n(CENTER_X - shoulderDx)},${n(shoulderY)} L${n(ends.back[0])},${n(ends.back[1])}" ${stroke}/>` +
    `<path d="M${n(CENTER_X + shoulderDx)},${n(shoulderY)} L${n(ends.front[0])},${n(ends.front[1])}" ${stroke}/>` +
    hand(ends.back) +
    hand(ends.front)
  );
}

function torsoPath(spec: FigureSpec): string {
  const hw = spec.torsoHalfWidth;
  const top = spec.torsoTop;
  const bottom = spec.torsoBottom;
  const r = 5;
  const body =
    `M${n(CENTER_X - hw)},${n(bottom)} V${n(top + r)} A${r},${r} 0 0 1 ${n(CENTER_X - hw + r)},${n(top)} ` +
    `H${n(CENTER_X + hw - r)} A${r},${r} 0 0 1 ${n(CENTER_X + hw)},${n(top + r)} V${n(bottom)} Z`;
  // 左側に白の半透明を重ねて立体感を出す（屋台イラストのハイライトと同じ手口）
  const light =
    `M${n(CENTER_X - hw)},${n(bottom)} V${n(top + r)} A${r},${r} 0 0 1 ${n(CENTER_X - hw + r)},${n(top)} ` +
    `H${n(CENTER_X - hw * 0.1)} L${n(CENTER_X - hw * 0.55)},${n(bottom)} Z`;
  return (
    `<path d="${body}" fill="${spec.colors.top}" stroke="${OUTLINE}" stroke-width="${OUTLINE_WIDTH}" stroke-linejoin="round"/>` +
    `<path d="${light}" fill="#ffffff" opacity="0.18"/>`
  );
}

function headPath(spec: FigureSpec): string {
  const cy = spec.headCy;
  const r = spec.headR;
  const neck =
    `<path d="M${n(CENTER_X - 3)},${n(cy + r - 2)} H${n(CENTER_X + 3)} V${n(spec.torsoTop + 1)} H${n(CENTER_X - 3)} Z" ` +
    `fill="${spec.colors.skin}"/>`;
  const head =
    `<circle cx="${CENTER_X}" cy="${n(cy)}" r="${n(r)}" fill="${spec.colors.skin}" ` +
    `stroke="${OUTLINE}" stroke-width="${OUTLINE_WIDTH}"/>`;
  const hair = hairPath(spec);
  return neck + head + hair;
}

function hairPath(spec: FigureSpec): string {
  const cy = spec.headCy;
  const r = spec.headR;
  const cap = (fringeDepth: number) =>
    `M${n(CENTER_X - r)},${n(cy)} A${n(r)},${n(r)} 0 0 1 ${n(CENTER_X + r)},${n(cy)} ` +
    `L${n(CENTER_X + r)},${n(cy - 1)} Q${CENTER_X},${n(cy + fringeDepth)} ${n(CENTER_X - r)},${n(cy - 1)} Z`;
  if (spec.hair === "bun") {
    return (
      `<path d="${cap(1.5)}" fill="${spec.colors.hair}"/>` +
      `<circle cx="${n(CENTER_X - r * 0.5)}" cy="${n(cy - r * 0.95)}" r="${n(r * 0.36)}" fill="${spec.colors.hair}"/>`
    );
  }
  if (spec.hair === "bob") {
    // 耳の横まで下ろす（おかっぱ）
    return (
      `<path d="${cap(3)}" fill="${spec.colors.hair}"/>` +
      `<path d="M${n(CENTER_X - r)},${n(cy - 2)} V${n(cy + r * 0.55)} A${n(r * 0.4)},${n(r * 0.4)} 0 0 0 ${n(CENTER_X - r * 0.45)},${n(cy + r * 0.65)} ` +
      `L${n(CENTER_X - r * 0.5)},${n(cy - 2)} Z" fill="${spec.colors.hair}"/>` +
      `<path d="M${n(CENTER_X + r)},${n(cy - 2)} V${n(cy + r * 0.55)} A${n(r * 0.4)},${n(r * 0.4)} 0 0 1 ${n(CENTER_X + r * 0.45)},${n(cy + r * 0.65)} ` +
      `L${n(CENTER_X + r * 0.5)},${n(cy - 2)} Z" fill="${spec.colors.hair}"/>`
    );
  }
  return `<path d="${cap(2.5)}" fill="${spec.colors.hair}"/>`;
}

/** 買い物袋。前に出した手から提げる */
function bagPath(spec: FigureSpec, frame: number): string {
  const [hx, hy] = armEnds(spec, frame).front;
  const w = 11;
  const h = 12;
  const top = hy + 4;
  const left = hx - w / 2;
  return (
    `<path d="M${n(hx - 3.5)},${n(top)} Q${n(hx)},${n(hy + 0.5)} ${n(hx + 3.5)},${n(top)}" ` +
    `fill="none" stroke="#8b5e34" stroke-width="1.4"/>` +
    `<path d="M${n(left)},${n(top)} H${n(left + w)} V${n(top + h)} H${n(left)} Z" ` +
    `fill="#e6c15c" stroke="${OUTLINE}" stroke-width="${OUTLINE_WIDTH}" stroke-linejoin="round"/>` +
    `<path d="M${n(left)},${n(top)} H${n(left + w * 0.45)} L${n(left + w * 0.2)},${n(top + h)} H${n(left)} Z" ` +
    `fill="#ffffff" opacity="0.22"/>`
  );
}

/** 杖 */
function canePath(spec: FigureSpec, frame: number): string {
  const [hx, hy] = armEnds(spec, frame).front;
  return (
    `<path d="M${n(hx + 1)},${n(hy)} L${n(hx + 3.5)},${n(spec.legBottom + 4)}" ` +
    `stroke="#8b5e34" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
  );
}

export interface CrowdSvgOptions {
  width: number;
  height: number;
}

/**
 * 人影 1 体の SVG を作る。
 * @param kind 大人・子ども・おばあちゃん・買い物袋を持った人
 * @param frame 歩きのコマ（0 or 1）
 * @param flip true で左右反転（`icon-rotate` は回転であって鏡像にならないので別画像で持つ）
 */
export function generateCrowdSvg(
  kind: CrowdKind,
  frame: number,
  flip: boolean,
  size: CrowdSvgOptions
): string {
  const spec = FIGURES[kind];
  const f = frame % CROWD_FRAME_COUNT;
  // frame 1 は少し伸び上がる（歩きの上下動）
  const bob = f === 1 ? -1.5 : 0;
  const lean = spec.lean
    ? ` transform="rotate(${spec.lean} ${CENTER_X} ${spec.legBottom})"`
    : "";
  const body =
    legsPath(spec, f) +
    torsoPath(spec) +
    armsPath(spec, f) +
    headPath(spec) +
    (spec.bag ? bagPath(spec, f) : "") +
    (spec.cane ? canePath(spec, f) : "");
  const shadowRx = spec.torsoHalfWidth * 1.35;
  const flipTransform = flip
    ? ` transform="translate(${CROWD_VIEWBOX.width} 0) scale(-1 1)"`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CROWD_VIEWBOX.width} ${CROWD_VIEWBOX.height}" ` +
    `width="${size.width}" height="${size.height}">` +
    `<g${flipTransform}>` +
    `<ellipse cx="${CENTER_X}" cy="${GROUND_Y - 1}" rx="${n(shadowRx)}" ry="${n(shadowRx * 0.3)}" fill="rgba(0,0,0,0.14)"/>` +
    `<g${lean}><g transform="translate(0 ${bob})">${body}</g></g>` +
    `</g>` +
    `</svg>`
  );
}
