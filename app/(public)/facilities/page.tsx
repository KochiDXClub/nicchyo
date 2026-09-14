import { redirect } from 'next/navigation';

/**
 * /facilities（おでかけサポートのページ）
 *
 * 以前は「お手洗い・休けい・のりもの」から種類を選ぶだけのページで、選ぶと
 * /map?facility=… に飛んで結局は地図に戻っていた。地図の上に同じ選択画面
 * （OdekakeKindChooser）を作ったので、ページを経由する意味が無くなった。
 * 種類の定義も2か所にあって既にズレていた（ページは3種類、地図は4種類）。
 *
 * URL は残す。にちよさんの回答や共有リンクが /facilities を指しているため、
 * 消すと壊れる。中身は地図の選択画面へ送るだけにする。
 * ?facility=restroom のような種類つきの URL は、もともと地図側が受け取る。
 */
export default function FacilitiesPage() {
  redirect('/map?guide=menu');
}
