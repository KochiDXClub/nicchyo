/**
 * 「ここへ案内」で、閉じた状態からそのまま案内が始まることを守るテスト（#639）
 *
 * 閉じている状態から案内を始めると、呼び出し側が URL を ?guide=menu にするため
 * query が null → { kinds: [] } に変わる。フックには「閉じて開き直したときは
 * 選択・案内中をリセットする」処理があり、素直に走ると直前に始めた案内が消えて
 * 「おでかけサポートが開いただけ」になってしまう。
 *
 * 一方で、/facilities から種類を変えて開き直したときのリセットは効いてほしい。
 * その両方をここで確かめる。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOdekakeGuide } from './useOdekakeGuide';
import type { Landmark } from '../types/landmark';
import type { GuideQuery } from '@/lib/guide/query';

vi.mock('@/lib/analytics/sendEvent', () => ({ sendEvent: vi.fn() }));

const LANDMARKS: Landmark[] = [
  {
    key: 'restroom-a',
    name: 'テストのお手洗い',
    description: '',
    url: '',
    lat: 33.5605,
    lng: 133.5311,
    widthPx: 40,
    heightPx: 40,
    showAtMinZoom: false,
    category: 'restroom',
  },
];

/** 現在地を許可済みで即座に返す geolocation を用意する */
function mockGeolocation() {
  const watchPosition = vi.fn((success: PositionCallback) => {
    success({
      coords: { latitude: 33.56, longitude: 133.5311, accuracy: 5 },
    } as GeolocationPosition);
    return 1;
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch: vi.fn(), getCurrentPosition: vi.fn() },
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: 'granted', onchange: null }) },
  });
}

describe('useOdekakeGuide の「ここへ案内」', () => {
  beforeEach(() => {
    mockGeolocation();
  });

  it('閉じた状態から案内を始めて開いても、案内が消えない', async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: GuideQuery | null }) =>
        useOdekakeGuide({ query, landmarks: LANDMARKS, mapRoute: undefined }),
      { initialProps: { query: null as GuideQuery | null } }
    );

    // 閉じている状態で「ここへ案内」を押す
    const spot = { id: 'restroom-a', kind: 'restroom' as const, lat: 33.5605, lng: 133.5311, name: 'テストのお手洗い' };
    await act(async () => {
      result.current.startNavigation(spot as Parameters<typeof result.current.startNavigation>[0]);
    });

    // 呼び出し側が URL を ?guide=menu にする（= query が開いた状態に変わる）
    await act(async () => {
      rerender({ query: { kinds: [] } });
    });

    expect(result.current.selectedId).toBe('restroom-a');
  });

  it('種類を変えて開き直したときは、これまでどおりリセットされる', async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: GuideQuery | null }) =>
        useOdekakeGuide({ query, landmarks: LANDMARKS, mapRoute: undefined }),
      { initialProps: { query: { kinds: ['restroom'] } as GuideQuery | null } }
    );

    const spot = { id: 'restroom-a', kind: 'restroom' as const, lat: 33.5605, lng: 133.5311, name: 'テストのお手洗い' };
    await act(async () => {
      result.current.startNavigation(spot as Parameters<typeof result.current.startNavigation>[0]);
    });
    expect(result.current.selectedId).toBe('restroom-a');

    // /facilities から別の種類で開き直す
    await act(async () => {
      rerender({ query: { kinds: ['rest'] } });
    });

    expect(result.current.selectedId).toBeNull();
  });
});
