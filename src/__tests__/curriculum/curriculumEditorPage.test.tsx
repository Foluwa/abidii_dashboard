import React, { act } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CurriculumEditorPage from '@/app/(admin)/(others-pages)/content/curriculum/editor/page';
import { renderWithProviders as render } from '@/test-utils';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

const mockUseAdminCoursesList = jest.fn();
const mockUseCourseCurriculumByKey = jest.fn();
const mockUseConfig = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: (params: any) => mockUseAdminCoursesList(params),
  useCourseCurriculumByKey: (courseKey: string | null) => mockUseCourseCurriculumByKey(courseKey),
  useConfig: () => mockUseConfig(),
}));

const mockReorderUnits = jest.fn().mockResolvedValue({ ok: true });
const mockReorderSections = jest.fn().mockResolvedValue({ ok: true });
const mockMoveSection = jest.fn().mockResolvedValue({ ok: true });
const mockReorderAtomicV2 = jest.fn().mockResolvedValue({ ok: true });
const mockGetPublicBlueprint = jest.fn();

jest.mock('@/lib/adminCurriculumApi', () => ({
  reorderCourseUnits: (...args: any[]) => mockReorderUnits(...args),
  reorderCourseSections: (...args: any[]) => mockReorderSections(...args),
  moveCourseSection: (...args: any[]) => mockMoveSection(...args),
  reorderCourseAtomicV2: (...args: any[]) => mockReorderAtomicV2(...args),
  getPublicBlueprint: (...args: any[]) => mockGetPublicBlueprint(...args),
}));

let mockDropSpecs: any[] = [];

jest.mock('react-dnd', () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDrag: () => [{ isDragging: false }, jest.fn(), jest.fn()],
  useDragLayer: () => ({
    item: null,
    itemType: null,
    isDragging: false,
    currentOffset: null,
  }),
  useDrop: (spec: any) => {
    mockDropSpecs.push(spec);
    return [{}, jest.fn()];
  },
  __getDropSpecs: () => mockDropSpecs,
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {},
}));

const baseCurriculum = {
  id: 'c1',
  course_key: 'abidii_yoruba_v1',
  title: 'Abidii Yoruba',
  description: null,
  status: 'published',
  enabled: true,
  availability: 'available',
  course_revision: 3,
  units: [
    {
      id: 'u1',
      unit_key: 'u1',
      title: 'Unit 1',
      subtitle: null,
      status: 'published',
      enabled: true,
      availability: 'available',
      sections: [
        {
          id: 's1',
          section_key: 's1',
          title: 'Section 1',
          status: 'published',
          enabled: true,
          availability: 'available',
          lesson_blueprint_id: 'bp1',
          blueprint_key: 'bp-1',
        },
        {
          id: 's2',
          section_key: 's2',
          title: 'Section 2',
          status: 'published',
          enabled: true,
          availability: 'available',
          lesson_blueprint_id: 'bp2',
          blueprint_key: 'bp-2',
        },
      ],
    },
    {
      id: 'u2',
      unit_key: 'u2',
      title: 'Unit 2',
      subtitle: null,
      status: 'published',
      enabled: true,
      availability: 'available',
      sections: [
        {
          id: 's3',
          section_key: 's3',
          title: 'Section 3',
          status: 'published',
          enabled: true,
          availability: 'available',
          lesson_blueprint_id: 'bp3',
          blueprint_key: 'bp-3',
        },
      ],
    },
  ],
};

