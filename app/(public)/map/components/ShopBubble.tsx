/**
 * 店舗の商品吹き出しコンポーネント
 *
 * 店舗イラストの横に表示される商品アイコン
 * 静的マークアップ生成に対応（renderToStaticMarkup互換）
 *
 * 【動的サイズ対応】
 * - offset パラメータで店舗イラストサイズに応じた位置調整が可能
 * - イラストサイズが変わっても自動的に適切な位置に配置される
 */

interface ShopBubbleProps {
  icon: string;
  products: string[];
  side: 'north' | 'south'; // 吹き出しの向き（北側=左、南側=右）
  offset?: number; // 店舗イラストからのオフセット（px）
}

export default function ShopBubble({ icon, side, offset = 35 }: ShopBubbleProps) {
  // 吹き出しの向き（北側は左、南側は右）
  const isNorth = side === 'north';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={isNorth ? "-45 -15 60 30" : "-15 -15 60 30"}
      width="60"
      height="30"
      className="shop-bubble pointer-events-none"
      style={{
        position: 'absolute',
        top: '10px',
        left: isNorth ? `-${offset}px` : `${offset + 20}px`,
      }}
    >
      {/* 吹き出し本体 */}
      <ellipse
        cx={isNorth ? "-25" : "25"}
        cy="0"
        rx="20"
        ry="12"
        fill="white"
        stroke="#666"
        strokeWidth="1"
      />

      {/* 吹き出しの尖り（矢印） */}
      <polygon
        points={isNorth ? "-10,0 0,0 -5,3" : "10,0 0,0 5,3"}
        fill="white"
        stroke="#666"
        strokeWidth="1"
      />

      {/* 商品アイコン */}
      <text
        x={isNorth ? "-25" : "25"}
        y="4"
        fontSize="14"
        textAnchor="middle"
      >
        {icon}
      </text>
    </svg>
  );
}
