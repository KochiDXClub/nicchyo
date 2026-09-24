import { describe, expect, it } from 'vitest';
import {
  FALLBACK_DEMO_SHOPS,
  pickIntroDemoShops,
  pickIntroSearchShops,
} from './introDemoShops';
import type { Shop } from '../../types/shopData';

function shop(id: number, name: string, category: string): Shop {
  return {
    id,
    name,
    category,
    products: [],
    ownerName: '',
    description: '',
    schedule: '',
    position: id,
    lat: 0,
    lng: 0,
  } as Shop;
}

const SHOPS: Shop[] = [
  shop(5, '食材A', '食材'),
  shop(3, '食材B', '食材'),
  shop(9, '食べ物A', '食べ物'),
  shop(1, '食べ物B', '食べ物'),
  shop(7, '植物A', '植物・苗'),
  shop(4, '道具A', '道具・工具'),
];

describe('pickIntroDemoShops', () => {
  it('店舗が無ければ控えのデモ店舗を返す', () => {
    expect(pickIntroDemoShops([], 3)).toEqual(FALLBACK_DEMO_SHOPS.slice(0, 3));
    expect(pickIntroDemoShops(undefined, 3)).toEqual(FALLBACK_DEMO_SHOPS.slice(0, 3));
  });

  it('屋台の色がばらけるよう、カテゴリを重複させずに選ぶ', () => {
    const picked = pickIntroDemoShops(SHOPS, 4);
    const categories = picked.map((s) => s.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('カテゴリ内では id の小さい店を選び、開くたびに変わらない', () => {
    const picked = pickIntroDemoShops(SHOPS, 4);
    expect(picked).toEqual(pickIntroDemoShops(SHOPS, 4));
    const foodstuff = picked.find((s) => s.category === '食材');
    expect(foodstuff?.id).toBe(3);
  });

  it('カテゴリ数より多く求められたら、残りから補う', () => {
    const picked = pickIntroDemoShops(SHOPS, 6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((s) => s.id)).size).toBe(6);
  });

  it('名前が無い店は使わない', () => {
    const picked = pickIntroDemoShops([shop(1, '   ', '食材'), shop(2, '野菜屋', '食材')], 1);
    expect(picked[0]?.name).toBe('野菜屋');
  });

  it('カテゴリが空でも表示できるよう既定値を入れる', () => {
    const picked = pickIntroDemoShops([shop(1, '名無しカテゴリ', '')], 1);
    expect(picked[0]?.category).toBe('食材');
  });
});

describe('pickIntroSearchShops', () => {
  it('絞り込みの手応えが出るよう、カテゴリごとに複数件返す', () => {
    const picked = pickIntroSearchShops(SHOPS, ['食材', '食べ物'], 2);
    expect(picked).toHaveLength(4);
    expect(picked.filter((s) => s.category === '食材')).toHaveLength(2);
    expect(picked.filter((s) => s.category === '食べ物')).toHaveLength(2);
  });

  it('その店が無いカテゴリは黙って飛ばす', () => {
    const picked = pickIntroSearchShops(SHOPS, ['食材', 'アクセサリー'], 2);
    expect(picked.every((s) => s.category === '食材')).toBe(true);
  });

  it('店舗が無ければ控えのデモ店舗から拾う', () => {
    const picked = pickIntroSearchShops([], ['食材'], 2);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((s) => s.category === '食材')).toBe(true);
  });
});
