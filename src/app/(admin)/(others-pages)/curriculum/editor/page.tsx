'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DndProvider, useDrag, useDragLayer, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { LessonRuntimePreview } from '@/components/admin/curriculum/LessonRuntimePreview';
import StatusBadge from '@/components/admin/StatusBadge';
import { Modal } from '@/components/ui/modal';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import { useAdminCoursesList, useAdminCourseCurriculumByKey, useConfig } from '@/hooks/useApi';
import type { CurriculumSection, CurriculumUnit, PublicLessonBlueprintResponse } from '@/types/curriculum';
import {
  createCourseSection,
  createCourseUnit,
  deleteCourseSection,
  deleteCourseUnit,
  getPublicBlueprint,
  moveCourseSection,
  reorderCourseAtomicV2,
  reorderCourseSections,
  reorderCourseUnits,
  updateCourseSection,
  updateCourseUnit,
} from '@/lib/adminCurriculumApi';

const DND_TYPES = {
  UNIT: 'UNIT',
  SECTION: 'SECTION',
} as const;

type DraftUnit = CurriculumUnit & { sections: CurriculumSection[] };

type UnitDragItem = {
  type: typeof DND_TYPES.UNIT;
  index: number;
  unitKey: string;
  title: string;
  availability: string;
  sectionCount: number;
};

type SectionDragItem = {
  type: typeof DND_TYPES.SECTION;
  unitKey: string;
  index: number;
  sectionKey: string;
  title: string;
  playable: boolean;
};

function getSectionAvailabilityLabel(section: CurriculumSection): string {
  if (section.availability === 'available') return 'Playable';
  if (section.lesson_blueprint_id) return 'Needs publish';
  return 'Coming soon';
}

type UnitEditorState =
  | {
      mode: 'create';
      unitKey: string;
      title: string;
      subtitle: string;
    }
  | {
      mode: 'edit';
      originalUnitKey: string;
      unitKey: string;
      title: string;
      subtitle: string;
    };

type SectionEditorState =
  | {
      mode: 'create';
      unitKey: string;
      sectionKey: string;
      title: string;
    }
  | {
      mode: 'edit';
      unitKey: string;
      originalSectionKey: string;
      sectionKey: string;
      title: string;
    };

type ConfirmActionState =
  | {
      kind: 'archiveUnit';
      unit: DraftUnit;
    }
  | {
      kind: 'deleteUnit';
      unit: DraftUnit;
    }
  | {
      kind: 'archiveSection';
      unitKey: string;
      section: CurriculumSection;
    }
  | {
      kind: 'deleteSection';
      unitKey: string;
      section: CurriculumSection;
    }
  | {
      kind: 'refreshConflict';
    };

