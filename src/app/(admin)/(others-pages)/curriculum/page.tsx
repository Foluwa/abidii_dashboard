import SectionHub from "@/components/admin/navigation/SectionHub";

const curriculumLinks = [
  { label: "Courses", href: "/curriculum/courses" },
  { label: "Curriculum Editor", href: "/curriculum/editor" },
  { label: "Lesson Blueprints", href: "/curriculum/lesson-blueprints" },
  { label: "Publishing & Readiness", href: "/curriculum/publishing" },
];

export default function CurriculumHubPage() {
  return (
    <SectionHub
      title="Curriculum"
      description="Course structure, sequencing, blueprinting, lesson building, and publishing readiness."
      links={curriculumLinks}
    />
  );
}
