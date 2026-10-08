"use client";

import { useState, useRef } from 'react';
import NavigationBar from '../../components/NavigationBar';
import { MessageSquarePlus, Sparkles, PencilLine } from 'lucide-react';

interface Post {
  id: number;
  name: string;
  avatarColor: string;
  content: string;
  time: string;
}
// Empty mock data to demonstrate the empty state
const MOCK_POSTS: Post[] = [];

/*
// Previous mock data for reference
const MOCK_POSTS = [
  {
    id: 1,
    name: "観光客さん",
    avatarColor: "bg-blue-100",
    content: "初めて日曜市に来ました！活気があって楽しい！",
    time: "5分前"
  },
  {
    id: 2,
    name: "地元の方",
    avatarColor: "bg-green-100",
    content: "今日は野菜が新鮮でした。おすすめです！",
    time: "10分前"
  }
];
*/

export default function PostsClient() {
  const [posts] = useState(MOCK_POSTS);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = () => {
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* メインコンテンツ */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto pt-4">
        <div className="max-w-2xl mx-auto">
          {/* 投稿ボックス */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 border border-amber-100">
            <textarea
              ref={textareaRef}
              placeholder="今日の発見や感想を共有しよう..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              rows={3}
            />
            <div className="mt-2 flex justify-end">
              <button type="button" className="bg-amber-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-amber-500 transition-colors active:scale-95">
                投稿する
              </button>
            </div>
          </div>

          {/* 説明 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border border-amber-100">
            <h2 className="text-xl font-bold mb-3 text-gray-800 flex items-center gap-2">
              <span className="text-2xl">📢</span>
              ことづて（投稿）
            </h2>
            <p className="text-gray-600 mb-4 text-sm leading-relaxed">
              日曜市での発見や感想を気軽に共有できます。
              <br />
              みんなの「おいしい！」「楽しい！」で日曜市をもっと盛り上げよう。
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-amber-800">
              <span className="px-2 py-1 bg-amber-50 rounded-md border border-amber-200">#今日のおすすめ</span>
              <span className="px-2 py-1 bg-amber-50 rounded-md border border-amber-200">#食べたもの</span>
              <span className="px-2 py-1 bg-amber-50 rounded-md border border-amber-200">#発見</span>
            </div>
          </div>

          {/* 投稿リスト (Empty State or List) */}
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-300 bg-white/80 px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                  <MessageSquarePlus size={40} />
                </div>
                <h3 className="mb-3 text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                  <Sparkles size={20} className="text-yellow-500" />
                  一番乗りで投稿しよう！
                </h3>
                <p className="mx-auto max-w-sm text-sm text-gray-600 leading-relaxed mb-8">
                  まだ投稿がありません。
                  <br />
                  あなたの発見が、誰かの「行きたい！」につながります。
                </p>
                <button
                  type="button"
                  onClick={handleFocus}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200/50 transition hover:bg-amber-500 hover:shadow-xl active:scale-95"
                >
                  <PencilLine size={18} />
                  最初の投稿を書く
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${post.avatarColor} rounded-full flex items-center justify-center shadow-sm`}>
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm mb-1 text-gray-900">{post.name}</p>
                        <p className="text-gray-400 text-xs">{post.time}</p>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ナビゲーションバー */}
      <NavigationBar />
    </div>
  );
}
