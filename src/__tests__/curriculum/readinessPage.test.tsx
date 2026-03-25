import React from 'react';
import { screen } from '@testing-library/react';

import CurriculumReadinessPage from '@/app/(admin)/(others-pages)/content/curriculum/readiness/page';
import { renderWithProviders as render } from '@/test-utils';

const mockUseCurriculumReadinessMatrix = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useCurriculumReadinessMatrix: () => mockUseCurriculumReadinessMatrix(),
}));

describe('CurriculumReadinessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurriculumReadinessMatrix.mockReturnValue({
      data: {
        generated_at: '2026-03-24T00:00:00Z',
        totals: {
          language_count: 1,
          course_count: 1,
          unit_count: 2,
          section_count: 5,
          blueprint_count: 5,
          published_blueprint_count: 3,
          launchable_section_count: 3,
          ready_to_test_course_count: 0,
          partially_testable_course_count: 1,
          blocked_course_count: 0,
        },
        languages: [
          {
            target_language_id: 'lang-yor',
            target_language_code: 'yor',
            target_language_name: 'Yoruba',
            course_count: 1,
            unit_count: 2,
            section_count: 5,
            blueprint_count: 5,
            published_blueprint_count: 3,
            launchable_section_count: 3,
            lesson_kinds: ['alphabet_drill', 'greetings_core', 'reading_practice'],
            courses: [
              {
                course: {
                  id: 'course-1',
                  course_key: 'abidii_yoruba_v1',
                  title: 'Abidii Yoruba v1',
                  description: null,
                  status: 'draft',
                  enabled: true,
                  created_at: '2026-03-24T00:00:00Z',
                  updated_at: '2026-03-24T00:00:00Z',
                },
                validation: {
                  status: 'invalid',
                  errors: [
                    {
                      code: 'section_missing_blueprint',
                      path: 'sections[U2.S1]',
                      message: 'section has no published blueprint',
                      severity: 'ERROR',
                    },
                  ],
                  warnings: [],
                  validated_at: null,
                  can_publish: false,
                  blocking_error_count: 1,
                  warning_count: 0,
                },
                unit_count: 2,
                section_count: 5,
                blueprint_count: 5,
                published_blueprint_count: 3,
                launchable_section_count: 3,
                missing_blueprint_section_count: 2,
                lesson_kinds: ['alphabet_drill', 'greetings_core', 'reading_practice'],
                qa_status: 'partially_testable',
                qa_checks: [
                  {
                    key: 'backend_launch_contract',
                    label: 'Backend lesson payload coverage',
                    status: 'blocked',
                    detail: '2 section(s) still have no published blueprint.',
                  },
                  {
                    key: 'lesson_complete_resume_unlock',
                    label: 'Manual QA: complete, resume, unlock-next',
                    status: 'pending_manual',
                    detail: 'Manual QA still required for complete, resume, unlock-next, and progress sync.',
                  },
                ],
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      refresh: jest.fn(),
      mutate: jest.fn(),
    });
  });

  it('renders readiness inventory by language and course', () => {
    render(<CurriculumReadinessPage />);

    expect(screen.getByText('Curriculum Readiness')).toBeInTheDocument();
    expect(screen.getByText('Yoruba')).toBeInTheDocument();
    expect(screen.getByText('Abidii Yoruba v1')).toBeInTheDocument();
    expect(screen.getAllByText('alphabet_drill').length).toBeGreaterThan(0);
    expect(screen.getByText('Backend lesson payload coverage')).toBeInTheDocument();
    expect(screen.getByText('Manual QA: complete, resume, unlock-next')).toBeInTheDocument();
  });
});
