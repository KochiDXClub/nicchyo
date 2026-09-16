import { redirect } from 'next/navigation';

/**
 * /facilities（おでかけサポートのページ）
 *
 * 以前は「お手洗い・休けい・のりもの」から種類を選ぶだけのページで、選ぶと
 * /map?facility=… に飛んで結局は地図に戻っていた。地図の上に同じ選択画面
 * （OdekakeKindChooser）を作ったので、ページを経由する意味が無くなった。
 * 種類の定義も2か所にあって既にズレていた（ページは3種類、地図は4種類）。
 *
 * URL は残す。ブックマークや外で共有されたリンク、にちよさんの自由回答が
 * /facilities を指していることがあり、消すと壊れる。中身は地図の選択画面へ送るだけにする。
 * 種類つきの URL（/map?facility=restroom）は従来どおり地図側が受け取る。
 * /facilities に付いたクエリは引き継がない（/facilities?facility= を作る箇所は無い）。
 *
 * 307（redirect）にしているのは、ページを戻す余地を残すため。308 はブラウザに
 * 強くキャッシュされ、戻したときに古い転送が残る。
 *
 * おでかけサポートだけを非公開にする設定は無くした。地図（/map、常に公開）の
 * 一部になったため、表示可否は地図に従う。隠したくなったら起動ボタン側で判定する。
 */
export default function FacilitiesPage() {
  redirect('/map?guide=menu');
}
