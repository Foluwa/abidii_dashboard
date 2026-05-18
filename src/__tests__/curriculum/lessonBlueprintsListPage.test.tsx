import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LessonBlueprintsListPage from '@/app/(admin)/(others-pages)/curriculum/lesson-blueprints/page';
import { renderWithProviders as render } from '@/test-utils';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockUseAdminLessonBlueprintsList = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminLessonBlueprintsList: (filters: unknown) => mockUseAdminLessonBlueprintsList(filters),
}));

const mockValidateAdminBlueprint = jest.fn();
const mockPublishAdminBlueprint = jest.fn();
const mockUnpublishAdminBlueprint = jest.fn();

jest.mock('@/lib/adminCurriculumApi', () => ({
  validateAdminBlueprint: (blueprintId: string) => mockValidateAdminBlueprint(blueprintId),
  publishAdminBlueprint: (blueprintId: string) => mockPublishAdminBlueprint(blueprintId),
  unpublishAdminBlueprint: (blueprintId: string) => mockUnpublishAdminBlueprint(blueprintId),
}));

jest.mock('@/lib/adminActionLog', () => ({
  logAdminCurriculumAction: jest.fn(),
}));

describe('LessonBlueprintsListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAdminLessonBlueprintsList.mockReturnValue({
      data: {
        items: [
          {
            id: 'b1',
            blueprint_key: 'bp_1',
            course_id: 'course-1',
            section_id: 'section-1',
            lesson_kind: 'matching',
            schema_version: 1,
            status: 'draft',
            enabled: true,
            validation_status: 'unknown',
            validated_at: null,
            blocking_error_count: 0,
            warning_count: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
          {
            id: 'b2',
            blueprint_key: 'bp_2',
            course_id: 'course-1',
            section_id: 'section-1',
            lesson_kind: 'listening',
            schema_version: 1,
            status: 'draft',
            enabled: true,
            validation_status: 'unknown',
            validated_at: null,
            blocking_error_count: 2,
            warning_count: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        limit: 50,
        pages: 1,
        filters_applied: {},
      },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    mockValidateAdminBlueprint.mockResolvedValue({});
    mockUnpublishAdminBlueprint.mockResolvedValue({});
  });

  it('renders lesson blueprints table and rows', () => {
    render(<LessonBlueprintsListPage />);

    expect(screen.getByText('Lesson Blueprints')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New Blueprint' })).toHaveAttribute(
      'href',
      '/curriculum/lesson-blueprints/new'
    );

    const table = screen.getByRole('table');
    const t = within(table);

    expect(t.getByText('Key', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Status', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Enabled', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Validation', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Counts', { selector: 'th' })).toBeInTheDocument();

    expect(screen.getByText('bp_1')).toBeInTheDocument();
    expect(screen.getByText('bp_2')).toBeInTheDocument();
    expect(screen.getByText('2 errors, 1 warnings')).toBeInTheDocument();
  });

  it('requires confirmation before bulk publish, and shows blocked outcomes', async () => {
    mockPublishAdminBlueprint
      .mockResolvedValueOnce({ ok: true, statusCode: 200, body: {} })
      .mockResolvedValueOnce({ ok: false, statusCode: 409, body: {} });

    render(<LessonBlueprintsListPage />);

    await userEvent.click(screen.getByLabelText('Select blueprint bp_1'));
    await userEvent.click(screen.getByLabelText('Select blueprint bp_2'));

    await userEvent.click(screen.getByText('Publish Selected'));

    expect(screen.getByText('Publish selected lesson blueprints')).toBeInTheDocument();
    expect(mockPublishAdminBlueprint).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockPublishAdminBlueprint).toHaveBeenCalledTimes(2);
      expect(mockPublishAdminBlueprint).toHaveBeenNthCalledWith(1, 'b1');
      expect(mockPublishAdminBlueprint).toHaveBeenNthCalledWith(2, 'b2');
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(screen.getByText('Last bulk run')).toBeInTheDocument();
    expect(screen.getByText(/Success: 1, Blocked: 1, Failed: 0/i)).toBeInTheDocument();
  });
});
