import { describe, expect, it } from "vitest";
import { sniffImageType } from "./imageSniff";

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("先頭のバイトで jpeg / png / webp を判定する", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([...ascii("RIFF"), 1, 0, 0, 0, ...ascii("WEBP")]))).toBe("image/webp");
  });

  it("画像でないもの（SVG・HTML・GIF・短すぎる）は null", () => {
    expect(sniffImageType(new Uint8Array(ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")))).toBeNull();
    expect(sniffImageType(new Uint8Array(ascii("<html><script>")))).toBeNull();
    expect(sniffImageType(new Uint8Array(ascii("GIF89a....")))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    // RIFF だが WebP ではない（WAV など）
    expect(sniffImageType(new Uint8Array([...ascii("RIFF"), 1, 0, 0, 0, ...ascii("WAVE")]))).toBeNull();
  });
});
