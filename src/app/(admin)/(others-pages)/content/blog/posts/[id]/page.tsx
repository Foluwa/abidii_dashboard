'use client';

import { useParams } from 'next/navigation';

import { BlogPostEditor } from '@/components/blog/BlogPostEditor';

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? '');
  // Keyed so moving between posts starts from a clean form.
  return <BlogPostEditor key={id} postId={id} />;
}
