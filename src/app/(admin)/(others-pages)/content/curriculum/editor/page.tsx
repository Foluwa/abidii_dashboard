'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DndProvider, useDrag, useDragLayer, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { useAdminCoursesList, useConfig, useCourseCurriculumByKey } from '@/hooks/useApi';
import type { CurriculumSection, CurriculumUnit } from '@/types/curriculum';
import {
  moveCourseSection,
  reorderCourseAtomicV2,
  reorderCourseSections,
  reorderCourseUnits,
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
}: {
  unit: DraftUnit;
  index: number;
  moveUnit: (from: number, to: number) => void;
  moveSection: (fromUnit: string, fromIndex: number, toUnit: string, toIndex: number) => void;
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
}: {
  section: CurriculumSection;
  unitKey: string;
  index: number;
  moveSection: (fromUnit: string, fromIndex: number, toUnit: string, toIndex: number) => void;
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
      playable: Boolean(section.blueprint_key),
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
        {section.blueprint_key ? 'Playable' : 'Coming soon'}
      </div>
    </div>
  );
}

export default function CurriculumEditorPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { data: courses, isLoading: coursesLoading } = useAdminCoursesList({ limit: 200 });
  const { config } = useConfig();

  const courseOptions = courses?.items ?? [];
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
  } = useCourseCurriculumByKey(selectedCourseKey || null);

  const [draftUnits, setDraftUnits] = useState<DraftUnit[]>([]);
  const [lastSavedUnits, setLastSavedUnits] = useState<DraftUnit[]>([]);
  const [initialSectionUnits, setInitialSectionUnits] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

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
        mapping[section.section_key] = unit.unit_key;
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
  }, [curriculum]);

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
          if (!initialSectionUnits[s.section_key] || initialSectionUnits[s.section_key] === u.unit_key) {
            return [];
          }

          return [{
            section_key: s.section_key,
            from_unit_key: initialSectionUnits[s.section_key],
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
        const shouldRefresh = typeof window !== 'undefined'
          ? window.confirm(`${conflictMessage}\n\nRefresh now?`)
          : false;
        if (shouldRefresh) {
          await refresh();
        }
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
            onClick={copyJson}
            className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
          >
            Copy JSON
          </button>
          <button
            onClick={saveChanges}
            disabled={isSaving}
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
          <select
            id="courseKey"
            value={selectedCourseKey}
            onChange={(e) => setSelectedCourseKey(e.target.value)}
            className="min-w-[240px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {courseOptions.map((course) => (
              <option key={course.id} value={course.course_key}>
                {course.title}
              </option>
            ))}
          </select>
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
          <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
            <div className="space-y-4">
              {draftUnits.map((unit, idx) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  index={idx}
                  moveUnit={moveUnit}
                  moveSection={moveSection}
                />
              ))}
              {draftUnits.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800">
                  No units found for this course.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tips</h3>
                <ul className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <li>Drag a unit header to reorder the overall learning path.</li>
                  <li>Drag a section card and follow the floating preview under your cursor.</li>
                  <li>Hover above or below a row before you drop to place it precisely.</li>
                  <li>Press Save to persist the ordering to mobile.</li>
                </ul>
              </div>
            </div>
          </div>
        </DndProvider>
      )}
    </div>
  );
}
