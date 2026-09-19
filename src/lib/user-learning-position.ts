import type { CourseCurriculumResponse } from '@/types/curriculum';

export interface AdminCourseLearningState {
  course_id: string;
  course_title?: string | null;
  last_active_at?: string | null;
  current_unit_id?: string | null;
  current_section_id?: string | null;
  is_completed?: boolean;
}

export interface UserLearningPosition {
  courseTitle: string | null;
  unitTitle: string | null;
  lessonTitle: string | null;
  status: 'current' | 'completed' | 'not_started';
}

export function selectCurrentCourse(
  courses: AdminCourseLearningState[],
): AdminCourseLearningState | null {
  if (!courses.length) return null;
  return (
    courses.find((course) => course.current_section_id || course.current_unit_id) ??
    courses[0]
  );
}

export function resolveUserLearningPosition(
  course: AdminCourseLearningState,
  curriculum?: CourseCurriculumResponse | null,
): UserLearningPosition {
  const sectionUnit = course.current_section_id
    ? curriculum?.units.find((unit) =>
        unit.sections.some((section) => section.id === course.current_section_id),
      )
    : undefined;
  const unit =
    sectionUnit ??
    curriculum?.units.find((candidate) => candidate.id === course.current_unit_id);
  const lesson = unit?.sections.find(
    (section) => section.id === course.current_section_id,
  );
  const hasCurrentPointer = Boolean(
    course.current_unit_id || course.current_section_id,
  );

  return {
    courseTitle: course.course_title ?? curriculum?.title ?? null,
    unitTitle: unit?.title ?? null,
    lessonTitle: lesson?.title ?? null,
    status: hasCurrentPointer
      ? 'current'
      : course.is_completed
        ? 'completed'
        : 'not_started',
  };
}
