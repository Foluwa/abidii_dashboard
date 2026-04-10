import React from 'react';
import { screen } from '@testing-library/react';

import CurriculumAssetLibraryPage from '@/app/(admin)/(others-pages)/content/curriculum/assets/page';
import { renderWithProviders as render } from '@/test-utils';

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: () => ({
    data: {
      items: [
        {
          id: 'course-1',
          title: 'Abidii Yoruba v1',
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAdminBlueprintAssetLibrary: () => ({
    items: [
      {
        blueprint_id: 'bp-1',
        blueprint_key: 'lesson_reading_practice_01',
        course_id: 'course-1',
        course_key: 'abidii_yoruba_v1',
        section_id: 'section-1',
        unit_key: 'U1',
        section_key: 'U1_S3',
        lesson_kind: 'reading_practice',
        field_path: 'steps[0].imageUrl',
        binding: {
          field_path: 'steps[0].imageUrl',
          asset_kind: 'image',
          storage_key: 'curriculum/example.png',
          asset_url: 'https://cdn.example.com/example.png',
          file_name: 'example.png',
          uploaded_at: '2026-03-25T00:00:00Z',
        },
      },
    ],
    total: 1,
    isLoading: false,
    isError: false,
  }),
}));

describe('CurriculumAssetLibraryPage', () => {
  it('renders reusable assets across blueprints', () => {
    render(<CurriculumAssetLibraryPage />);

    expect(screen.getByText('Curriculum Asset Library')).toBeInTheDocument();
    expect(screen.getByText('lesson_reading_practice_01')).toBeInTheDocument();
    expect(screen.getByText('steps[0].imageUrl')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Blueprint' })).toHaveAttribute(
      'href',
      '/curriculum/lesson-blueprints/bp-1'
    );
  });
});
