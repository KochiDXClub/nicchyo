import { Metadata } from 'next';
import PostsClient from './PostsClient';

export const metadata: Metadata = {
  title: '投稿（ことづて）',
  robots: { index: false, follow: true },
  description: '日曜市での発見や感想を気軽に投稿・共有しよう。',
};

export default function PostsPage() {
  return <PostsClient />;
}
