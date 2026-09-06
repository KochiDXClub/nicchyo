'use client';

/**
 * SpotCard
 *
 * 電停・駅・建物などのランドマークや、お手洗い・休けい場所をタップしたときに
 * 開く共通のカード。店舗のバナー（ShopDetailBanner）と同じく画面下端に出る
 * ボトムシートで、店舗以外のスポットはすべてこの1枚で扱う。
 *
 *   - 見出し: アイコン + 種別ラベル + 名前
 *   - 実景写真（あれば）
 *   - 説明・乗り入れ路線・タグ・補足
 *   - 現在地からの道のり（会場内で現在地が取れているときだけ）
 *   - 「ここへ寄る」＝マップをそのスポットへ寄せる
 *   - 種別に応じた次の一手（のりもの一覧へ / 時刻表を見る）
 *
 * 開いたときにスポットがシートの陰に隠れないよう、画面の下側にあるときだけ
 * 少しだけ地図をずらす。
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, List, LocateFixed, MapPin, X as XIcon } from 'lucide-react';
import type { MapSpot } from '@/lib/spots';
import { getSpotKindMeta } from '@/lib/spots';
import {
  DETOUR_RATIO,
  distanceInMeters,
  estimateWalkMinutes,
  formatDistance,
  type LatLng,
} from '@/lib/facilities/nearest';
import type { MapCamera } from '../types/mapCamera';
import { getNearestPointOnRoad } from '../config/roadConfig';

type SpotCardProps = {
  spot: MapSpot;
  map: MapCamera | null;
  /** 会場内で取れている現在地。無ければ道のりは出さない */
  origin?: LatLng | null;
  onClose: () => void;
};

const FOCUS_ZOOM = 18;
/** 通りからこの距離以内なら「日曜市の通り沿い」と表現する */
const ON_ROAD_METERS = 40;
/** スポットがこの割合より下にあるとき、シートに隠れるので地図をずらす */
const VISIBLE_RATIO = 0.5;
/** ずらした後にスポットを置く高さ（コンテナ上端からの割合） */
const TARGET_RATIO = 0.3;

