/**
 * 写真の上に白い文字を載せるときの幕。写真の下側だけを暗くする。
 * 店のバナー（ShopBannerHero）と同じ幕にそろえ、このページではここ1か所で持つ
 */
export default function PhotoScrim() {
  return <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />;
}
