import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SceneLibraryPage from '@/app/(admin)/(others-pages)/content/scene-library/page';
import { renderWithProviders as render } from '@/test-utils';
import type { SceneDetail, SceneSummary } from '@/types/scene-library';

const mockList = jest.fn();
const mockScene = jest.fn();
const mockRefresh = jest.fn();
const mockSceneRefresh = jest.fn();
const mockSave = jest.fn();
const mockReview = jest.fn();
const mockRollback = jest.fn();
const mockAttach = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminSceneLibrary: () => mockList(),
  useAdminSceneLibraryScene: (id: string | null) => mockScene(id),
}));

jest.mock('@/lib/sceneLibraryApi', () => ({
  saveScene: (...a: unknown[]) => mockSave(...a),
  setSceneReviewed: (...a: unknown[]) => mockReview(...a),
  rollbackScene: (...a: unknown[]) => mockRollback(...a),
  attachSceneToLesson: (...a: unknown[]) => mockAttach(...a),
}));

const summary: SceneSummary = {
  id: 'greeting_elder',
  kind: 'conversation',
  version: 3,
  reviewed: false,
  reviewed_version: 2,
  title: 'Greeting an elder',
  updated_at: '2026-10-08T10:00:00Z',
  lessons: ['lesson_u02_s06'],
  problems: [],
};

const payload = {
  id: 'greeting_elder',
  title: 'Greeting an elder',
  start: 'n1',
  nodes: [
    { id: 'n1', type: 'line', speaker: 'Baba', yorubaText: 'Ẹ káàárọ̀', englishText: 'Good morning', next: 'n2' },
    { id: 'n2', type: 'end', message: 'Well done' },
  ],
};

const detail: SceneDetail = {
  id: 'greeting_elder',
  kind: 'conversation',
  version: 3,
  reviewed: false,
  updated_at: '2026-10-08T10:00:00Z',
  payload,
  problems: [],
  lessons: ['lesson_u02_s06'],
  versions: [
    { version: 3, reviewed: false, created_at: '2026-10-08T10:00:00Z', created_by: null },
    { version: 2, reviewed: true, created_at: '2026-10-07T10:00:00Z', created_by: null },
  ],
};

const ok = { changed: true, version: 4, lessons: ['lesson_u02_s06'] };

describe('Scene Library page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockReturnValue({ data: { items: [summary], total: 1 }, isLoading: false, isError: null, refresh: mockRefresh });
    mockScene.mockImplementation((id: string | null) =>
      id ? { data: detail, isLoading: false, isError: null, refresh: mockSceneRefresh } : { data: undefined },
    );
    mockSave.mockResolvedValue(ok);
    mockReview.mockResolvedValue(ok);
    mockRollback.mockResolvedValue(ok);
    mockAttach.mockResolvedValue({ changed: true, version: null, lessons: ['lesson_u03'] });
  });

  async function openEditor() {
    const user = userEvent.setup();
    render(<SceneLibraryPage />);
    await user.click(screen.getByRole('button', { name: 'Edit greeting_elder' }));
    return user;
  }

  it('lists scenes with version, review state and lesson count', () => {
    render(<SceneLibraryPage />);
    const row = screen.getByTestId('scene-row-greeting_elder');
    expect(within(row).getByText('Greeting an elder')).toBeInTheDocument();
    expect(within(row).getByText('Needs review (v2 reviewed)')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
  });

  it('shows the empty state with how to import', () => {
    mockList.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false, isError: null, refresh: mockRefresh });
    render(<SceneLibraryPage />);
    expect(screen.getByText(/import_scene_library\.py/)).toBeInTheDocument();
  });

  it('saves an edited scene only after confirming, then refreshes', async () => {
    const user = await openEditor();
    const editor = screen.getByLabelText('Scene JSON') as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual(payload);
    const edited = { ...payload, title: 'Greeting an elder (v4)' };
    fireEvent.change(editor, { target: { value: JSON.stringify(edited) } });
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    expect(mockSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith('greeting_elder', 'conversation', edited));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockSceneRefresh).toHaveBeenCalled();
  });

  it('shows why the server refused an unplayable scene', async () => {
    mockSave.mockRejectedValue({
      response: { data: { detail: { message: "The scene can't be played as it is", problems: ['n2: no end reachable'] } } },
    });
    const user = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('n2: no end reachable')).toBeInTheDocument();
  });

  it('catches invalid JSON before sending anything', async () => {
    const user = await openEditor();
    fireEvent.change(screen.getByLabelText('Scene JSON'), { target: { value: '{not json' } });
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    expect(screen.getByText('This is not a valid JSON object.')).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('marks the current version reviewed after confirming', async () => {
    const user = await openEditor();
    await user.click(screen.getAllByRole('button', { name: 'Mark reviewed' })[0]);
    const dialogs = screen.getAllByRole('button', { name: 'Mark reviewed' });
    await user.click(dialogs[dialogs.length - 1]);
    await waitFor(() => expect(mockReview).toHaveBeenCalledWith('greeting_elder', true));
  });

  it('rolls back to an earlier version and adds the scene to a lesson', async () => {
    const user = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Roll back to version 2' }));
    await user.click(screen.getByRole('button', { name: 'Roll back' }));
    await waitFor(() => expect(mockRollback).toHaveBeenCalledWith('greeting_elder', 2));

    await user.type(screen.getByLabelText('Lesson key'), 'lesson_u03');
    await user.click(screen.getByRole('button', { name: 'Add to lesson' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(mockAttach).toHaveBeenCalledWith('greeting_elder', 'lesson_u03'));
  });
});