function SpotIcon({ spot, sizeClass }: { spot: MapSpot; sizeClass: string }) {
  if (spot.iconUrl) {
    return (
      <div className={`flex shrink-0 items-center justify-center ${sizeClass}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spot.iconUrl} alt="" className="h-full w-full object-contain drop-shadow-sm" draggable={false} />
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${sizeClass}`}
      style={{ backgroundColor: `${spot.accentColor}1a` }}
      aria-hidden
    >
      {spot.emoji}
    </div>
  );
}

function getFacilityListHref(spot: MapSpot): { href: string; label: string } | null {
  if (spot.kind === 'transit') return { href: '/map?facility=transport', label: 'のりものを一覧で見る' };
  if (spot.kind === 'restroom') return { href: '/map?facility=restroom', label: 'お手洗いを一覧で見る' };
  if (spot.kind === 'rest') return { href: '/map?facility=rest', label: '休けい場所を一覧で見る' };
  return null;
}

export default function SpotCard({ spot, map, origin, onClose }: SpotCardProps) {
  const meta = getSpotKindMeta(spot.kind, spot.transitMode);
  const listLink = getFacilityListHref(spot);

  const walk = useMemo(() => {
    if (!origin) return null;
    const meters = distanceInMeters(origin, spot) * DETOUR_RATIO;
    return { meters, minutes: estimateWalkMinutes(meters) };
  }, [origin, spot]);

  // 会場（追手筋）を基準にした一言。現在地が無くても「会場からどれくらいか」は伝えられる
  const venueNote = useMemo(() => {
    const onRoad = getNearestPointOnRoad(spot.lat, spot.lng);
    const meters = distanceInMeters(spot, onRoad);
    if (meters <= ON_ROAD_METERS) return '日曜市の通り沿い';
    const walkMeters = meters * DETOUR_RATIO;
    return `日曜市の通りまで徒歩約${estimateWalkMinutes(walkMeters)}分（${formatDistance(walkMeters)}）`;
  }, [spot]);

  // シートに隠れる位置にあるスポットだけ、見える高さまで地図を寄せる
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const height = container.clientHeight;
    if (!height) return;
    const point = map.latLngToContainerPoint([spot.lat, spot.lng]);
    if (point.y <= height * VISIBLE_RATIO) return;
    const center = map.latLngToContainerPoint([map.getCenter().lat, map.getCenter().lng]);
    const shifted = map.containerPointToLatLng({ x: center.x, y: center.y + (point.y - height * TARGET_RATIO) });
    map.setView([shifted.lat, shifted.lng], undefined, { animate: true, duration: 0.4 });
    // スポットが変わったときだけ動かす（map の再取得では動かさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot.id]);

  const handleFocus = useCallback(() => {
    if (!map) return;
    map.flyTo([spot.lat, spot.lng], Math.max(FOCUS_ZOOM, map.getZoom()), { animate: true, duration: 0.8 });
  }, [map, spot.lat, spot.lng]);

  return (
    <motion.div
      key={spot.id}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute left-0 right-0 z-[1650] rounded-t-[1.75rem] bg-white shadow-2xl"
      style={{ bottom: 0, maxHeight: '58vh', display: 'flex', flexDirection: 'column' }}
      role="dialog"
      aria-label={spot.name}
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center pb-1 pt-3">
        <div className="h-1 w-10 rounded-full bg-slate-300" />
      </div>

      {/* 見出し */}
      <div className="flex items-start gap-3 px-5 pb-3 pt-1">
        <SpotIcon spot={spot} sizeClass="h-11 w-11 text-xl" />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase leading-none tracking-wide"
            style={{ color: spot.accentColor }}
          >
            {meta.label}
          </p>
          <h3 className="mt-1 text-[17px] font-bold leading-tight text-slate-900">{spot.name}</h3>
          {walk && (
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              現在地から徒歩{walk.minutes}分・{formatDistance(walk.meters)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors active:bg-slate-200"
        >
          <XIcon size={16} />
        </button>
      </div>

      {/* 本文（縦スクロール可能） */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        {spot.photoUrl && (
          <figure className="mb-3 overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spot.photoUrl}
              alt={`${spot.name}の写真`}
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
              draggable={false}
            />
            {spot.photoCredit && (
              <figcaption className="px-2.5 py-1 text-[10px] leading-tight text-slate-400">{spot.photoCredit}</figcaption>
            )}
          </figure>
        )}

        {spot.description && (
          <p className="text-[13px] leading-relaxed text-slate-700">{spot.description}</p>
        )}

        <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-slate-500">
          <MapPin size={13} className="shrink-0" aria-hidden />
          {venueNote}
        </p>

        {/*
          座標が実測で確認できていないスポット（管理画面の「位置を確認済み」が未チェック）は、
          その場で探し回らせないよう先に断っておく。列が無い環境では undefined になるので、
          明示的に false のときだけ出す。
        */}
        {spot.verified === false && (
          <p className="mt-1 pl-[17px] text-[11px] leading-relaxed text-slate-400">
            場所はおおよその位置です。現地の案内表示もあわせてご確認ください。
          </p>
        )}

        {spot.lines && spot.lines.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {spot.lines.map((line) => (
              <span
                key={line}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: spot.accentColor }}
              >
                {line}
              </span>
            ))}
          </div>
        )}

        {spot.tags && spot.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {spot.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                style={{ borderColor: `${spot.accentColor}66`, color: spot.accentColor }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {spot.notes && (
          <p className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
            {spot.notes}
          </p>
        )}

        {/* 行動ボタン */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleFocus}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-transform active:scale-[0.97]"
            style={{ backgroundColor: spot.accentColor }}
          >
            <LocateFixed size={15} />
            ここへ寄る
          </button>
          {listLink && (
            <Link
              href={listLink.href}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors active:bg-slate-200"
            >
              <List size={15} />
              {listLink.label}
            </Link>
          )}
          {spot.externalUrl && (
            <a
              href={spot.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors active:bg-slate-200"
            >
              <ExternalLink size={15} />
              {spot.kind === 'transit' ? '時刻表を見る' : '公式サイト'}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
