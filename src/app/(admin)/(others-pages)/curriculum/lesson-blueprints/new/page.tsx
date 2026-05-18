'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { LessonBlueprintEditor } from '@/components/admin/curriculum/LessonBlueprintEditor';

export default function NewLessonBlueprintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCourseKey = searchParams.get('courseKey');
  const initialSectionId = searchParams.get('sectionId');
  const initialBlueprintKey = searchParams.get('blueprintKey');

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="New Lesson Blueprint" />
      <LessonBlueprintEditor
        mode="create"
        initialCourseKey={initialCourseKey}
        initialSectionId={initialSectionId}
        initialBlueprintKey={initialBlueprintKey}
        onSaved={(result) => {
          router.push(`/curriculum/lesson-blueprints/${result.blueprint.id}`);
        }}
      />
    </div>
  );
}
