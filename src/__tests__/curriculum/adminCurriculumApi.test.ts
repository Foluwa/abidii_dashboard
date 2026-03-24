import {
  cloneAdminBlueprint,
  createAdminBlueprint,
  getAdminBlueprintCapabilities,
  markSectionsComingSoon,
  publishAdminBlueprint,
  publishAdminCourse,
  previewAdminBlueprintDraft,
  updateAdminBlueprint,
} from '@/lib/adminCurriculumApi';

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const mockApiClient = jest.requireMock('@/lib/api').apiClient as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
};

describe('adminCurriculumApi publish 409 handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishAdminBlueprint returns blocked outcome with parsed body on 409', async () => {
    const blockedBody = {
      blueprint: {
        id: 'b1',
        blueprint_key: 'bp.key',
        course_id: 'c1',
        section_id: 's1',
        lesson_kind: 'dialogue',
        schema_version: 1,
        status: 'draft',
        enabled: true,
        payload: {},
        validation_status: 'invalid',
        validation_errors: {},
        validated_at: null,
        created_at: '2026-02-25T00:00:00Z',
        updated_at: '2026-02-25T00:00:00Z',
      },
      validation: {
        status: 'invalid',
        errors: [
          {
            code: 'missing_field',
            path: '$.steps[0]',
            message: 'Missing field',
            severity: 'ERROR',
          },
        ],
        warnings: [],
        validated_at: '2026-02-25T00:00:00Z',
        can_publish: false,
        blocking_error_count: 1,
        warning_count: 0,
      },
    };

    mockApiClient.post.mockRejectedValue({
      response: { status: 409, data: blockedBody },
    });

    const outcome = await publishAdminBlueprint('b1');
    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(409);
    expect(outcome.body).toEqual(blockedBody);
  });

  it('publishAdminBlueprint returns success outcome on 200', async () => {
    const successBody = {
      blueprint: {
        id: 'b1',
        blueprint_key: 'bp.key',
        course_id: 'c1',
        section_id: 's1',
        lesson_kind: 'dialogue',
        schema_version: 1,
        status: 'published',
        enabled: true,
        payload: {},
        validation_status: 'valid',
        validation_errors: {},
        validated_at: '2026-02-25T00:00:00Z',
        created_at: '2026-02-25T00:00:00Z',
        updated_at: '2026-02-25T00:00:00Z',
      },
      validation: {
        status: 'valid',
        errors: [],
        warnings: [],
        validated_at: '2026-02-25T00:00:00Z',
        can_publish: true,
        blocking_error_count: 0,
        warning_count: 0,
      },
    };

    mockApiClient.post.mockResolvedValue({ data: successBody });

    const outcome = await publishAdminBlueprint('b1');
    expect(outcome.ok).toBe(true);
    expect(outcome.statusCode).toBe(200);
    expect(outcome.body).toEqual(successBody);
  });

  it('publishAdminCourse returns blocked outcome with parsed body on 409', async () => {
    const blockedBody = {
      course: {
        id: 'c1',
        course_key: 'course.key',
        title: 'Course',
        description: null,
        status: 'draft',
        enabled: true,
        created_at: '2026-02-25T00:00:00Z',
        updated_at: '2026-02-25T00:00:00Z',
      },
      validation: {
        status: 'invalid',
        errors: [
          {
            code: 'missing_blueprint',
            path: '$.units[0].sections[0]',
            message: 'Section missing blueprint',
            severity: 'ERROR',
          },
        ],
        warnings: [],
        validated_at: null,
        can_publish: false,
        blocking_error_count: 1,
        warning_count: 0,
      },
    };

    mockApiClient.post.mockRejectedValue({
      response: { status: 409, data: blockedBody },
    });

    const outcome = await publishAdminCourse('c1');
    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(409);
    expect(outcome.body).toEqual(blockedBody);
  });

  it('publishAdminCourse rethrows non-409 errors', async () => {
    mockApiClient.post.mockRejectedValue({ response: { status: 500 } });

    await expect(publishAdminCourse('c1')).rejects.toBeTruthy();
  });

  it('previewAdminBlueprintDraft posts the draft payload', async () => {
    const payload = {
      blueprint_key: 'bp.preview',
      course_id: 'c1',
      section_id: 's1',
      lesson_kind: 'structured_micro_lesson',
      schema_version: 1,
      payload: { id: 'bp.preview', steps: [] },
    };
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });

    await previewAdminBlueprintDraft(payload);

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/admin/lesson-blueprints/preview', payload);
  });

  it('getAdminBlueprintCapabilities loads backend-authored editor capabilities', async () => {
    mockApiClient.get.mockResolvedValue({ data: { lesson_kinds: [] } });

    await getAdminBlueprintCapabilities();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/admin/lesson-blueprints/capabilities');
  });

  it('create/update/clone blueprint authoring helpers call the expected endpoints', async () => {
    const payload = {
      blueprint_key: 'bp.new',
      course_id: 'c1',
      section_id: 's1',
      lesson_kind: 'structured_micro_lesson',
      schema_version: 1,
      payload: { id: 'bp.new', steps: [] },
    };
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });
    mockApiClient.put.mockResolvedValue({ data: { ok: true } });

    await createAdminBlueprint(payload);
    await updateAdminBlueprint('b1', payload);
    await cloneAdminBlueprint('b1', { blueprint_key: 'bp.clone', course_id: 'c1', section_id: 's1' });

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/admin/lesson-blueprints', payload);
    expect(mockApiClient.put).toHaveBeenCalledWith('/api/v1/admin/lesson-blueprints/b1', payload);
    expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/admin/lesson-blueprints/b1/clone', {
      blueprint_key: 'bp.clone',
      course_id: 'c1',
      section_id: 's1',
    });
  });

  it('markSectionsComingSoon posts the targeted section ids', async () => {
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });

    await markSectionsComingSoon('abidii_yoruba_v1', ['s1', 's2']);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/curriculum/courses/abidii_yoruba_v1/sections/mark-coming-soon',
      {
        section_ids: ['s1', 's2'],
      }
    );
  });
});
