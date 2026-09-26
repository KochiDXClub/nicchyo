/**
 * 日曜市の会場（追手筋）まわりの避難場所
 *
 * 災害時に「どっちへ逃げればいいか」を、土地勘のない来訪者にも示すためのデータ。
 * 管理画面から編集できる map_landmarks には載せず、国土地理院の公式データを
 * scripts/build-evacuation-sites.mjs で写したもの（data/otesuji-evacuation-sites.json）を
 * コードで持つ。誤りが命に関わるので、手で書き換えず、変更はレビューを通す PR だけで行う。
 *
 * 指定緊急避難場所は災害の種類ごとに指定される。洪水には使えても津波には
 * 使えない、という場所があるので、種類（hazards）を必ず持たせ、案内でも出す。
 * 対応していない種類へは案内しない。
 *
 * 出典と更新のしかたは EVACUATION_DATA_SOURCE を参照。
 */

import data from './data/otesuji-evacuation-sites.json';

/** 指定緊急避難場所の「災害種別」（災害対策基本法施行令の区分） */
export type HazardType =
  | 'flood'
  | 'landslide'
  | 'stormSurge'
  | 'earthquake'
  | 'tsunami'
  | 'fire'
  | 'inlandFlood'
  | 'volcano';

/** 案内に出す短い名前。条件チップ・タグとしても使う */
export const HAZARD_LABELS: Record<HazardType, string> = {
  flood: '洪水',
  landslide: '土砂災害',
  stormSurge: '高潮',
  earthquake: '地震',
  tsunami: '津波',
  fire: '大規模な火事',
  inlandFlood: '内水氾濫',
  volcano: '火山',
};

/** 並べるときの順番。日曜市で起こりやすく、急ぐものを先にする */
export const HAZARD_ORDER: HazardType[] = [
  'tsunami',
  'earthquake',
  'fire',
  'flood',
  'inlandFlood',
  'stormSurge',
  'landslide',
  'volcano',
];

export type EvacuationSite = {
  /** 国土地理院データの共通ID。スポットIDの元になるので変えない */
  id: string;
  name: string;
  /** 「高知県高知市」を省いた住所 */
  address: string;
  lat: number;
  lng: number;
  /** 避難先として指定されている災害の種類。空にしない */
  hazards: HazardType[];
  /** 指定避難所（しばらく滞在できる場所）も兼ねているか */
  isShelter: boolean;
};

export const EVACUATION_DATA_SOURCE = {
  /** 画面に出す出典表記（国土地理院コンテンツ利用規約に沿って「加工して作成」と添える） */
  credit: '出典：国土地理院「指定緊急避難場所データ」（高知県高知市）を加工して作成',
  url: 'https://www.gsi.go.jp/bousaichiri/hinanbasho.html',
  /** 写した日（YYYY-MM-DD）。公式データが更新されたら scripts/build-evacuation-sites.mjs で作り直す */
  retrievedAt: data.retrievedAt,
} as const;

/** 会場の通りから600m以内の指定緊急避難場所（通りに近い順） */
export const EVACUATION_SITES: readonly EvacuationSite[] = data.sites as EvacuationSite[];

/** 指定の種類に対応した避難場所だけを返す */
export function sitesForHazard(sites: readonly EvacuationSite[], hazard: HazardType): EvacuationSite[] {
  return sites.filter((site) => site.hazards.includes(hazard));
}

/** 災害の種類を案内の順番に並べ替えた名前の一覧 */
export function hazardLabelsOf(site: Pick<EvacuationSite, 'hazards'>): string[] {
  return HAZARD_ORDER.filter((hazard) => site.hazards.includes(hazard)).map((hazard) => HAZARD_LABELS[hazard]);
}
