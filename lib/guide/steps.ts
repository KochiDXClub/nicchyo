/**
 * 経路の折れ線から、人が読める簡単なステップ案内を作る
 *
 *   「現在地から追手筋へ出る」→「追手筋を東へ約200m」→「右へ曲がって帯屋町アーケードへ」
 *   →「帯屋町アーケードを南へ約80m」→「中央公園に到着」
 *
 * 同じ道を同じ向きに歩く区間はひとつにまとめ、向きが大きく変わるところで
 * 「右へ/左へ」を入れる。丁目などの細かい目印は出さず、道の名前と方角だけにする
 * （初来訪者にはそのほうが読みやすい）。
 */

import { distanceInMeters } from '@/lib/facilities/geo';
import { formatDistance } from '@/lib/facilities/nearest';
import type { LatLng, RouteStep } from './types';

/** 折れ線の1区間（どの道を歩くか付き） */
export type RouteLeg = {
  from: LatLng;
  to: LatLng;
  /** 道の名前。道の外（現在地から道へ出る区間など）は null */
  pathName: string | null;
};

/** この角度（度）以上向きが変わったら「曲がる」とみなす */
export const TURN_THRESHOLD_DEGREES = 35;
/** これより短い区間は案内に出さない（折れ線の細かなゆらぎを吸収） */
const MIN_STEP_METERS = 15;

/** 北を0度とした方位角（時計回り） */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_LABELS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

export function compassLabel(bearing: number): string {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_LABELS[index];
}

/** -180〜180 に正規化した向きの差（正なら右回り） */
function turnAngle(fromBearing: number, toBearing: number): number {
  return ((toBearing - fromBearing + 540) % 360) - 180;
}

type Segment = {
  pathName: string | null;
  bearing: number;
  distanceMeters: number;
  start: LatLng;
};

/** 区間を「同じ道・ほぼ同じ向き」でまとめ、短すぎる区間は前後に吸収する */
function mergeLegs(legs: RouteLeg[]): Segment[] {
  const segments: Segment[] = [];
  for (const leg of legs) {
    const distance = distanceInMeters(leg.from, leg.to);
    if (distance < 0.5) continue;
    const bearing = bearingDegrees(leg.from, leg.to);
    const last = segments[segments.length - 1];
    if (
      last &&
      last.pathName === leg.pathName &&
      Math.abs(turnAngle(last.bearing, bearing)) < TURN_THRESHOLD_DEGREES
    ) {
      last.distanceMeters += distance;
      continue;
    }
    // 短すぎる区間は前の区間に吸収する（向きは前のまま）
    if (last && distance < MIN_STEP_METERS) {
      last.distanceMeters += distance;
      continue;
    }
    // 前の区間が短すぎる（道へ出る数メートルなど）なら、この区間に置き換える
    if (last && last.distanceMeters < MIN_STEP_METERS && segments.length >= 1) {
      segments.pop();
      const carried = last.distanceMeters;
      segments.push({ pathName: leg.pathName, bearing, distanceMeters: distance + carried, start: last.start });
      continue;
    }
    segments.push({ pathName: leg.pathName, bearing, distanceMeters: distance, start: leg.from });
  }
  return segments;
}

function describeWalk(segment: Segment): string {
  const distanceText = formatDistance(segment.distanceMeters);
  const direction = compassLabel(segment.bearing);
  if (segment.pathName) return `${segment.pathName}を${direction}へ${distanceText}`;
  return `${direction}へ${distanceText}`;
}

export function buildRouteSteps(
  legs: RouteLeg[],
  options: { originLabel?: string; destinationName: string }
): RouteStep[] {
  const segments = mergeLegs(legs);
  const steps: RouteStep[] = [];
  if (segments.length === 0) {
    const at = legs[0]?.from ?? { lat: 0, lng: 0 };
    return [
      {
        kind: 'arrive',
        instruction: `${options.destinationName}はすぐそこです`,
        distanceMeters: 0,
        at,
        pathName: null,
      },
    ];
  }

  const first = segments[0];
  const originLabel = options.originLabel ?? '現在地';
  const firstPathName = segments.find((s) => s.pathName)?.pathName ?? null;
  steps.push({
    kind: 'depart',
    instruction: firstPathName && !first.pathName ? `${originLabel}から${firstPathName}へ出る` : `${originLabel}から出発`,
    distanceMeters: 0,
    at: first.start,
    pathName: null,
  });

  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    // 道の外（現在地から道へ出る区間）の直後は「曲がる」とは言わない
    if (previous && previous.pathName) {
      const angle = turnAngle(previous.bearing, segment.bearing);
      if (Math.abs(angle) >= TURN_THRESHOLD_DEGREES && segment.pathName) {
        const side = angle > 0 ? '右' : '左';
        const changedPath = segment.pathName !== previous.pathName;
        steps.push({
          kind: angle > 0 ? 'turn-right' : 'turn-left',
          instruction: changedPath ? `${side}へ曲がって${segment.pathName}へ` : `${side}へ曲がる`,
          distanceMeters: 0,
          at: segment.start,
          pathName: segment.pathName,
        });
      }
    }
    steps.push({
      kind: 'straight',
      instruction: describeWalk(segment),
      distanceMeters: segment.distanceMeters,
      at: segment.start,
      pathName: segment.pathName,
    });
  });

  const lastLeg = legs[legs.length - 1];
  steps.push({
    kind: 'arrive',
    instruction: `${options.destinationName}に到着`,
    distanceMeters: 0,
    at: lastLeg.to,
    pathName: null,
  });
  return steps;
}
