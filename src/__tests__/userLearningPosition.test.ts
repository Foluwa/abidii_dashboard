import {
  resolveUserLearningPosition,
  selectCurrentCourse,
} from '@/lib/user-learning-position';
import type { CourseCurriculumResponse } from '@/types/curriculum';

const curriculum = {
  id: 'course-1',
  course_key: 'yoruba-v1',
  title: 'Abidii Yoruba',
  description: null,
  status: 'published',
  enabled: true,
  availability: 'available',
  units: [
    {
      id: 'unit-1',
      unit_key: 'sounds',
      title: 'Sound Like Yorùbá',
      subtitle: null,
      status: 'published',
      enabled: true,
      availability: 'available',
      sections: [
        {
          id: 'section-2',
          section_key: 'hear-and-read',
          title: 'Hear and Read Ẹ, Ọ, Ṣ',
          status: 'published',
          enabled: true,
          availability: 'available',
          lesson_blueprint_id: 'blueprint-2',
          blueprint_key: 'lesson-2',
        },
      ],
    },
  ],
} as CourseCurriculumResponse;

describe('user learning position', () => {
  it('prefers a course with an active learning pointer', () => {
    expect(
      selectCurrentCourse([
        { course_id: 'old', is_completed: true },
        { course_id: 'current', current_section_id: 'section-2' },
      ])?.course_id,
    ).toBe('current');
  });

  it('resolves current unit and lesson titles from the curriculum tree', () => {
    expect(
      resolveUserLearningPosition(
        {
          course_id: 'course-1',
          course_title: 'Abidii Yoruba',
          current_unit_id: 'unit-1',
          current_section_id: 'section-2',
        },
        curriculum,
      ),
    ).toEqual({
      courseTitle: 'Abidii Yoruba',
      unitTitle: 'Sound Like Yorùbá',
      lessonTitle: 'Hear and Read Ẹ, Ọ, Ṣ',
      status: 'current',
    });
  });

  it('derives the unit from a current section when the unit pointer is absent', () => {
    const position = resolveUserLearningPosition(
      { course_id: 'course-1', current_section_id: 'section-2' },
      curriculum,
    );

    expect(position.unitTitle).toBe('Sound Like Yorùbá');
    expect(position.lessonTitle).toBe('Hear and Read Ẹ, Ọ, Ṣ');
  });
});
