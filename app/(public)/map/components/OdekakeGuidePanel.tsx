'use client';

/**
 * OdekakeGuidePanel
 *
 * おでかけサポートのボトムシート。
 *
 *   - たたむと小さなピルだけ。マップを隠さない
 *   - 開くと: 目的（プリセット）/ 種類の切り替え / 条件 / 起点 / 行程表
 *   - 行程表は「起点 → 各スポット」を縦の破線でつないだ停留所リスト。
 *     マップに引く破線ルートと同じ表現で、どこからどこへ行くのかが一目で分かる
 *   - 行をタップすると経路が引かれ、「案内をはじめる」で案内中モードに入る
 *
 * 計算はすべて useOdekakeGuide 側。ここは見た目と操作だけを担当する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, LocateFixed, Navigation, X as XIcon } from 'lucide-react';
import type { MapSpot } from '@/lib/spots';
import { GUIDE_PRESETS, type RankedSpot } from '@/lib/guide';
import { formatDistance } from '@/lib/facilities/nearest';
import type { MapCamera } from '../types/mapCamera';
import { GUIDE_KIND_OPTIONS, type OdekakeGuide } from '../hooks/useOdekakeGuide';

type OdekakeGuidePanelProps = {
  guide: OdekakeGuide;
  map: MapCamera | null;
  onClose: () => void;
  onOpenSpot: (spot: MapSpot) => void;
};

const FOCUS_ZOOM = 17;
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2';

function SpotIcon({ spot, size }: { spot: MapSpot; size: number }) {
  if (spot.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={spot.iconUrl} alt="" width={size} height={size} className="block drop-shadow-sm" draggable={false} aria-hidden />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, backgroundColor: spot.accentColor, fontSize: size * 0.5 }}
      aria-hidden
    >
      {spot.emoji}
    </span>
  );
}

function KindToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
      className={`${FOCUS_RING} shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
        active ? 'bg-nicchyo-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ConditionToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
      className={`${FOCUS_RING} shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 active:bg-emerald-100'
      }`}
    >
      {children}
    </button>
  );
}

/** 位置情報の状態ごとの表示（行程表の起点の位置に出す） */
function LocationStatusRow({ status, onRequest }: { status: OdekakeGuide['geoStatus']; onRequest: () => void }) {
  const messages: Record<Exclude<OdekakeGuide['geoStatus'], 'granted'>, { title: string; note?: string; action?: string }> = {
    checking: { title: '位置情報を確認中' },
    prompt: { title: '位置情報を許可してください', note: '現在地からの道のりを案内します', action: '位置情報を許可する' },
    requesting: { title: '現在地を取得中' },
    denied: { title: '位置情報が許可されていません', note: 'ブラウザや端末の設定で許可してください', action: 'もう一度試す' },
    error: { title: '位置情報の取得に失敗しました', action: 'もう一度試す' },
    unsupported: { title: 'この端末では位置情報を使えません' },
  };
  if (status === 'granted') return null;
  const message = messages[status];
  const isError = status === 'denied' || status === 'error';
  return (
    <li className="relative flex items-start gap-3 py-2">
      <span
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-2 ${
          isError ? 'ring-rose-300 text-rose-500' : 'ring-slate-300 text-slate-500'
        }`}
        aria-hidden
      >
        <LocateFixed size={16} />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl bg-nicchyo-base px-3.5 py-3 ring-1 ring-amber-100">
        <p className={`text-[13px] font-bold ${isError ? 'text-rose-700' : 'text-nicchyo-ink'}`} role="status">
          {message.title}
        </p>
        {message.note && <p className="mt-0.5 text-[11px] text-slate-500">{message.note}</p>}
        {message.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequest();
            }}
            className={`${FOCUS_RING} mt-2 flex items-center gap-1.5 rounded-full bg-nicchyo-accent px-3.5 py-1.5 text-[12px] font-bold text-nicchyo-ink active:scale-[0.97]`}
          >
            <LocateFixed size={13} /> {message.action}
          </button>
        )}
      </div>
    </li>
  );
}

export default function OdekakeGuidePanel({ guide, map, onClose, onOpenSpot }: OdekakeGuidePanelProps) {
  const [isOpen, setIsOpen] = useState(guide.kinds.length === 0);
  const dragStartY = useRef<number | null>(null);

  // URL 経由でプリセットが切り替わったら閉じた状態に戻す（画面内でえらんだときは開いたまま）。
  // 種類が未選択なら目的をえらぶために開く
  useEffect(() => {
    setIsOpen(guide.kinds.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.presetId]);
  useEffect(() => {
    if (guide.kinds.length === 0) setIsOpen(true);
  }, [guide.kinds.length]);

  // 案内をはじめたらシートは閉じる（上部の案内バーに切り替わる）
  useEffect(() => {
    if (guide.navigating) setIsOpen(false);
  }, [guide.navigating]);

  // 位置情報が未許可・拒否・取得失敗のときは、その案内が見えるようシートを開く
  const needsLocationAttention = guide.geoStatus === 'prompt' || guide.geoStatus === 'denied' || guide.geoStatus === 'error';
  useEffect(() => {
    if (needsLocationAttention && !guide.navigating && guide.kinds.length > 0) setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.geoStatus]);

  const focusEntry = useCallback(
    (entry: RankedSpot) => {
      if (!map) return;
      const origin = guide.origin?.point;
      if (origin && entry.route) {
        map.setView([(origin.lat + entry.spot.lat) / 2, (origin.lng + entry.spot.lng) / 2], FOCUS_ZOOM, {
          animate: true,
          duration: 0.6,
        });
      } else {
        map.flyTo([entry.spot.lat, entry.spot.lng], FOCUS_ZOOM + 1, { animate: true, duration: 0.8 });
      }
    },
    [guide.origin, map]
  );

  // いちばん近い場所が決まったら（種類の切り替え・現在地の取得）、起点と一緒に映す
  const nearestId = guide.nearest?.spot.id ?? null;
  useEffect(() => {
    if (!nearestId || guide.navigating || guide.selectedId) return;
    const entry = guide.ranked.find((e) => e.spot.id === nearestId);
    if (entry) focusEntry(entry);
    // 起点の細かな更新のたびには動かさない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestId]);

  const handleRowTap = useCallback(
    (entry: RankedSpot) => {
      guide.select(entry.spot.id === guide.selectedId ? null : entry.spot.id);
      focusEntry(entry);
    },
    [focusEntry, guide]
  );

  const handleNavigate = useCallback(
    (entry: RankedSpot) => {
      guide.startNavigation(entry.spot);
      focusEntry(entry);
    },
    [focusEntry, guide]
  );

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
  };
  const handleDragEnd = (clientY: number) => {
    if (dragStartY.current !== null && clientY - dragStartY.current > 60) setIsOpen(false);
    dragStartY.current = null;
  };

  const preset = GUIDE_PRESETS.find((p) => p.id === guide.presetId) ?? null;
  const choosing = guide.kinds.length === 0;
  const title = preset ? preset.label : choosing ? 'いま、どうしたい？' : 'ちかくの場所';
  const nearest = guide.nearest;
  const originLabel = guide.origin?.label ?? '現在地';
  const hasRoutes = guide.ranked.some((entry) => entry.route);

  return (
    <>
      {/* ピル：たたんでいるときの表示 */}
      {!isOpen && !guide.navigating && (
        <div
          className="pointer-events-auto absolute left-1/2 z-[1100] -translate-x-1/2"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            className={`${FOCUS_RING} flex max-w-[min(88vw,26rem)] items-center gap-3 rounded-full bg-white py-2 pl-2 pr-4 shadow-[0_8px_24px_rgba(58,58,58,0.18)] ring-1 ring-black/5 transition-transform active:scale-[0.97]`}
          >
            {nearest?.route ? (
              <SpotIcon spot={nearest.spot} size={36} />
            ) : (
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  needsLocationAttention ? 'bg-rose-50 text-rose-500' : 'bg-nicchyo-accent text-nicchyo-ink'
                }`}
                aria-hidden
              >
                {needsLocationAttention ? <LocateFixed size={16} /> : <Navigation size={16} />}
              </span>
            )}
            <span className="min-w-0 text-left">
              <span className="block truncate text-[14px] font-bold leading-tight text-nicchyo-ink">
                {nearest?.route
                  ? nearest.spot.name
                  : needsLocationAttention
                    ? guide.geoStatus === 'prompt'
                      ? '位置情報を許可してください'
                      : guide.geoStatus === 'denied'
                        ? '位置情報が許可されていません'
                        : '位置情報の取得に失敗しました'
                    : choosing
                      ? 'おでかけサポート'
                      : `${guide.ranked.length}か所`}
              </span>
              <span className="mt-0.5 block text-[11px] leading-none text-slate-500">
                {nearest?.route ? 'いちばん近い' : needsLocationAttention ? title : choosing ? '目的をえらぶ' : title}
              </span>
            </span>
            {nearest?.route && (
              <span className="ml-1 shrink-0 text-[20px] font-black leading-none text-nicchyo-ink tabular-nums">
                {nearest.route.walkMinutes}
                <span className="text-[11px] font-bold">分</span>
              </span>
            )}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="pointer-events-auto absolute inset-0 z-[1620] bg-nicchyo-ink/25" onClick={() => setIsOpen(false)} />
      )}

      {/* シート本体 */}
      <div
        className={`pointer-events-auto absolute left-0 right-0 z-[1650] flex flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(58,58,58,0.22)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 0, maxHeight: '66vh' }}
        onTouchStart={(e) => {
          e.stopPropagation();
          handleDragStart(e.touches[0].clientY);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          handleDragEnd(e.changedTouches[0].clientY);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="おでかけサポート"
        aria-hidden={!isOpen}
      >
        {/* ハンドル + 見出し */}
        <div className="shrink-0 rounded-t-[28px] bg-nicchyo-base/70">
          <div className="flex justify-center pb-2 pt-2.5">
            <span className="h-1 w-9 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-start justify-between gap-3 px-5 pb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-700">おでかけサポート</p>
              <h3 className="mt-0.5 text-[18px] font-black leading-tight tracking-tight text-nicchyo-ink">{title}</h3>
              {!choosing && hasRoutes && <p className="mt-1 text-[11px] text-slate-500">{originLabel}から近い順</p>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="おでかけサポートをとじる"
              className={`${FOCUS_RING} flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 active:bg-slate-100`}
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          {/* 目的（プリセット） */}
          {choosing && (
            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-2.5">
                {GUIDE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      guide.applyPreset(p.id);
                    }}
                    className={`${FOCUS_RING} flex items-start gap-2.5 rounded-2xl bg-nicchyo-base px-3.5 py-3.5 text-left ring-1 ring-amber-100 transition-transform active:scale-[0.98]`}
                  >
                    <span className="mt-0.5 text-[22px] leading-none" aria-hidden>
                      {p.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold text-nicchyo-ink">{p.label}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-5 text-[12px] font-semibold text-slate-500">種類からえらぶ</p>
            </div>
          )}

          {/* 種類（複数選択） */}
          <div className={`flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] ${choosing ? 'pb-4' : 'pb-2 pt-3'}`}>
            {GUIDE_KIND_OPTIONS.map((option) => (
              <KindToggle key={option.kind} active={guide.kinds.includes(option.kind)} onClick={() => guide.toggleKind(option.kind)}>
                <span aria-hidden className="mr-1">
                  {option.emoji}
                </span>
                {option.label}
              </KindToggle>
            ))}
          </div>

          {/* 条件 */}
          {!choosing && guide.availableTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
              <span className="shrink-0 text-[11px] text-slate-400">条件</span>
              {guide.availableTags.map((tag) => (
                <ConditionToggle key={tag} active={guide.anyTags.includes(tag)} onClick={() => guide.toggleAnyTag(tag)}>
                  {tag}
                </ConditionToggle>
              ))}
            </div>
          )}

          {/* 行程表 */}
          {!choosing && guide.ranked.length === 0 && (
            <div className="mx-5 my-4 rounded-2xl bg-slate-50 px-4 py-6 text-center">
              <p className="text-[13px] font-semibold text-slate-700">該当なし</p>
            </div>
          )}

          {!choosing && guide.ranked.length > 0 && (
            <ol className="relative mx-5 mb-2 mt-1">
              {/* 縦の破線（マップの経路と同じ表現） */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-6 left-[17px] top-4 w-0 border-l-2 border-dashed border-slate-300"
              />

              {/* 起点（現在地が取れていなければ、状態と許可ボタンを出す） */}
              {guide.origin ? (
                <li className="relative flex items-center gap-3 py-2">
                  <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-nicchyo-ink" />
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] font-semibold text-slate-600">{originLabel}</span>
                </li>
              ) : (
                <LocationStatusRow status={guide.geoStatus} onRequest={guide.requestLocation} />
              )}

              {guide.ranked.map((entry, index) => {
                const { spot, route } = entry;
                const isSelected = spot.id === guide.selectedId;
                const isNearest = index === 0 && Boolean(route);
                return (
                  <li key={spot.id} className="relative">
                    <div
                      className={`-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors ${
                        isSelected ? 'bg-nicchyo-base' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowTap(entry);
                        }}
                        aria-expanded={isSelected}
                        className={`${FOCUS_RING} flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left`}
                      >
                        <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                          <SpotIcon spot={spot} size={36} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`truncate leading-tight text-nicchyo-ink ${isNearest ? 'text-[15px] font-black' : 'text-[14px] font-bold'}`}>
                              {spot.name}
                            </span>
                            {isNearest && (
                              <span className="shrink-0 rounded-full px-1.5 py-[2px] text-[10px] font-bold leading-none text-white" style={{ backgroundColor: spot.accentColor }}>
                                いちばん近い
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {route ? formatDistance(route.distanceMeters) : spot.description}
                            {entry.reasons.map((reason) => (
                              <span key={reason} className="ml-1.5 rounded bg-slate-100 px-1 py-[1px] text-[10px] text-slate-600">
                                {reason}
                              </span>
                            ))}
                          </span>
                        </span>
                        {route && (
                          <span className="shrink-0 text-right text-nicchyo-ink tabular-nums">
                            <span className="text-[20px] font-black leading-none">{route.walkMinutes}</span>
                            <span className="ml-0.5 text-[11px] font-bold">分</span>
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate(entry);
                        }}
                        aria-label={guide.origin ? `${spot.name}へ案内をはじめる` : '位置情報を許可して案内をはじめる'}
                        className={`${FOCUS_RING} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform active:scale-95`}
                        style={{ backgroundColor: spot.accentColor }}
                      >
                        <Navigation size={15} />
                      </button>
                    </div>

                    {/* 選択中は道すじを見せる */}
                    {isSelected && route && (
                      <div className="ml-12 mr-1 pb-3">
                        <ol className="space-y-1.5 text-[12px] leading-snug text-slate-700">
                          {route.steps.map((step, i) => (
                            <li key={`${step.kind}-${i}`} className="flex gap-2">
                              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: spot.accentColor }} aria-hidden />
                              <span>{step.instruction}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigate(entry);
                            }}
                            className={`${FOCUS_RING} flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-sm active:scale-[0.97]`}
                            style={{ backgroundColor: spot.accentColor }}
                          >
                            <Navigation size={14} /> 案内をはじめる
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSpot(spot);
                            }}
                            className={`${FOCUS_RING} flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 active:bg-slate-50`}
                          >
                            くわしく <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