function reorderList<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function CurriculumDragLayer() {
  const { item, itemType, isDragging, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem() as UnitDragItem | SectionDragItem | null,
    itemType: monitor.getItemType() as string | symbol | null,
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !currentOffset || !item) {
    return null;
  }

  const style = {
    transform: `translate(${currentOffset.x + 18}px, ${currentOffset.y + 18}px)`,
  };

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[10000] h-full w-full">
      <div style={style} className="max-w-[320px]">
        {itemType === DND_TYPES.UNIT ? (
          <div className="rounded-xl border border-brand-200 bg-white/95 px-4 py-3 shadow-2xl shadow-brand-900/10 backdrop-blur dark:border-brand-800 dark:bg-gray-950/95">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
              Moving unit
            </div>
            <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {(item as UnitDragItem).title}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono">{(item as UnitDragItem).unitKey}</span>
              <span>{(item as UnitDragItem).sectionCount} sections</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-sky-200 bg-white/95 px-4 py-3 shadow-2xl shadow-sky-900/10 backdrop-blur dark:border-sky-800 dark:bg-gray-950/95">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              Moving section
            </div>
            <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {(item as SectionDragItem).title}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono">{(item as SectionDragItem).sectionKey}</span>
              <span>{(item as SectionDragItem).playable ? 'Playable' : 'Coming soon'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UnitRow({
  unit,
  index,
  moveUnit,
  moveSection,
  onCreateSection,
  onEditUnit,
  onArchiveUnit,
  onDeleteUnit,
  onEditSection,
  onArchiveSection,
  onDeleteSection,
  onPreviewSection,
  isPreviewSelected,
  isMutating,
}: {
  unit: DraftUnit;
  index: number;
  moveUnit: (from: number, to: number) => void;
  moveSection: (fromUnit: string, fromIndex: number, toUnit: string, toIndex: number) => void;
  onCreateSection: (unit: DraftUnit) => void;
  onEditUnit: (unit: DraftUnit) => void;
  onArchiveUnit: (unit: DraftUnit) => void;
  onDeleteUnit: (unit: DraftUnit) => void;
  onEditSection: (unitKey: string, section: CurriculumSection) => void;
  onArchiveSection: (unitKey: string, section: CurriculumSection) => void;
  onDeleteSection: (unitKey: string, section: CurriculumSection) => void;
  onPreviewSection: (unit: DraftUnit, section: CurriculumSection) => void;
  isPreviewSelected: (sectionId: string) => boolean;
  isMutating: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{ isDragging }, dragRef, previewRef] = useDrag<UnitDragItem, void, { isDragging: boolean }>({
    type: DND_TYPES.UNIT,
    item: {
      type: DND_TYPES.UNIT,
      index,
      unitKey: unit.unit_key,
      title: unit.title,
      availability: unit.availability,
      sectionCount: unit.sections.length,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOverUnitDrop }, dropRef] = useDrop<UnitDragItem, void, { isOverUnitDrop: boolean }>({
    accept: DND_TYPES.UNIT,
    collect: (monitor) => ({
      isOverUnitDrop: monitor.isOver({ shallow: true }),
    }),
    hover: (item, monitor) => {
      if (item.index === index) return;

      const node = containerRef.current;
      const clientOffset = monitor?.getClientOffset?.();
      if (node && clientOffset) {
        const hoverBoundingRect = node.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        if (item.index < index && hoverClientY < hoverMiddleY) {
          return;
        }

        if (item.index > index && hoverClientY > hoverMiddleY) {
          return;
        }
      }

      moveUnit(item.index, index);
      item.index = index;
    },
  });

  const [{ isOverSectionZone }, sectionDropRef] = useDrop<
    SectionDragItem,
    void,
    { isOverSectionZone: boolean }
  >({
    accept: DND_TYPES.SECTION,
    collect: (monitor) => ({
      isOverSectionZone: monitor.isOver({ shallow: true }),
    }),
    drop: (item) => {
      if (item.unitKey === unit.unit_key && item.index === unit.sections.length) return;
      moveSection(item.unitKey, item.index, unit.unit_key, unit.sections.length);
      item.unitKey = unit.unit_key;
      item.index = unit.sections.length;
    },
  });

  const attachContainerRef = (el: HTMLDivElement | null) => {
    containerRef.current = el;
    previewRef(el);
    dropRef(el);
  };

  const attachDragRef = (el: HTMLDivElement | null) => {
    dragRef(el);
  };

  const attachSectionDropRef = (el: HTMLDivElement | null) => {
    sectionDropRef(el);
  };

  return (
    <div
      ref={attachContainerRef}
      className={`rounded-xl border bg-white transition-all dark:bg-gray-900 ${
        isDragging
          ? 'scale-[0.99] border-brand-200 opacity-50 shadow-lg dark:border-brand-800'
          : isOverUnitDrop
          ? 'border-brand-300 shadow-md shadow-brand-900/5 dark:border-brand-700'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-t-xl px-4 py-3 transition-colors ${
          isOverUnitDrop ? 'bg-brand-50 dark:bg-brand-950/40' : 'bg-gray-50 dark:bg-gray-900'
        }`}
      >
        <div
          className="flex cursor-grab select-none items-center gap-3 active:cursor-grabbing"
          ref={attachDragRef}
          title="Drag to move this unit"
        >
          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-950">
            ==
          </span>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{unit.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{unit.unit_key}</div>
          </div>
        </div>
        <StatusBadge
          status={
            unit.availability === 'available'
              ? 'success'
              : unit.availability === 'coming_soon'
              ? 'pending'
              : 'inactive'
          }
          label={unit.availability}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <button
          onClick={() => onCreateSection(unit)}
          disabled={isMutating}
          className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
        >
          Add Section
        </button>
        <button
          onClick={() => onEditUnit(unit)}
          disabled={isMutating}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Edit Unit
        </button>
        <button
          onClick={() => onArchiveUnit(unit)}
          disabled={isMutating}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
        >
          Archive Unit
        </button>
        <button
          onClick={() => onDeleteUnit(unit)}
          disabled={isMutating}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          Delete Unit
        </button>
      </div>

      <div
        ref={attachSectionDropRef}
        className={`space-y-2 px-4 py-3 transition-colors ${
          isOverSectionZone ? 'bg-sky-50/70 dark:bg-sky-950/20' : ''
        }`}
      >
        {unit.sections.map((section, sectionIndex) => (
          <SectionRow
            key={`${section.section_key}-${section.id}`}
            section={section}
            unitKey={unit.unit_key}
            index={sectionIndex}
            moveSection={moveSection}
            onEditSection={onEditSection}
            onArchiveSection={onArchiveSection}
            onDeleteSection={onDeleteSection}
            onPreviewSection={(section) => onPreviewSection(unit, section)}
            isPreviewSelected={isPreviewSelected(section.id)}
            isMutating={isMutating}
          />
        ))}
        {unit.sections.length === 0 && (
          <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/60 px-3 py-3 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-300">
            Drop sections here
          </div>
        )}
      </div>
    </div>
  );
}

function SectionRow({
  section,
  unitKey,
  index,
  moveSection,
  onEditSection,
  onArchiveSection,
  onDeleteSection,
  onPreviewSection,
  isPreviewSelected,
  isMutating,
}: {
  section: CurriculumSection;
  unitKey: string;
  index: number;
  moveSection: (fromUnit: string, fromIndex: number, toUnit: string, toIndex: number) => void;
  onEditSection: (unitKey: string, section: CurriculumSection) => void;
  onArchiveSection: (unitKey: string, section: CurriculumSection) => void;
  onDeleteSection: (unitKey: string, section: CurriculumSection) => void;
  onPreviewSection: (section: CurriculumSection) => void;
  isPreviewSelected: boolean;
  isMutating: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{ isDragging }, dragRef, previewRef] = useDrag<SectionDragItem, void, { isDragging: boolean }>({
    type: DND_TYPES.SECTION,
    item: {
      type: DND_TYPES.SECTION,
      unitKey,
      index,
      sectionKey: section.section_key,
      title: section.title,
      playable: section.availability === 'available',
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOverSectionRow }, dropRef] = useDrop<
    SectionDragItem,
    void,
    { isOverSectionRow: boolean }
  >({
    accept: DND_TYPES.SECTION,
    collect: (monitor) => ({
      isOverSectionRow: monitor.isOver({ shallow: true }),
    }),
    hover: (item, monitor) => {
      if (item.unitKey === unitKey && item.index === index) return;

      const node = containerRef.current;
      const clientOffset = monitor?.getClientOffset?.();
      if (node && clientOffset) {
        const hoverBoundingRect = node.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        if (item.unitKey === unitKey) {
          if (item.index < index && hoverClientY < hoverMiddleY) {
            return;
          }

          if (item.index > index && hoverClientY > hoverMiddleY) {
            return;
          }
        }
      }

      moveSection(item.unitKey, item.index, unitKey, index);
      item.unitKey = unitKey;
      item.index = index;
    },
  });

  const attachContainerRef = (el: HTMLDivElement | null) => {
    containerRef.current = el;
    previewRef(el);
    dropRef(el);
  };

  const attachDragRef = (el: HTMLDivElement | null) => {
    dragRef(el);
  };

  return (
    <div
      ref={attachContainerRef}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm transition-all ${
        isDragging
          ? 'scale-[0.99] border-sky-200 bg-sky-50/60 opacity-50 shadow-md dark:border-sky-800 dark:bg-sky-950/20'
          : isOverSectionRow
          ? 'border-sky-300 bg-sky-50/70 shadow-sm dark:border-sky-700 dark:bg-sky-950/20'
          : isPreviewSelected
          ? 'border-brand-300 bg-brand-50/50 shadow-sm dark:border-brand-700 dark:bg-brand-950/20'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <div
        ref={attachDragRef}
        className="flex cursor-grab select-none items-center gap-3 active:cursor-grabbing"
        title="Drag to move this section"
      >
        <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-950">
          ::
        </span>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{section.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{section.section_key}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {getSectionAvailabilityLabel(section)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPreviewSection(section)}
          disabled={isMutating}
          className="rounded-lg border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
        >
          Preview
        </button>
        <button
          onClick={() => onEditSection(unitKey, section)}
          disabled={isMutating}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Edit
        </button>
        <button
          onClick={() => onArchiveSection(unitKey, section)}
          disabled={isMutating}
          className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
        >
          Archive
        </button>
        <button
          onClick={() => onDeleteSection(unitKey, section)}
          disabled={isMutating}
          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function CurriculumEditorPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { data: courses, isLoading: coursesLoading } = useAdminCoursesList({ limit: 200 });
  const { config } = useConfig();

  const courseOptions = useMemo(() => courses?.items ?? [], [courses]);
  const requestedCourseKey = searchParams.get('courseKey') || '';
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>(requestedCourseKey);

  useEffect(() => {
    if (!selectedCourseKey && requestedCourseKey) {
      setSelectedCourseKey(requestedCourseKey);
      return;
    }

    if (!selectedCourseKey && courseOptions.length > 0) {
      setSelectedCourseKey(courseOptions[0].course_key);
    }
  }, [courseOptions, requestedCourseKey, selectedCourseKey]);

  const {
    curriculum,
    isLoading: curriculumLoading,
    isError,
    refresh,
  } = useAdminCourseCurriculumByKey(selectedCourseKey || null);

  const [draftUnits, setDraftUnits] = useState<DraftUnit[]>([]);
  const [lastSavedUnits, setLastSavedUnits] = useState<DraftUnit[]>([]);
  const [initialSectionUnits, setInitialSectionUnits] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isStructureMutating, setIsStructureMutating] = useState(false);
  const [selectedPreviewSectionId, setSelectedPreviewSectionId] = useState<string | null>(null);
  const [previewBlueprint, setPreviewBlueprint] = useState<PublicLessonBlueprintResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [unitEditor, setUnitEditor] = useState<UnitEditorState | null>(null);
  const [sectionEditor, setSectionEditor] = useState<SectionEditorState | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);

  const atomicReorderEnabled = useMemo(() => {
    const flag = config.find((entry) => entry.key === 'curriculum_atomic_reorder_v2');
    return Boolean(flag?.is_active && flag?.value_bool);
  }, [config]);

  const isRevisionConflictError = (err: any) => {
    return (
      err?.response?.status === 409
      && err?.response?.data?.detail?.error === 'revision_conflict'
    );
  };

  const buildSectionUnitMap = (units: DraftUnit[]) => {
    const mapping: Record<string, string> = {};
    units.forEach((unit) => {
      unit.sections.forEach((section) => {
        mapping[section.id] = unit.unit_key;
      });
    });
    return mapping;
  };

  const formatSaveError = (err: any) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (detail?.error === 'section_unit_mismatch') {
      return 'This curriculum is out of date. Refresh the editor and try the move again.';
    }

    if (detail?.error === 'revision_conflict') {
      return 'This curriculum was updated by someone else. Please refresh and retry your save.';
    }

    if (detail?.error === 'sections_payload_incomplete') {
      return `Section reorder payload was incomplete. Expected ${detail.expected}, received ${detail.received}.`;
    }

    if (detail?.error === 'units_payload_incomplete') {
      return `Unit reorder payload was incomplete. Expected ${detail.expected}, received ${detail.received}.`;
    }

    return detail || err?.message || 'Failed to save curriculum';
  };

  useEffect(() => {
    if (!curriculum) return;
    const nextUnits = curriculum.units.map((u) => ({ ...u, sections: [...u.sections] }));
    setDraftUnits(nextUnits);
    setLastSavedUnits(nextUnits);
    setInitialSectionUnits(buildSectionUnitMap(nextUnits));
    if (!selectedPreviewSectionId) {
      const firstPlayable = nextUnits
        .flatMap((unit) => unit.sections.map((section) => ({ unit, section })))
        .find((item) => Boolean(item.section.lesson_blueprint_id));
      if (firstPlayable) {
        setSelectedPreviewSectionId(firstPlayable.section.id);
      }
    }
  }, [curriculum, selectedPreviewSectionId]);

  useEffect(() => {
    if (!selectedPreviewSectionId) return;
    const previewSection = draftUnits
      .flatMap((unit) => unit.sections.map((section) => ({ unit, section })))
      .find((item) => item.section.id === selectedPreviewSectionId);

    if (!previewSection) {
      setSelectedPreviewSectionId(null);
      setPreviewBlueprint(null);
      setPreviewError('');
      return;
    }

    if (!previewSection.section.lesson_blueprint_id) {
      setPreviewBlueprint(null);
      setPreviewError('');
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError('');
    void getPublicBlueprint(previewSection.section.lesson_blueprint_id)
      .then((result) => {
        if (!cancelled) {
          setPreviewBlueprint(result);
        }
      })
      .catch((error: any) => {
        if (!cancelled) {
          setPreviewBlueprint(null);
          setPreviewError(error?.response?.data?.detail || error?.message || 'Failed to load lesson preview');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftUnits, selectedPreviewSectionId]);

  const selectedPreviewContext = useMemo(() => {
    if (!selectedPreviewSectionId) return null;
    return (
      draftUnits
        .flatMap((unit) => unit.sections.map((section) => ({ unit, section })))
        .find((item) => item.section.id === selectedPreviewSectionId) ?? null
    );
  }, [draftUnits, selectedPreviewSectionId]);

  const moveUnit = (from: number, to: number) => {
    setDraftUnits((prev) => reorderList(prev, from, to));
  };

  const moveSection = (fromUnit: string, fromIndex: number, toUnit: string, toIndex: number) => {
    setDraftUnits((prev) => {
      const next = prev.map((u) => ({ ...u, sections: [...u.sections] }));
      const sourceUnit = next.find((u) => u.unit_key === fromUnit);
      const targetUnit = next.find((u) => u.unit_key === toUnit);
      if (!sourceUnit || !targetUnit) return prev;

      const [moved] = sourceUnit.sections.splice(fromIndex, 1);
      targetUnit.sections.splice(toIndex, 0, moved);
      return next;
    });
  };

  const applyUpdatedCurriculum = (updatedCurriculum: any) => {
    if (!updatedCurriculum) {
      return;
    }
    const nextUnits = updatedCurriculum.units.map((u: CurriculumUnit) => ({
      ...u,
      sections: [...u.sections],
    }));
    setDraftUnits(nextUnits);
    setLastSavedUnits(nextUnits);
    setInitialSectionUnits(buildSectionUnitMap(nextUnits));
  };

  const createUnit = async (values: { unitKey: string; title: string; subtitle: string }) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await createCourseUnit(selectedCourseKey, {
        unit_key: values.unitKey.trim(),
        title: values.title.trim(),
        subtitle: values.subtitle.trim() || null,
        status: 'draft',
        enabled: false,
        order_index: draftUnits.length,
      });
      applyUpdatedCurriculum(result.curriculum);
      setUnitEditor(null);
      toast.success('Unit created');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const updateUnit = async (
    originalUnitKey: string,
    values: { unitKey: string; title: string; subtitle: string }
  ) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await updateCourseUnit(selectedCourseKey, originalUnitKey, {
        unit_key: values.unitKey.trim(),
        title: values.title.trim(),
        subtitle: values.subtitle.trim() || null,
      });
      applyUpdatedCurriculum(result.curriculum);
      setUnitEditor(null);
      toast.success('Unit updated');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const archiveUnit = async (unit: DraftUnit) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await deleteCourseUnit(selectedCourseKey, unit.unit_key, false);
      applyUpdatedCurriculum(result.curriculum);
      setConfirmAction(null);
      toast.success('Unit archived');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const deleteUnit = async (unit: DraftUnit) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await deleteCourseUnit(selectedCourseKey, unit.unit_key, true);
      applyUpdatedCurriculum(result.curriculum);
      setConfirmAction(null);
      toast.success('Unit deleted');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const createSection = async (values: { unitKey: string; sectionKey: string; title: string }) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await createCourseSection(selectedCourseKey, values.unitKey, {
        section_key: values.sectionKey.trim(),
        title: values.title.trim(),
        status: 'draft',
        enabled: false,
        order_index: draftUnits.find((unit) => unit.unit_key === values.unitKey)?.sections.length ?? 0,
      });
      applyUpdatedCurriculum(result.curriculum);
      setSectionEditor(null);
      toast.success('Section created');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const updateSection = async (
    values: { unitKey: string; originalSectionKey: string; sectionKey: string; title: string }
  ) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await updateCourseSection(selectedCourseKey, values.unitKey, values.originalSectionKey, {
        section_key: values.sectionKey.trim(),
        title: values.title.trim(),
      });
      applyUpdatedCurriculum(result.curriculum);
      setSectionEditor(null);
      toast.success('Section updated');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const archiveSection = async (unitKey: string, section: CurriculumSection) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await deleteCourseSection(selectedCourseKey, unitKey, section.section_key, false);
      applyUpdatedCurriculum(result.curriculum);
      setConfirmAction(null);
      toast.success('Section archived');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const deleteSection = async (unitKey: string, section: CurriculumSection) => {
    if (!selectedCourseKey) return;
    setIsStructureMutating(true);
    try {
      const result = await deleteCourseSection(selectedCourseKey, unitKey, section.section_key, true);
      applyUpdatedCurriculum(result.curriculum);
      setConfirmAction(null);
      toast.success('Section deleted');
    } catch (err: any) {
      toast.error(formatSaveError(err));
    } finally {
      setIsStructureMutating(false);
    }
  };

  const saveChanges = async () => {
    if (!selectedCourseKey) return;
    setIsSaving(true);
    try {
      let updatedCurriculum = null;
      const unitPayload = draftUnits.map((u, index) => ({
        unit_key: u.unit_key,
        order_index: index,
      }));

      const sectionPayload = draftUnits.flatMap((u) =>
        u.sections.map((s, index) => ({
          unit_key: u.unit_key,
          section_key: s.section_key,
          order_index: index,
        }))
      );

      const movedSections = draftUnits.flatMap((u) =>
        u.sections.flatMap((s, index) => {
          const originalUnitKey = initialSectionUnits[s.id];
          if (!originalUnitKey || originalUnitKey === u.unit_key) {
            return [];
          }

          return [{
            section_id: s.id,
            section_key: s.section_key,
            from_unit_key: originalUnitKey,
            to_unit_key: u.unit_key,
            order_index: index,
          }];
        })
      );

      if (atomicReorderEnabled) {
        const atomicPayload = {
          expected_revision: curriculum?.course_revision ?? 0,
          units: draftUnits.map((u, unitIndex) => ({
            unit_key: u.unit_key,
            order_index: unitIndex,
            sections: u.sections.map((s, sectionIndex) => ({
              section_key: s.section_key,
              order_index: sectionIndex,
            })),
          })),
        };

        const result = await reorderCourseAtomicV2(selectedCourseKey, atomicPayload);
        if (result?.curriculum) updatedCurriculum = result.curriculum;
      } else {
        for (const move of movedSections) {
          const result = await moveCourseSection(selectedCourseKey, move);
          if (result?.curriculum) updatedCurriculum = result.curriculum;
        }

        if (unitPayload.length > 0) {
          const result = await reorderCourseUnits(selectedCourseKey, unitPayload);
          if (result?.curriculum) updatedCurriculum = result.curriculum;
        }

        if (sectionPayload.length > 0) {
          const result = await reorderCourseSections(selectedCourseKey, sectionPayload);
          if (result?.curriculum) updatedCurriculum = result.curriculum;
        }
      }

      toast.success('Saved');
      if (updatedCurriculum) {
        const nextUnits = updatedCurriculum.units.map((u) => ({ ...u, sections: [...u.sections] }));
        setDraftUnits(nextUnits);
        setLastSavedUnits(nextUnits);
        setInitialSectionUnits(buildSectionUnitMap(nextUnits));
      } else {
        setLastSavedUnits(draftUnits);
        await refresh();
      }
    } catch (err: any) {
      if (isRevisionConflictError(err)) {
        const conflictMessage = 'This curriculum was updated by someone else. Please refresh and retry your save.';
        setConfirmAction({ kind: 'refreshConflict' });
        toast.error(conflictMessage);
      } else {
        toast.error(formatSaveError(err));
      }
      setDraftUnits(lastSavedUnits.map((u) => ({ ...u, sections: [...u.sections] })));
      setInitialSectionUnits(buildSectionUnitMap(lastSavedUnits));
    } finally {
      setIsSaving(false);
    }
  };

  const copyJson = async () => {
    try {
      const payload = { ...curriculum, units: draftUnits };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('Curriculum JSON copied');
    } catch {
      toast.error('Failed to copy JSON');
    }
  };

  const title = useMemo(() => {
    const match = courseOptions.find((c) => c.course_key === selectedCourseKey);
    return match ? `${match.title} (${match.course_key})` : 'Curriculum Editor';
  }, [courseOptions, selectedCourseKey]);

  const handlePreviewSection = (_unit: DraftUnit, section: CurriculumSection) => {
    setSelectedPreviewSectionId(section.id);
  };

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return '';
    switch (confirmAction.kind) {
      case 'archiveUnit':
        return 'Archive Unit';
      case 'deleteUnit':
        return 'Delete Unit';
      case 'archiveSection':
        return 'Archive Section';
      case 'deleteSection':
        return 'Delete Section';
      case 'refreshConflict':
        return 'Refresh Curriculum';
    }
  }, [confirmAction]);

  const confirmMessage = useMemo(() => {
    if (!confirmAction) return '';
    switch (confirmAction.kind) {
      case 'archiveUnit':
        return `Archive unit "${confirmAction.unit.title}" and all of its sections/blueprints?`;
      case 'deleteUnit':
        return `Delete unit "${confirmAction.unit.title}" permanently? This also deletes its sections and linked blueprints.`;
      case 'archiveSection':
        return `Archive section "${confirmAction.section.title}" and any linked blueprints?`;
      case 'deleteSection':
        return `Delete section "${confirmAction.section.title}" permanently? This also deletes linked blueprints.`;
      case 'refreshConflict':
        return 'This curriculum was updated by someone else. Refresh now and reload the latest structure before retrying your save.';
    }
  }, [confirmAction]);

  const confirmVariant = confirmAction?.kind === 'deleteUnit' || confirmAction?.kind === 'deleteSection'
    ? 'danger'
    : 'warning';

  const confirmButtonText = confirmAction?.kind === 'refreshConflict'
    ? 'Refresh now'
    : confirmAction?.kind === 'archiveUnit' || confirmAction?.kind === 'archiveSection'
    ? 'Archive'
    : 'Delete';

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    switch (confirmAction.kind) {
      case 'archiveUnit':
        await archiveUnit(confirmAction.unit);
        break;
      case 'deleteUnit':
        await deleteUnit(confirmAction.unit);
        break;
      case 'archiveSection':
        await archiveSection(confirmAction.unitKey, confirmAction.section);
        break;
      case 'deleteSection':
        await deleteSection(confirmAction.unitKey, confirmAction.section);
        break;
      case 'refreshConflict':
        setConfirmAction(null);
        await refresh();
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="Curriculum Editor" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Drag units and sections to set the learning path order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnitEditor({ mode: 'create', unitKey: '', title: '', subtitle: '' })}
            disabled={isSaving || isStructureMutating || !selectedCourseKey}
            className="px-3 py-2 text-sm font-medium text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300"
          >
            Add Unit
          </button>
          <button
            onClick={copyJson}
            className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
          >
            Copy JSON
          </button>
          <button
            onClick={saveChanges}
            disabled={isSaving || isStructureMutating}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="courseKey" className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Course
          </label>
          <StyledSelect
            id="courseKey"
            value={selectedCourseKey}
            onChange={(e) => setSelectedCourseKey(e.target.value)}
            options={courseOptions.map((course) => ({ value: course.course_key, label: course.title }))}
            className="min-w-[240px]"
          />
          {coursesLoading && (
            <span className="text-xs text-gray-500">Loading courses…</span>
          )}
          <span className="text-xs text-gray-500">{title}</span>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load curriculum. Check your API connection.
        </div>
      )}

      {curriculumLoading && (
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
          <span>Loading curriculum…</span>
        </div>
      )}

      {!curriculumLoading && !isError && (
        <DndProvider backend={HTML5Backend}>
          <CurriculumDragLayer />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)] xl:grid-cols-[minmax(0,1fr)_minmax(500px,620px)]">
            <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-6 lg:h-[calc(100vh-10rem)] lg:overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Units</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The curriculum tree stays scrollable here while preview remains visible on the right.
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {draftUnits.length} unit{draftUnits.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 lg:h-[calc(100%-4.5rem)] lg:overflow-y-auto lg:pr-3">
                {draftUnits.map((unit, idx) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    index={idx}
                    moveUnit={moveUnit}
                    moveSection={moveSection}
                    onCreateSection={(unit) =>
                      setSectionEditor({ mode: 'create', unitKey: unit.unit_key, sectionKey: '', title: '' })
                    }
                    onEditUnit={(unit) =>
                      setUnitEditor({
                        mode: 'edit',
                        originalUnitKey: unit.unit_key,
                        unitKey: unit.unit_key,
                        title: unit.title,
                        subtitle: unit.subtitle || '',
                      })
                    }
                    onArchiveUnit={(unit) => setConfirmAction({ kind: 'archiveUnit', unit })}
                    onDeleteUnit={(unit) => setConfirmAction({ kind: 'deleteUnit', unit })}
                    onEditSection={(unitKey, section) =>
                      setSectionEditor({
                        mode: 'edit',
                        unitKey,
                        originalSectionKey: section.section_key,
                        sectionKey: section.section_key,
                        title: section.title,
                      })
                    }
                    onArchiveSection={(unitKey, section) => setConfirmAction({ kind: 'archiveSection', unitKey, section })}
                    onDeleteSection={(unitKey, section) => setConfirmAction({ kind: 'deleteSection', unitKey, section })}
                    onPreviewSection={handlePreviewSection}
                    isPreviewSelected={(sectionId) => sectionId === selectedPreviewSectionId}
                    isMutating={isSaving || isStructureMutating}
                  />
                ))}
                {draftUnits.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800">
                    No units found for this course.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-6 lg:h-[calc(100vh-10rem)] lg:overflow-hidden">
              <div className="border-b border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Learner Preview</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Select a section to inspect the content and flow the learner will receive.
                    </p>
                  </div>
                  {selectedPreviewContext?.section.lesson_blueprint_id ? (
                    <Link
                      href={`/curriculum/lesson-blueprints/${selectedPreviewContext.section.lesson_blueprint_id}`}
                      className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                    >
                      Open Blueprint
                    </Link>
                  ) : selectedPreviewContext ? (
                    <Link
                      href={`/curriculum/lesson-blueprints/new?courseKey=${encodeURIComponent(selectedCourseKey)}&sectionId=${encodeURIComponent(selectedPreviewContext.section.id)}`}
                      className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                    >
                      Create Blueprint
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 p-4 lg:h-[calc(100%-5.5rem)] lg:overflow-y-auto lg:pr-3">
                {selectedPreviewContext ? (
                  <>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedPreviewContext.section.title}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {selectedPreviewContext.unit.title} • {selectedPreviewContext.unit.unit_key}/
                        {selectedPreviewContext.section.section_key}
                      </div>
                    </div>

                    {!selectedPreviewContext.section.lesson_blueprint_id ? (
                      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                        This section does not have a lesson blueprint yet, so there is no learner-facing content to
                        preview.
                      </div>
                    ) : isPreviewLoading ? (
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
                        <span>Loading learner preview…</span>
                      </div>
                    ) : previewError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                        {previewError}
                      </div>
                    ) : previewBlueprint ? (
                      <LessonRuntimePreview
                        blueprint={previewBlueprint}
                        heading="What the learner sees"
                        compact
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Select a section to load its blueprint preview.
                      </div>
                    )}

                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tips</h3>
                      <ul className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                        <li>Drag a unit header to reorder the overall learning path.</li>
                        <li>Drag a section card and follow the floating preview under your cursor.</li>
                        <li>Hover above or below a row before you drop to place it precisely.</li>
                        <li>Use Preview on a section to inspect its learner-facing blueprint content.</li>
                        <li>Press Save to persist the ordering to mobile.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      Select a section from the curriculum list to inspect its learner-facing content.
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tips</h3>
                      <ul className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                        <li>Drag a unit header to reorder the overall learning path.</li>
                        <li>Drag a section card and follow the floating preview under your cursor.</li>
                        <li>Hover above or below a row before you drop to place it precisely.</li>
                        <li>Use Preview on a section to inspect its learner-facing blueprint content.</li>
                        <li>Press Save to persist the ordering to mobile.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </DndProvider>
      )}

      <Modal
        isOpen={!!unitEditor}
        onClose={() => !isStructureMutating && setUnitEditor(null)}
        title={unitEditor?.mode === 'edit' ? 'Edit Unit' : 'Add Unit'}
        maxWidth="lg"
      >
        {unitEditor && (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!unitEditor.unitKey.trim() || !unitEditor.title.trim()) {
                toast.error('Unit key and title are required.');
                return;
              }
              if (unitEditor.mode === 'edit') {
                await updateUnit(unitEditor.originalUnitKey, unitEditor);
              } else {
                await createUnit(unitEditor);
              }
            }}
          >
            <div className="grid gap-4">
              <div>
                <label htmlFor="unit-key" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Unit key
                </label>
                <input
                  id="unit-key"
                  value={unitEditor.unitKey}
                  onChange={(e) => setUnitEditor({ ...unitEditor, unitKey: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="unit-title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Unit title
                </label>
                <input
                  id="unit-title"
                  value={unitEditor.title}
                  onChange={(e) => setUnitEditor({ ...unitEditor, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="unit-subtitle" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Unit subtitle
                </label>
                <input
                  id="unit-subtitle"
                  value={unitEditor.subtitle}
                  onChange={(e) => setUnitEditor({ ...unitEditor, subtitle: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setUnitEditor(null)}
                disabled={isStructureMutating}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isStructureMutating}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isStructureMutating ? 'Saving…' : unitEditor.mode === 'edit' ? 'Save changes' : 'Create unit'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!sectionEditor}
        onClose={() => !isStructureMutating && setSectionEditor(null)}
        title={sectionEditor?.mode === 'edit' ? 'Edit Section' : 'Add Section'}
        maxWidth="lg"
      >
        {sectionEditor && (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!sectionEditor.sectionKey.trim() || !sectionEditor.title.trim()) {
                toast.error('Section key and title are required.');
                return;
              }
              if (sectionEditor.mode === 'edit') {
                await updateSection(sectionEditor);
              } else {
                await createSection(sectionEditor);
              }
            }}
          >
            <div className="grid gap-4">
              <div>
                <StyledSelect
                  id="section-unit"
                  label="Unit"
                  value={sectionEditor.unitKey}
                  onChange={(e) => setSectionEditor({ ...sectionEditor, unitKey: e.target.value })}
                  options={draftUnits.map((unit) => ({
                    value: unit.unit_key,
                    label: `${unit.title} (${unit.unit_key})`,
                  }))}
                  fullWidth
                />
              </div>
              <div>
                <label htmlFor="section-key" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Section key
                </label>
                <input
                  id="section-key"
                  value={sectionEditor.sectionKey}
                  onChange={(e) => setSectionEditor({ ...sectionEditor, sectionKey: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="section-title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Section title
                </label>
                <input
                  id="section-title"
                  value={sectionEditor.title}
                  onChange={(e) => setSectionEditor({ ...sectionEditor, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setSectionEditor(null)}
                disabled={isStructureMutating}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isStructureMutating}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isStructureMutating ? 'Saving…' : sectionEditor.mode === 'edit' ? 'Save changes' : 'Create section'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => !isStructureMutating && setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmButtonText}
        variant={confirmVariant}
        isLoading={isStructureMutating}
      />
    </div>
  );
}
