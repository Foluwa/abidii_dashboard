import { redirect } from 'next/navigation';

export default function BlogIndexPage() {
  redirect('/content/blog/posts');
}
