'use client';

/**
 * OdekakeGuidePanel
 *
 * おでかけサポートのボトムシート。
 *
 *   - 種類が決まるまでは画面中央の選択画面（OdekakeKindChooser）に任せる
 *   - たたむと小さなピルだけ。マップを隠さない
 *   - lg 以上（PC・ノートPC）は、下から出るシートではなく、左上に浮かぶパネル（幅 24rem）にする。
 *     画面の端から端まで広がると、名前と所要時間が左右に離れすぎて読みにくく、地図も隠れるため
 *   - 開くと: 種類の切り替え / 起点 / 行程表
 *   - 行程表は「起点 → 各スポット」を縦の破線でつないだ停留所リスト。
 *     マップに引く破線ルートと同じ表現で、どこからどこへ行くのかが一目で分かる
 *   - 行をタップするとすぐ場所のカード（SpotCard）が開く。暗幕は敷かず、背後の地図はそのまま触れる。写真があれば行に添える
 *
 * 計算はすべて useOdekakeGuide 側。ここは見た目と操作だけを担当する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, Navigation, X as XIcon } from 'lucide-react';
import type { MapSpot, SpotKind } from '@/lib/spots';
import type { RankedSpot } from '@/lib/guide';
import { formatDistance } from '@/lib/facilities/nearest';
import type { MapCamera } from '../types/mapCamera';
import { GUIDE_KIND_OPTIONS, type OdekakeGuide } from '../hooks/useOdekakeGuide';
import OdekakeKindChooser from './OdekakeKindChooser';
import SpotKindIcon from './SpotKindIcon';

type OdekakeGuidePanelProps = {
  guide: OdekakeGuide;
  map: MapCamera | null;
  onClose: () => void;
  /** スポットカードが開いている間は一覧をたたまずに隠す（閉じたら元の一覧に戻る） */
  hidden?: boolean;
  onOpenSpot: (spot: MapSpot) => void;
};

