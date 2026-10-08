import { Metadata } from "next";
import FavoritesPageClient from "./FavoritesPageClient";

export const metadata: Metadata = {
  title: "お気に入り",
  description:
    "気になったお店と商品をまとめて見られます。日曜市を歩きながら「あとで戻りたい」と思ったお店に、そのまま地図で戻れます。",
};

export default function FavoritesPage() {
  return <FavoritesPageClient />;
}
