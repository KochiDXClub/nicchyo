'use client';

import { useEffect, useMemo, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { grandmaComments } from '../data/grandmaComments';

const OBAASAN_IMAGE = '/characters/obaasan.png';
const ROTATION_INTERVAL_MS = 8000;

// 背景イラストと向きを合わせるための回転角（反時計回り100度）
const ICON_ROTATION_DEG = -100;

// 最大縮小時にだけ表示するおばあちゃんアイコンの座標（実地図との位置合わせは未確定の仮置き）
const MARKER_POSITION: [number, number] = [33.56484746676249, 133.5383003532079];

// コメント吹き出しだけアイコンからずらして表示するための座標（西180m・北90m）
const COMMENT_OFFSET_METERS_EAST = -180;
const COMMENT_OFFSET_METERS_NORTH = 90;
const metersPerLngDegAtMarker = 111320 * Math.cos((MARKER_POSITION[0] * Math.PI) / 180);
const COMMENT_POSITION: [number, number] = [
  MARKER_POSITION[0] + COMMENT_OFFSET_METERS_NORTH / 111320,
  MARKER_POSITION[1] + COMMENT_OFFSET_METERS_EAST / metersPerLngDegAtMarker,
];

const monologueComments = grandmaComments.filter((c) => c.genre === 'monologue');

function createObaasanIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-grandma-icon',
    html: `<img src="${OBAASAN_IMAGE}" alt="おばあちゃん" draggable="false" style="width:64px;height:64px;object-fit:contain;cursor:pointer;transform:rotate(${ICON_ROTATION_DEG}deg);" />`,
    iconSize: [64, 64],
    iconAnchor: [32, 64],
  });
}

// コメント吹き出し専用の透明アイコン（見た目はなく、ツールチップの位置決めだけに使う）
function createInvisibleIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-grandma-comment-anchor',
    html: '',
    iconSize: [0, 0],
  });
}

export default function MinZoomGrandmaMarker() {
  const [commentIndex, setCommentIndex] = useState(0);
  const icon = useMemo(() => createObaasanIcon(), []);
  const commentAnchorIcon = useMemo(() => createInvisibleIcon(), []);

  useEffect(() => {
    if (monologueComments.length === 0) return;
    const timer = setInterval(() => {
      setCommentIndex((prev) => (prev + 1) % monologueComments.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (monologueComments.length === 0) return null;

  const currentComment = monologueComments[commentIndex];

  return (
    <>
      <Marker
        position={MARKER_POSITION}
        icon={icon}
        interactive
        keyboard={false}
        eventHandlers={{
          click: () => setCommentIndex((prev) => (prev + 1) % monologueComments.length),
        }}
      />
      <Marker position={COMMENT_POSITION} icon={commentAnchorIcon} interactive={false} keyboard={false}>
        <Tooltip permanent direction="top" offset={[0, -10]} opacity={1} className="map-grandma-bubble">
          <span className="map-grandma-bubble-inner">{currentComment.text}</span>
        </Tooltip>
      </Marker>
    </>
  );
}