describe('CurriculumEditorPage', () => {
  let mockRefresh: jest.Mock;

  beforeEach(() => {
    mockDropSpecs = [];
    jest.clearAllMocks();
    mockRefresh = jest.fn();

    mockUseAdminCoursesList.mockReturnValue({
      data: { items: [{ id: 'c1', course_key: 'abidii_yoruba_v1', title: 'Abidii Yoruba' }] },
      isLoading: false,
    });

    mockUseConfig.mockReturnValue({
      config: [],
      isLoading: false,
      isError: false,
      refresh: jest.fn(),
    });

    mockUseCourseCurriculumByKey.mockReturnValue({
      curriculum: baseCurriculum,
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    mockGetPublicBlueprint.mockResolvedValue({
      id: 'bp1',
      blueprint_key: 'bp-1',
      lesson_kind: 'reading_practice',
      schema_version: 1,
      status: 'draft',
      enabled: true,
      availability: 'available',
      payload: {
        id: 'lesson_reading_practice_01',
        title: 'Reading Practice',
        flowMode: 'reading_batched',
        targetVocabIds: ['vocab_kaabo', 'vocab_odabo'],
      },
      validation_status: 'valid',
      validated_at: '2026-03-24T00:00:00Z',
      created_at: '2026-03-24T00:00:00Z',
      updated_at: '2026-03-24T00:00:00Z',
    });
  });

  it('calls reorder API after unit drag reorder', async () => {
    render(<CurriculumEditorPage />);

    const dnd = jest.requireMock('react-dnd');
    const specs = dnd.__getDropSpecs();
    const unitDrops = specs.filter((s: any) => s.accept === 'UNIT');

    // Simulate dragging unit index 0 over unit index 1
    await act(async () => {
      unitDrops[1].hover({ type: 'UNIT', index: 0 });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockReorderUnits).toHaveBeenCalledWith('abidii_yoruba_v1', [
      { unit_key: 'u2', order_index: 0 },
      { unit_key: 'u1', order_index: 1 },
    ]);
  });

  it('calls move section API when section is moved between units', async () => {
    render(<CurriculumEditorPage />);

    const dnd = jest.requireMock('react-dnd');
    const specs = dnd.__getDropSpecs();
    const sectionDrops = specs.filter((s: any) => s.accept === 'SECTION' && typeof s.drop === 'function');

    // Drop section s1 from unit u1 into unit u2
    await act(async () => {
      sectionDrops[1].drop({ type: 'SECTION', unitKey: 'u1', index: 0 });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockMoveSection).toHaveBeenCalledWith('abidii_yoruba_v1', {
      section_id: 's1',
      section_key: 's1',
      from_unit_key: 'u1',
      to_unit_key: 'u2',
      order_index: 1,
    });
  });

  it('shows saved toast after successful save', async () => {
    render(<CurriculumEditorPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('shows error toast and reverts draft order on save failure', async () => {
    mockReorderUnits.mockRejectedValueOnce(new Error('boom'));

    render(<CurriculumEditorPage />);

    const dnd = jest.requireMock('react-dnd');
    const specs = dnd.__getDropSpecs();
    const unitDrops = specs.filter((s: any) => s.accept === 'UNIT');

    await act(async () => {
      unitDrops[1].hover({ type: 'UNIT', index: 0 });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('boom')).toBeInTheDocument();

    const unit1 = screen.getByText('Unit 1');
    const unit2 = screen.getByText('Unit 2');
    const order = unit1.compareDocumentPosition(unit2);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders structured backend errors as readable toast messages', async () => {
    mockMoveSection.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          detail: {
            error: 'section_unit_mismatch',
            expected: 'u2',
            provided: 'u1',
          },
        },
      },
    });

    render(<CurriculumEditorPage />);

    const dnd = jest.requireMock('react-dnd');
    const specs = dnd.__getDropSpecs();
    const sectionDrops = specs.filter((s: any) => s.accept === 'SECTION' && typeof s.drop === 'function');

    await act(async () => {
      sectionDrops[1].drop({ type: 'SECTION', unitKey: 'u1', index: 0 });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This curriculum is out of date. Refresh the editor and try the move again.')
    ).toBeInTheDocument();
  });

  it('uses legacy reorder endpoints when curriculum_atomic_reorder_v2 is disabled', async () => {
    render(<CurriculumEditorPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockReorderAtomicV2).not.toHaveBeenCalled();
    expect(mockReorderUnits).toHaveBeenCalled();
    expect(mockReorderSections).toHaveBeenCalled();
  });

  it('uses atomic reorder endpoint with revision precondition when flag is enabled', async () => {
    mockUseConfig.mockReturnValue({
      config: [
        {
          key: 'curriculum_atomic_reorder_v2',
          value_bool: true,
          is_active: true,
        },
      ],
      isLoading: false,
      isError: false,
      refresh: jest.fn(),
    });

    render(<CurriculumEditorPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockReorderAtomicV2).toHaveBeenCalledWith('abidii_yoruba_v1', {
      expected_revision: 3,
      units: [
        {
          unit_key: 'u1',
          order_index: 0,
          sections: [
            { section_key: 's1', order_index: 0 },
            { section_key: 's2', order_index: 1 },
          ],
        },
        {
          unit_key: 'u2',
          order_index: 1,
          sections: [{ section_key: 's3', order_index: 0 }],
        },
      ],
    });
    expect(mockReorderUnits).not.toHaveBeenCalled();
    expect(mockReorderSections).not.toHaveBeenCalled();
    expect(mockMoveSection).not.toHaveBeenCalled();
  });

  it('prompts refresh and retry guidance when atomic reorder returns 409 conflict', async () => {
    mockUseConfig.mockReturnValue({
      config: [
        {
          key: 'curriculum_atomic_reorder_v2',
          value_bool: true,
          is_active: true,
        },
      ],
      isLoading: false,
      isError: false,
      refresh: jest.fn(),
    });
    mockReorderAtomicV2.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          detail: {
            error: 'revision_conflict',
            expected_revision: 3,
            current_revision: 4,
          },
        },
      },
    });

    render(<CurriculumEditorPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh now' }));

    expect(mockRefresh).toHaveBeenCalled();
    expect(
      await screen.findByText('This curriculum was updated by someone else. Please refresh and retry your save.')
    ).toBeInTheDocument();
  });

  it('loads learner preview for a playable section', async () => {
    render(<CurriculumEditorPage />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0]);

    expect(await screen.findByText('What the learner sees')).toBeInTheDocument();
    expect(await screen.findByText('Reading Practice')).toBeInTheDocument();
    expect(await screen.findByText('Vocabulary bindings')).toBeInTheDocument();
    expect(mockGetPublicBlueprint).toHaveBeenCalledWith('bp1');
  });
});
