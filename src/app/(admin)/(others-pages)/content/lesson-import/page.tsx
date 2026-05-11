'use client';

import React, { useCallback } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { GoogleSheetsBulkImport } from '@/components/admin/GoogleSheetsBulkImport';
import { useToast } from '@/contexts/ToastContext';

const lessonColumns = [
  { name: 'source_row_key', required: true, description: 'Stable ASCII row key (never changes)', example: 'lesson_001' },
  { name: 'blueprint_key', required: true, description: 'Unique lesson identifier (e.g. lesson_yoruba_u01_s01)', example: 'lesson_yoruba_u01_s01' },
  { name: 'title', required: true, description: 'Lesson title', example: 'Good Morning' },
  { name: 'lesson_kind', required: true, description: 'One of: structured_micro_lesson, alphabet_drill, tone_marks_drill, numbers_1_10', example: 'structured_micro_lesson' },
  { name: 'launch_route', required: true, description: 'One of: structuredLesson, alphabetLesson, phonicsLesson, numbersLesson', example: 'structuredLesson' },
  { name: 'subtitle', required: false, description: 'Lesson subtitle', example: 'Learn to greet' },
  { name: 'estimated_minutes', required: false, description: 'Duration in minutes', example: '10' },
  { name: 'objectives', required: false, description: 'Pipe-delimited learning objectives', example: 'Greet someone|Say goodbye' },
  { name: 'culture_tip', required: false, description: 'Cultural context note', example: 'Handshake is common' },
  { name: 'is_published', required: false, description: 'TRUE or FALSE', example: 'FALSE' },
];

export default function LessonImportPage() {
  const toast = useToast();

  const handleImportComplete = useCallback(() => {
    toast.success('Lesson import completed successfully.');
  }, [toast]);

  return (
    <div>
      <PageBreadCrumb pageTitle="Lesson Import" />
      <div className="p-6">
        <GoogleSheetsBulkImport
          contentType="lessons"
          onImportComplete={handleImportComplete}
          expectedColumns={lessonColumns}
        />
      </div>
    </div>
  );
}
