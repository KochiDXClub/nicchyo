import { describe, expect, it } from "vitest";
import {
  CARD_WIDTH,
  COLLISION_TOLERANCE_PX,
  MAX_CARD_HEIGHT,
  MIN_CARD_HEIGHT,
  getCardHeight,
  hasCardCollision,
  type CardRect,
} from "./ShopScanCards";
import { quantizeRoadZoom } from "./RoadOverlay";

describe("ShopScanCards logic", () => {
  describe("getCardHeight (ズームに応じたカード高さの計算と量子化)", () => {
    it("下限 (MIN_CARD_HEIGHT: 56) と上限 (MAX_CARD_HEIGHT: 88) の範囲内に収まる", () => {
      // 遠景（引いたズーム）
      expect(getCardHeight(15)).toBe(MIN_CARD_HEIGHT);
      expect(getCardHeight(18)).toBe(MIN_CARD_HEIGHT);
      expect(getCardHeight(20)).toBe(MIN_CARD_HEIGHT);

      // 近景（拡大ズーム）
      expect(getCardHeight(22)).toBe(MAX_CARD_HEIGHT);
      expect(getCardHeight(25)).toBe(MAX_CARD_HEIGHT);
    });

    it("計算結果はすべて 4px 刻みに丸められている", () => {
      for (let z = 18; z <= 23; z += 0.25) {
        const height = getCardHeight(z);
        expect(height % 4).toBe(0);
        expect(height).toBeGreaterThanOrEqual(MIN_CARD_HEIGHT);
        expect(height).toBeLessThanOrEqual(MAX_CARD_HEIGHT);
      }
    });

    it("ズームが拡大するにつれてカード高さが単調増加する", () => {
      let prev = getCardHeight(18);
      for (let z = 18.5; z <= 22.5; z += 0.5) {
        const curr = getCardHeight(z);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });
  });

  describe("hasCardCollision (カード同士の重なり・衝突判定)", () => {
    const baseCard: CardRect = {
      x1: 100,
      y1: 100,
      x2: 100 + CARD_WIDTH,
      y2: 100 + 64,
    };

    it("完全に同じ位置のカードは衝突と判定される", () => {
      expect(hasCardCollision(baseCard, baseCard)).toBe(true);
    });

    it("大きく重なり合うカードは衝突と判定される", () => {
      const overlapping: CardRect = {
        x1: baseCard.x1 + 10,
        y1: baseCard.y1 + 10,
        x2: baseCard.x2 + 10,
        y2: baseCard.y2 + 10,
      };
      expect(hasCardCollision(baseCard, overlapping)).toBe(true);
      expect(hasCardCollision(overlapping, baseCard)).toBe(true);
    });

    it("離れているカードは衝突しない", () => {
      // 右に離れている
      const farRight: CardRect = {
        x1: baseCard.x2 + 20,
        y1: baseCard.y1,
        x2: baseCard.x2 + 20 + CARD_WIDTH,
        y2: baseCard.y2,
      };
      expect(hasCardCollision(baseCard, farRight)).toBe(false);

      // 下に離れている
      const farBottom: CardRect = {
        x1: baseCard.x1,
        y1: baseCard.y2 + 20,
        x2: baseCard.x2,
        y2: baseCard.y2 + 20 + 64,
      };
      expect(hasCardCollision(baseCard, farBottom)).toBe(false);
    });

    it(`許容範囲（COLLISION_TOLERANCE_PX=${COLLISION_TOLERANCE_PX}px）以下の接触・わずかな重なりは衝突とみなさない`, () => {
      // ちょうど外側に接している場合
      const adjacent: CardRect = {
        x1: baseCard.x2,
        y1: baseCard.y1,
        x2: baseCard.x2 + CARD_WIDTH,
        y2: baseCard.y2,
      };
      expect(hasCardCollision(baseCard, adjacent)).toBe(false);

      // 2px だけ重なっている場合 (<= 3px tolerance)
      const slightlyOverlapping: CardRect = {
        x1: baseCard.x2 - 2,
        y1: baseCard.y1,
        x2: baseCard.x2 - 2 + CARD_WIDTH,
        y2: baseCard.y2,
      };
      expect(hasCardCollision(baseCard, slightlyOverlapping)).toBe(false);

      // 4px 重なっている場合 (> 3px tolerance: 衝突とみなす)
      const collidesBy4px: CardRect = {
        x1: baseCard.x2 - 4,
        y1: baseCard.y1,
        x2: baseCard.x2 - 4 + CARD_WIDTH,
        y2: baseCard.y2,
      };
      expect(hasCardCollision(baseCard, collidesBy4px)).toBe(true);
    });
  });

  describe("RoadOverlay quantizeRoadZoom (MapLibre の step 式に合わせた切り捨て量子化)", () => {
    it("0.5 刻みで切り捨て（Math.floor）され、四捨五入による食い違いが起きない", () => {
      // レビューで指摘・解消されたケース: ズーム 19.8 が 20.0 ではなく 19.5 になること
      expect(quantizeRoadZoom(19.8)).toBe(19.5);
      expect(quantizeRoadZoom(19.99)).toBe(19.5);
      expect(quantizeRoadZoom(20.0)).toBe(20.0);
      expect(quantizeRoadZoom(20.49)).toBe(20.0);
      expect(quantizeRoadZoom(20.5)).toBe(20.5);
      expect(quantizeRoadZoom(19.49)).toBe(19.0);
    });
  });
});
