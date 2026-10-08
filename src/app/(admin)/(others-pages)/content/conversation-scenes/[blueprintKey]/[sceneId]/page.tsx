'use client';

import { useParams } from 'next/navigation';

import { ConversationSceneScript } from '@/components/content/ConversationSceneScript';

export default function ConversationSceneDetailPage() {
  const params = useParams<{ blueprintKey: string; sceneId: string }>();
  const blueprintKey = decodeURIComponent(params?.blueprintKey ?? '');
  const sceneId = decodeURIComponent(params?.sceneId ?? '');
  return <ConversationSceneScript blueprintKey={blueprintKey} sceneId={sceneId} />;
}
