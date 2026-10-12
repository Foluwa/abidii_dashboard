'use client';

import { useParams } from 'next/navigation';

import { BlogAuthorEditor } from '@/components/blog/BlogAuthorEditor';

export default function EditBlogAuthorPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? '');
  return <BlogAuthorEditor key={id} authorId={id} />;
}
