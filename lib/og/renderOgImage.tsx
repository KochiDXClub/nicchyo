import { ImageResponse } from "next/og";

const OG_SIZE = { width: 1200, height: 630 } as const;

// ImageResponse は Tailwind のトークンを使えないため、ブランドパレット
// （tailwind.config の nicchyo-ink / nicchyo-primary）と同じ値を持つ。
const INK = "#3A3A3A";
const PRIMARY = "#7ED957";

/**
 * 共有カード（OGP / Twitter カード）用の 1200x630 画像を作る。
 * 背景は既存のトップ画像（public/images/home-hero.jpg）を使い、新しい素材は作らない。
 * ImageResponse の標準フォントは日本語を持たないため、文字は英数字のブランド名だけにしている
 * （説明文は og:title / og:description 側に出る）。
 */
export async function renderOgImage(request: Request, caption: string): Promise<ImageResponse> {
  let background: string | null = null;
  try {
    const res = await fetch(new URL("/images/home-hero.jpg", request.url));
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer());
      background = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    }
  } catch {
    // 背景が取れなくても無地で返す（共有カードが 404 になるよりよい）
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: PRIMARY,
        }}
      >
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse(satori) 内では next/image を使えない
          <img
            src={background}
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            padding: "40px 64px",
            background: "rgba(255, 250, 240, 0.92)",
            color: INK,
          }}
        >
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1 }}>nicchyo</div>
          <div style={{ fontSize: 32, marginTop: 12 }}>{caption}</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    }
  );
}
