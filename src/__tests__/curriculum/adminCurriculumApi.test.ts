import {
  cloneAdminBlueprint,
  cleanupOrphanedBlueprintAssets,
  completeBlueprintAssetUpload,
  createAdminCourse,
  createAdminBlueprint,
  deleteAdminCourse,
  deleteBlueprintAsset,
  getAdminBlueprintCapabilities,
  getCurriculumReadinessMatrix,
  markSectionsComingSoon,
  publishAdminBlueprint,
  publishAdminCourse,
  previewAdminBlueprintDraft,
  renameBlueprintAsset,
  requestBlueprintAssetUpload,
  uploadBlueprintAsset,
  uploadFileToPresignedUrl,
  updateAdminCourse,
  updateAdminBlueprint,
} from '@/lib/adminCurriculumApi';

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  },
}));

const mockApiClient = jest.requireMock('@/lib/api').apiClient as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
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

  it('getCurriculumReadinessMatrix loads the readiness inventory endpoint', async () => {
    mockApiClient.get.mockResolvedValue({ data: { totals: {}, languages: [] } });

    await getCurriculumReadinessMatrix();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/admin/curriculum/readiness-matrix');
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

  it('create/update course helpers call the expected endpoints', async () => {
    const payload = {
      course_key: 'abidii_yoruba_v2',
      title: 'Abidii Yoruba v2',
      description: 'Course description',
      target_language_id: 'lang-1',
    };
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });
    mockApiClient.put.mockResolvedValue({ data: { ok: true } });

    await createAdminCourse(payload);
    await updateAdminCourse('course-1', payload);

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/admin/courses', payload);
    expect(mockApiClient.put).toHaveBeenCalledWith('/api/v1/admin/courses/course-1', payload);
  });

  it('blueprint asset upload helpers call the expected endpoints', async () => {
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });
    mockApiClient.patch.mockResolvedValue({ data: { ok: true } });
    mockApiClient.delete.mockResolvedValue({ data: { ok: true } });

    await requestBlueprintAssetUpload('b1', {
      field_path: 'heroImageUrl',
      file_name: 'cover.png',
      content_type: 'image/png',
      file_size_bytes: 1234,
    });

    await completeBlueprintAssetUpload('b1', {
      field_path: 'heroImageUrl',
      storage_key: 'curriculum/lesson-blueprints/course/b1/image/hero/cover.png',
      file_name: 'cover.png',
    });
    await renameBlueprintAsset('b1', {
      field_path: 'heroImageUrl',
      file_name: 'new-cover.png',
    });
    await deleteBlueprintAsset('b1', 'heroImageUrl');
    await cleanupOrphanedBlueprintAssets('course-1');

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/b1/assets/upload-url',
      {
        field_path: 'heroImageUrl',
        file_name: 'cover.png',
        content_type: 'image/png',
        file_size_bytes: 1234,
      }
    );
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/b1/assets/complete',
      {
        field_path: 'heroImageUrl',
        storage_key: 'curriculum/lesson-blueprints/course/b1/image/hero/cover.png',
        file_name: 'cover.png',
      }
    );
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/b1/assets/metadata',
      {
        field_path: 'heroImageUrl',
        file_name: 'new-cover.png',
      }
    );
    expect(mockApiClient.delete).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/b1/assets?field_path=heroImageUrl'
    );
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/assets/cleanup-orphans?course_id=course-1'
    );
  });

  it('deleteAdminCourse calls the expected endpoint', async () => {
    mockApiClient.delete.mockResolvedValue({ data: { ok: true } });
    await deleteAdminCourse('course-1');
    expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v1/admin/courses/course-1');
  });

  it('uploadFileToPresignedUrl uploads with PUT and reports progress', async () => {
    const originalXhr = global.XMLHttpRequest;
    const uploadListeners: Record<string, ((event: ProgressEvent<EventTarget>) => void) | null> = {
      progress: null,
    };
    let lastInstance: {
      open: jest.Mock;
      setRequestHeader: jest.Mock;
      send: jest.Mock;
    } | null = null;

    class MockXMLHttpRequest {
      status = 200;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      constructor() {
        lastInstance = this;
      }
      upload = {
        set onprogress(handler: ((event: ProgressEvent<EventTarget>) => void) | null) {
          uploadListeners.progress = handler;
        },
      };
      open = jest.fn();
      setRequestHeader = jest.fn();
      send = jest.fn((file: File) => {
        uploadListeners.progress?.({
          lengthComputable: true,
          loaded: file.size,
          total: file.size,
        } as ProgressEvent<EventTarget>);
        this.onload?.();
      });
    }

    // @ts-expect-error test shim
    global.XMLHttpRequest = MockXMLHttpRequest;
    const onProgress = jest.fn();

    await uploadFileToPresignedUrl(
      'https://example.r2.dev/upload',
      new File(['abc'], 'cover.png', { type: 'image/png' }),
      'image/png',
      onProgress
    );

    const xhrInstance = lastInstance as {
      open: jest.Mock;
      setRequestHeader: jest.Mock;
      send: jest.Mock;
    } | null;
    expect(xhrInstance).not.toBeNull();
    expect(xhrInstance?.open).toHaveBeenCalledWith('PUT', 'https://example.r2.dev/upload');
    expect(xhrInstance?.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(xhrInstance?.send).toHaveBeenCalledWith(expect.any(File));
    expect(onProgress).toHaveBeenCalledWith(100);

    global.XMLHttpRequest = originalXhr;
  });

  it('uploadBlueprintAsset posts multipart form data to the backend upload endpoint', async () => {
    mockApiClient.post.mockResolvedValue({ data: { ok: true } });
    const onProgress = jest.fn();

    await uploadBlueprintAsset(
      'b1',
      {
        field_path: 'heroImageUrl',
        file: new File(['abc'], 'cover.png', { type: 'image/png' }),
      },
      onProgress
    );

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/lesson-blueprints/b1/assets/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: expect.any(Function),
      })
    );

    const uploadConfig = mockApiClient.post.mock.calls.at(-1)?.[2];
    uploadConfig.onUploadProgress({ loaded: 5, total: 10 });
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
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
