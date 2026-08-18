import { Metadata } from "next";
import NavigationBar from "../../components/NavigationBar";
import MapLink from "../../components/MapLink";

export const metadata: Metadata = {
  title: "午後のイベント | nicchyo 日曜市",
  description:
    "日曜市が終わった後も楽しめる、地域イベントやワークショップの情報ページです。",
};

export default function EventsPage() {
  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <main className="flex-1 overflow-y-auto pb-20 pt-4">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border-4 border-amber-200 bg-white p-8 text-center shadow-xl md:p-12">
            <div className="mb-6 text-6xl">🎪</div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">イベント情報 準備中</h2>
            <p className="mb-6 mx-auto max-w-2xl text-gray-700">
              日曜市の後に楽しめる地域イベントやワークショップの情報を、現在準備しています。
              もうしばらくお待ちください。
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <MapLink
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-500"
              >
                <span>🗺️</span>
                マップを見る
              </MapLink>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-white p-6 shadow-md">
              <div className="mb-3 text-3xl">🎨</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">ワークショップ</h3>
              <p className="text-sm text-gray-700">
                地元の職人による体験型ワークショップ情報をお届けします。
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-6 shadow-md">
              <div className="mb-3 text-3xl">🎵</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">音楽イベント</h3>
              <p className="text-sm text-gray-700">
                市場周辺で開催される音楽イベントやパフォーマンス情報。
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-6 shadow-md">
              <div className="mb-3 text-3xl">🍺</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">グルメイベント</h3>
              <p className="text-sm text-gray-700">
                日曜市の食材を使った料理教室やフードイベント情報。
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-6 shadow-md">
              <div className="mb-3 text-3xl">🏛️</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">文化体験</h3>
              <p className="text-sm text-gray-700">
                高知の文化や歴史を学べる体験プログラム情報。
              </p>
            </div>
          </div>
        </div>
      </main>

      <NavigationBar />
    </div>
  );
}
