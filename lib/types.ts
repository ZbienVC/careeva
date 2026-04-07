// User & Auth Types
export interface UserSession {
  user?: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}

export interface UserProfile {
  id: string;
  userId: string;
  skills: string[];
  roles: string[];
  industries: string[];
  yearsOfExperience: number;
  education: string[];
  technologies: string[];
  resumeUrl?: string;
  jobTitle?: string;
  targetIndustries?: string[];
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  jobType?: string[];
  willingToRelocate?: boolean;
  careerGoals?: string;
  additionalInfo?: string;
  createdAt: string;
  updatedAt: string;
}

// Job Types
export interface Job {
  id: string;
  userId: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  salary?: string;
  location: string;
  jobType: string;
  url?: string;
  source: string;
  applyUrl?: string;
  atsType?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithScore extends Job {
  score?: JobScore;
  applied?: boolean;
}

// Job Score Types
export interface JobScore {
  id: string;
  jobId: string;
  userId: string;
  overallScore: number;
  skillsScore: number;
  roleScore: number;
  techScore: number;
  experienceScore: number;
  reasoning: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreBreakdown {
  skills: number;
  role: number;
  tech: number;
  experience: number;
  overall: number;
  reasoning: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
}

export interface SignupRequest {
  email: string;
  name: string;
}

export interface OnboardingRequest {
  jobTitle?: string;
  targetIndustries?: string[];
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  jobType?: string[];
  willingToRelocate?: boolean;
  careerGoals?: string;
  additionalInfo?: string;
}

export interface JobsListResponse {
  jobs: JobWithScore[];
  total: number;
  page: number;
  pageSize: number;
}

// Resume Data from Parser
export interface ResumeData {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsOfExperience: number;
  education: string[];
  technologies: string[];
}

// Filter Types
export interface JobFilters {
  search?: string;
  industries?: string[];
  salaryMin?: number;
  salaryMax?: number;
  jobType?: string[];
  location?: string;
  sortBy?: 'recent' | 'score' | 'salary';
}
