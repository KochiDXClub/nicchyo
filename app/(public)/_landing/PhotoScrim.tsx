/**
 * 写真の上に白い文字を載せるときの幕。写真の下側を暗くする。
 * 店のバナー（ShopBannerHero）と同じ幕にそろえ、このページではここ1か所で持つ。
 * withTop … 写真の上側にも文字を置くとき、上も少し暗くする
 */
export default function PhotoScrim({ withTop = false }: { withTop?: boolean }) {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      {/* 同じ幕を上下逆さにして薄く敷く（上の文字用） */}
      {withTop ? (
        <div aria-hidden className="absolute inset-x-0 top-0 h-2/5 rotate-180 bg-gradient-to-t from-black/70 via-black/15 to-transparent opacity-60" />
      ) : null}
    </>
  );
}
