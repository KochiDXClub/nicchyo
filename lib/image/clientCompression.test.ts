import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  calculateFitDimensions,
  resizeImageToBlob,
  createStoreImages,
  createPostImage,
} from "./clientCompression";

class MockImage {
  naturalWidth = 2400;
  naturalHeight = 1600;
  width = 2400;
  height = 1600;
  decoding = "async";
  private _src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  get src() {
    return this._src;
  }
  set src(val: string) {
    this._src = val;
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

describe("calculateFitDimensions", () => {
  it("長辺が maxDimension より小さいときは元のサイズを維持する", () => {
    expect(calculateFitDimensions(800, 600, 1200)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("横長画像（幅 > 高さ）の場合、幅が maxDimension に縮小され、アスペクト比が保たれる", () => {
    expect(calculateFitDimensions(3000, 1500, 1200)).toEqual({
      width: 1200,
      height: 600,
    });
  });

  it("縦長画像（高さ > 幅）の場合、高さが maxDimension に縮小され、アスペクト比が保たれる", () => {
    expect(calculateFitDimensions(1500, 3000, 1200)).toEqual({
      width: 600,
      height: 1200,
    });
  });

  it("正方形画像の場合、両辺が maxDimension に縮小される", () => {
    expect(calculateFitDimensions(2000, 2000, 160)).toEqual({
      width: 160,
      height: 160,
    });
  });

  it("異常値（0 や負数）でも 1px 以上を返す", () => {
    expect(calculateFitDimensions(0, 0, 100)).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe("resizeImageToBlob & createStoreImages", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", MockImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("Canvas を使ってリサイズと toBlob 変換を行う", async () => {
    const mockBlob = new Blob(["dummy-image"], { type: "image/webp" });

    const mockContext = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
        callback(mockBlob);
      }),
    };
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    const result = await resizeImageToBlob(file, {
      maxDimension: 1200,
      quality: 0.8,
      mimeType: "image/webp",
    });

    expect(result).toBe(mockBlob);
    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBe(800);
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  it("createStoreImages でメイン用とサムネイル用の 2 つの Blob が生成される", async () => {
    const mockMainBlob = new Blob(["main"], { type: "image/webp" });
    const mockThumbBlob = new Blob(["thumb"], { type: "image/webp" });

    let callCount = 0;
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
        callCount++;
        callback(callCount % 2 === 1 ? mockMainBlob : mockThumbBlob);
      }),
    };
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    const file = new File(["test"], "photo.png", { type: "image/png" });
    const { mainBlob, thumbBlob } = await createStoreImages(file);

    expect(mainBlob).toBeDefined();
    expect(thumbBlob).toBeDefined();
  });

  it("createPostImage で単一の WebP Blob が生成される", async () => {
    const mockBlob = new Blob(["post-image"], { type: "image/webp" });

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
        callback(mockBlob);
      }),
    };
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    const file = new File(["test"], "photo.heic", { type: "image/heic" });
    const postBlob = await createPostImage(file);

    expect(postBlob).toBe(mockBlob);
    expect(mockCanvas.width).toBe(1200);
  });
});
