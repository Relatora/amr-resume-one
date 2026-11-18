// One downloadable resume per target role. `id` is the URL segment
// (/resume/<id>); `file` is a PDF in docs/resumes, built from the LaTeX
// masters by ai-job-search's tools/build_public_resumes.py.
export interface ResumeOption {
  id: string;
  label: string;
  file: string;
}

export interface Personal {
  name: string;
  title: string;
  email: string;
  // The first entry is the default for the plain /resume link.
  resumes: ResumeOption[];
  github: string;
  location: string;
  summary: string;
}

export interface ExperienceEntry {
  id: string;
  title: string;
  org: string;
  start: string;
  end: string;
  type: string;
  summary: string;
  bullets: string[];
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
}

export interface EducationEntry {
  id: string;
  credential: string;
  institution: string;
  start: string;
  end: string;
  details: string[];
}

// One card in the intro project spot. `image` is a path under public/
// (public/projects/<id>.webp by convention, 1280x800). `live` is optional:
// an empty string means the project has no hosted demo to link to.
export interface ProjectEntry {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  repo: string;
  live: string;
  image: string;
  imageAlt: string;
}

export interface ResumeContent {
  personal: Personal;
  experience: ExperienceEntry[];
  skills: SkillGroup[];
  education: EducationEntry[];
  // Optional so content saved in a browser before projects existed still
  // loads; read it through `content.projects ?? []`.
  projects?: ProjectEntry[];
}

export type SectionKey = "experience" | "skills" | "education";
