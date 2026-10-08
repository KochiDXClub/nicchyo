import { describe, it, expect } from 'vitest';
import {
  buildNearbyNote,
  isPointInRotatedRect,
  parseCssRotationRad,
  summarizeNearbyShops,
  type NearbyShopLike,
} from './viewportSummary';

// 高知市付近（緯度33.56度）で緯度0.001度 ≈ 111m、経度0.001度 ≈ 92.6m
const BASE = { lat: 33.5615, lng: 133.538 };

function shop(
  id: number,
  latOffset: number,
  lngOffset: number,
  category?: string,
  chome?: string
): NearbyShopLike {
  return {
    id,
    lat: BASE.lat + latOffset,
    lng: BASE.lng + lngOffset,
    category,
    chome,
  };
}

const containsAll = () => true;

describe('parseCssRotationRad', () => {
  it('none や空値は0を返す', () => {
    expect(parseCssRotationRad('none')).toBe(0);
    expect(parseCssRotationRad(null)).toBe(0);
    expect(parseCssRotationRad('')).toBe(0);
  });

  it('回転90度のmatrixからπ/2を取り出す', () => {
    // rotate(90deg) → matrix(cos, sin, -sin, cos, tx, ty) = matrix(0, 1, -1, 0, 0, 0)
    expect(parseCssRotationRad('matrix(0, 1, -1, 0, 100, 200)')).toBeCloseTo(
      Math.PI / 2,
      6
    );
  });

  it('回転なしのmatrix（translateのみ）は0を返す', () => {
    expect(parseCssRotationRad('matrix(1, 0, 0, 1, 50, 50)')).toBeCloseTo(0, 6);
  });

  it('解釈できない文字列は0を返す', () => {
    expect(parseCssRotationRad('rotate(unknown)')).toBe(0);
  });
});

describe('isPointInRotatedRect', () => {
  const center = { x: 100, y: 100 };

  it('回転なし: 軸並行の内外判定になる', () => {
    const rect = { center, halfWidth: 40, halfHeight: 20, rotationRad: 0 };
    expect(isPointInRotatedRect({ x: 130, y: 110 }, rect)).toBe(true);
    expect(isPointInRotatedRect({ x: 150, y: 100 }, rect)).toBe(false); // 幅超過
    expect(isPointInRotatedRect({ x: 100, y: 130 }, rect)).toBe(false); // 高さ超過
  });

  it('90度回転: 幅と高さが入れ替わる', () => {
    const rect = {
      center,
      halfWidth: 40,
      halfHeight: 20,
      rotationRad: Math.PI / 2,
    };
    // コンテナ上で中心の真横35pxの点は、画面上では縦方向に35px → halfWidth(40)内ではなく
    // 回転後は y 方向の判定（halfHeight=20）を超えるか？
    // rotate(90°): (35, 0) → (0, 35) → |35| > halfHeight(20) → 外
    expect(isPointInRotatedRect({ x: 135, y: 100 }, rect)).toBe(false);
    // (0, 35) → (-35, 0) → |−35| <= halfWidth(40) → 内
    expect(isPointInRotatedRect({ x: 100, y: 135 }, rect)).toBe(true);
  });

  it('45度回転: 対角方向の点が正しく判定される', () => {
    const rect = {
      center,
      halfWidth: 40,
      halfHeight: 20,
      rotationRad: Math.PI / 4,
    };
    // (20, -20) → rotate45° → (√2*20, 0) ≈ (28.3, 0) → 内
    expect(isPointInRotatedRect({ x: 120, y: 80 }, rect)).toBe(true);
    // (20, 20) → rotate45° → (0, √2*20) ≈ (0, 28.3) → 高さ超過で外
    expect(isPointInRotatedRect({ x: 120, y: 120 }, rect)).toBe(false);
  });
});

describe('summarizeNearbyShops', () => {
  it('contains 判定に合致する店舗のみを集計する', () => {
    const shops = [
      shop(1, 0, 0, '食材'),
      shop(2, 0.0005, 0, '食材'),
      shop(3, 0.01, 0, '食材'), // 範囲外にする
    ];
    const summary = summarizeNearbyShops(
      shops,
      BASE,
      (p) => Math.abs(p.lat - BASE.lat) < 0.005
    );
    expect(summary.totalCount).toBe(2);
    expect(summary.shopIds).toEqual([1, 2]);
  });

  it('shopIds は中心から近い順になる', () => {
    const shops = [
      shop(10, 0.001, 0, '食材'), // 約111m
      shop(11, 0.0002, 0, '食べ物'), // 約22m
      shop(12, 0.0005, 0, '食材'), // 約55m
    ];
    const summary = summarizeNearbyShops(shops, BASE, containsAll);
    expect(summary.shopIds).toEqual([11, 12, 10]);
    expect(summary.genres.find((g) => g.category === '食材')?.shopIds).toEqual([12, 10]);
  });

  it('ジャンルは店舗数の多い順に並ぶ', () => {
    const shops = [
      shop(1, 0, 0, '食べ物'),
      shop(2, 0.0001, 0, '食材'),
      shop(3, 0.0002, 0, '食材'),
      shop(4, 0.0003, 0, '食材'),
      shop(5, 0.0004, 0, '食べ物'),
    ];
    const summary = summarizeNearbyShops(shops, BASE, containsAll);
    expect(summary.genres.map((g) => g.category)).toEqual(['食材', '食べ物']);
    expect(summary.genres[0].count).toBe(3);
  });

  it('丁目は出現順ではなく一丁目→七丁目の順で返す', () => {
    const shops = [
      shop(1, 0, 0, '食材', '三丁目'),
      shop(2, 0.0001, 0, '食材', '一丁目'),
      shop(3, 0.0002, 0, '食材', '三丁目'),
    ];
    const summary = summarizeNearbyShops(shops, BASE, containsAll);
    expect(summary.chomeLabels).toEqual(['一丁目', '三丁目']);
  });

  it('カテゴリ未設定は「その他」に分類する', () => {
    const shops = [shop(1, 0, 0, undefined), shop(2, 0.0001, 0, '  ')];
    const summary = summarizeNearbyShops(shops, BASE, containsAll);
    expect(summary.genres).toEqual([
      { category: 'その他', count: 2, shopIds: [1, 2] },
    ]);
  });

  it('店舗がない場合は空の要約を返す', () => {
    const summary = summarizeNearbyShops([], BASE, containsAll);
    expect(summary).toEqual({
      totalCount: 0,
      chomeLabels: [],
      genres: [],
      shopIds: [],
    });
  });
});

describe('buildNearbyNote', () => {
  it('店舗がない場合は移動を促す', () => {
    const summary = summarizeNearbyShops([], BASE, containsAll);
    expect(buildNearbyNote(summary)).toContain('見当たらん');
  });

  it('ジャンルが1つならそのジャンルに言及する', () => {
    const summary = summarizeNearbyShops([shop(1, 0, 0, '食材')], BASE, containsAll);
    expect(buildNearbyNote(summary)).toContain('食材');
  });

  it('ジャンルが複数なら上位2ジャンルに言及する', () => {
    const summary = summarizeNearbyShops(
      [
        shop(1, 0, 0, '食材'),
        shop(2, 0.0001, 0, '食材'),
        shop(3, 0.0002, 0, '食べ物'),
      ],
      BASE,
      containsAll
    );
    const note = buildNearbyNote(summary);
    expect(note).toContain('食材');
    expect(note).toContain('食べ物');
  });
});