const FOCUS_ZOOM = 17;
/** シートをたたむのに必要な、下方向のドラッグ量（px） */
const DRAG_CLOSE_PX = 100;
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
      className="flex items-center justify-center rounded-full bg-nicchyo-soft-green/30"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <SpotKindIcon kind={spot.kind} transitMode={spot.transitMode} size={Math.round(size * 0.7)} />
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
      className={`${FOCUS_RING} flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[13px] font-bold transition-all active:scale-[0.97] ${
        active
          ? 'bg-nicchyo-ink text-white shadow-pop'
          : 'bg-white text-nicchyo-ink shadow-chip active:bg-nicchyo-base'
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

/** 選択画面に添える、種類ごとの件数 */
function countSpotsByKind(spots: MapSpot[]): Partial<Record<SpotKind, number>> {
  const counts: Partial<Record<SpotKind, number>> = {};
  for (const spot of spots) counts[spot.kind] = (counts[spot.kind] ?? 0) + 1;
  return counts;
}

export default function OdekakeGuidePanel({ guide, map, onClose, hidden = false, onOpenSpot }: OdekakeGuidePanelProps) {
  const [isOpen, setIsOpen] = useState(guide.kinds.length === 0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // 種類が未選択なら、えらぶために開く
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

  // パネルの外（地図）をなぞる・タップしたら、シートをたたんで地図を探索できるようにする（Googleマップと同じ）。
  // 地図の印からカードを開いた場合もたたむ。カードを閉じた後はピルから一覧を開き直せる。
  // dragstart は人が動かしたときだけ飛ぶので、案内が自動で地図を動かしてもたたまれない
  useEffect(() => {
    if (!map || hidden) return;
    const collapse = () => setIsOpen(false);
    const container = map.getContainer();
    map.on('dragstart', collapse);
    container.addEventListener('click', collapse);
    return () => {
      map.off('dragstart', collapse);
      container.removeEventListener('click', collapse);
    };
  }, [map, hidden]);

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
    // カード（SpotCard）を見ている間（hidden）は、地図を勝手に動かさない
    if (!nearestId || hidden || guide.navigating || guide.selectedId) return;
    const entry = guide.ranked.find((e) => e.spot.id === nearestId);
    if (entry) focusEntry(entry);
    // 起点の細かな更新のたびには動かさない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestId]);

  // Googleマップと同じく、行をタップしたらすぐその場所のカードを開く（経路は選択でマップに引かれる）
  const handleRowTap = useCallback(
    (entry: RankedSpot) => {
      // カードを閉じた後も目的地と経路を保持する。種類の切り替えで選択をリセットする。
      guide.select(entry.spot.id);
      onOpenSpot(entry.spot);
    },
    [guide, onOpenSpot]
  );

  const handleNavigate = useCallback(
    (entry: RankedSpot) => {
      guide.startNavigation(entry.spot);
      focusEntry(entry);
    },
    [focusEntry, guide]
  );

  const handleDragStart = (clientX: number, clientY: number) => {
    dragStart.current = { x: clientX, y: clientY };
  };
  // 少し下へ払っただけでは閉じない。縦方向に大きく、ほぼまっすぐ下へ引いたときだけたたむ
  const handleDragEnd = (clientX: number, clientY: number) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dy = clientY - start.y;
    if (dy > DRAG_CLOSE_PX && dy > Math.abs(clientX - start.x) * 2) setIsOpen(false);
  };

  const choosing = guide.kinds.length === 0;
  const title = choosing
    ? 'おでかけサポート'
    : GUIDE_KIND_OPTIONS.filter((o) => guide.kinds.includes(o.kind))
        .map((o) => o.label)
        .join('・');
  const nearest = guide.nearest;
  const originLabel = guide.origin?.label ?? '現在地';

  // まだ何を探すか決まっていないうちは、画面の中央で選んでもらう。
  // 下の帯に小さなチップを並べるだけでは、初めての人に何ができるのか伝わらない
  if (hidden) return null;
  if (choosing && !guide.navigating) {
    return <OdekakeKindChooser onSelect={guide.toggleKind} onClose={onClose} counts={countSpotsByKind(guide.spots)} />;
  }

  return (
    <>
      {/* ピル：たたんでいるときの表示 */}
      {!isOpen && !guide.navigating && (
        <div
          // lg 以上は下端のナビが無いので、パネルと同じ左側の下に置く
          className="pointer-events-auto absolute left-1/2 z-[1100] -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+0.5rem+25px)] lg:bottom-6 lg:left-4 lg:translate-x-0"
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
                {nearest?.route ? 'いちばん近い' : needsLocationAttention ? title : choosing ? '種類をえらぶ' : title}
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

      {/* シート本体 */}
      <div
        className={`pointer-events-auto absolute bottom-0 left-0 right-0 z-[1650] flex max-h-[55dvh] flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(58,58,58,0.22)] transition-transform duration-300 ease-out motion-reduce:transition-none lg:bottom-auto lg:left-4 lg:right-auto lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:w-[24rem] lg:rounded-card lg:shadow-float lg:ring-1 lg:ring-line ${
          isOpen ? 'translate-y-0' : 'translate-y-full lg:-translate-x-[calc(100%+2rem)] lg:translate-y-0'
        }`}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="false"
        aria-label="おでかけサポート"
        aria-hidden={!isOpen}
      >
        {/* ハンドル + 見出し */}
        {/* たたむドラッグはここ（ハンドル・見出し）だけ。一覧のスクロールでは反応させない */}
        <div
          className="shrink-0 rounded-t-[28px] bg-nicchyo-base/70 lg:rounded-t-card"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
          onTouchCancel={() => (dragStart.current = null)}
        >
          <div className="flex justify-center pb-1 pt-2 lg:hidden">
            <span className="h-1 w-9 rounded-full bg-slate-300" />
          </div>
          {/* 見出し = 種類の切り替え（複数選択）。選んだ種類がそのままタイトルになる */}
          <div className="flex items-center gap-2 pb-2 pl-5 pr-4 lg:pt-3">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
              {GUIDE_KIND_OPTIONS.map((option) => (
                <KindToggle key={option.kind} active={guide.kinds.includes(option.kind)} onClick={() => guide.toggleKind(option.kind)}>
                  <span aria-hidden className="inline-flex">
                    <SpotKindIcon kind={option.kind} size={18} />
                  </span>
                  {option.label}
                </KindToggle>
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="おでかけサポートをとじる"
              className={`${FOCUS_RING} flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full bg-nicchyo-ink/[0.07] text-nicchyo-ink/70 active:bg-nicchyo-ink/[0.14]`}
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
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
                    <div className={`-mx-2 rounded-2xl px-2 py-2.5 transition-colors ${isSelected ? 'bg-nicchyo-base' : ''}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowTap(entry);
                          }}
                          className={`${FOCUS_RING} flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left`}
                        >
                          <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                            <SpotIcon spot={spot} size={36} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className={`line-clamp-2 leading-tight text-nicchyo-ink ${isNearest ? 'text-[15px] font-black' : 'text-[14px] font-bold'}`}>
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
                      {/* Googleマップのように、名前の下に写真を大きく置く */}
                      {spot.photoUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowTap(entry);
                          }}
                          aria-label={`${spot.name}の詳細を開く`}
                          className={`${FOCUS_RING} mt-2.5 block w-full overflow-hidden rounded-card`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={spot.photoUrl} alt="" loading="lazy" draggable={false} className="h-44 w-full bg-nicchyo-base object-cover" />
                        </button>
                      )}
                    </div>

                  </li>
                );
              })}
            </ol>
          )}
          {/* 旧 /facilities ページにあった断り書き。一覧の下に1行だけ残す */}
          <p className="mx-5 mb-1 mt-3 text-[11px] leading-relaxed text-slate-400">
            掲載している情報は変わることがあります。当日の最新の状況は、現地の案内表示もあわせてご確認ください。
          </p>
        </div>
      </div>
    </>
  );
}
