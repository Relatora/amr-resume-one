export interface Personal {
  name: string;
  title: string;
  email: string;
  website: string;
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

export interface ResumeContent {
  personal: Personal;
  experience: ExperienceEntry[];
  skills: SkillGroup[];
  education: EducationEntry[];
}

export type SectionKey = "experience" | "skills" | "education";
