import {
  ApiResponse,
  LoginRequest,
  SignupRequest,
  OnboardingRequest,
  UserProfile,
  Job,
  JobWithScore,
  JobScore,
  ScoreBreakdown,
  JobsListResponse,
  ResumeData,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function normalizeProfile(raw: any): UserProfile {
  const profile = raw?.profile ?? raw ?? {};

  return {
    id: profile.id || '',
    userId: profile.userId || '',
    skills: profile.skills || [],
    roles: profile.roles || [],
    industries: profile.industries || [],
    yearsOfExperience: profile.yearsOfExperience ?? profile.yearsExperience ?? 0,
    education: profile.education || [],
    technologies: profile.technologies || [],
    resumeUrl: profile.resumeUrl || undefined,
    jobTitle: profile.jobTitle || '',
    targetIndustries: profile.targetIndustries || [],
    desiredSalaryMin:
      profile.desiredSalaryMin !== null && profile.desiredSalaryMin !== undefined
        ? Number(profile.desiredSalaryMin)
        : undefined,
    desiredSalaryMax:
      profile.desiredSalaryMax !== null && profile.desiredSalaryMax !== undefined
        ? Number(profile.desiredSalaryMax)
        : undefined,
    jobType: profile.jobType || [],
    willingToRelocate: Boolean(profile.willingToRelocate),
    careerGoals: profile.careerGoals || '',
    additionalInfo: profile.additionalInfo || '',
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
}

function normalizeScore(raw: any, jobId?: string): JobScore | undefined {
  if (!raw) return undefined;

  const source = raw.jobScore ?? raw.score ?? raw;
  const numericScore = Number(source.overallScore ?? source.score ?? 0);

  return {
    id: source.id || `${jobId || 'score'}-score`,
    jobId: source.jobId || jobId || '',
    userId: source.userId || '',
    overallScore: numericScore,
    skillsScore: Number(source.skillsScore ?? numericScore),
    roleScore: Number(source.roleScore ?? numericScore),
    techScore: Number(source.techScore ?? numericScore),
    experienceScore: Number(source.experienceScore ?? numericScore),
    reasoning: source.reasoning || 'Score generated from your current profile and the role requirements.',
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

function normalizeJob(raw: any): JobWithScore {
  const jobScoreRaw = Array.isArray(raw?.jobScores) ? raw.jobScores[0] : raw?.score;
  const score = normalizeScore(jobScoreRaw, raw?.id);

  return {
    id: raw.id,
    userId: raw.userId,
    title: raw.title,
    company: raw.company,
    description: raw.description,
    requirements: raw.requirements || '',
    salary: raw.salary || undefined,
    location: raw.location || 'Location not specified',
    jobType: raw.jobType || 'Not specified',
    url: raw.url || undefined,
    source: raw.source || 'manual',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    score,
    applied: Array.isArray(raw?.applications) ? raw.applications.length > 0 : Boolean(raw?.applied),
  };
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<any>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: message };
  }
}

// Auth API calls
export const authAPI = {
  signin: (email: string) =>
    apiCall<{ url?: string }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  callback: (email: string, token: string) =>
    apiCall<{ success: boolean }>('/api/auth/callback/email', {
      method: 'POST',
      body: JSON.stringify({ email, token }),
    }),
};

// Profile API calls
export const profileAPI = {
  get: async () => {
    const result = await apiCall<any>('/api/profile', {
      method: 'GET',
    });

    if (!result.success) return result as ApiResponse<UserProfile>;

    return {
      success: true,
      data: normalizeProfile(result.data),
    } as ApiResponse<UserProfile>;
  },

  update: async (data: Partial<UserProfile>) => {
    const result = await apiCall<any>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success) return result as ApiResponse<UserProfile>;

    return {
      success: true,
      data: normalizeProfile(result.data),
    } as ApiResponse<UserProfile>;
  },
};

// Resume Upload API
export const uploadAPI = {
  upload: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      return { success: true, data: data?.data || data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return { success: false, error: message };
    }
  },
};

// Onboarding API calls
export const onboardingAPI = {
  submit: async (data: OnboardingRequest) => {
    const result = await apiCall<any>('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success) return result as ApiResponse<UserProfile>;

    return {
      success: true,
      data: normalizeProfile(result.data),
    } as ApiResponse<UserProfile>;
  },
};

// Jobs API calls
export const jobsAPI = {
  list: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) => {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const query = new URLSearchParams();
    query.append('limit', pageSize.toString());
    query.append('skip', ((page - 1) * pageSize).toString());
    if (params?.search) query.append('search', params.search);

    const result = await apiCall<any>(`/api/jobs?${query.toString()}`, {
      method: 'GET',
    });

    if (!result.success) return result as ApiResponse<JobsListResponse>;

    const rawJobs = result.data?.jobs || [];
    const filteredJobs = params?.search
      ? rawJobs.filter((job: any) =>
          [job.title, job.company, job.location, job.description]
            .filter(Boolean)
            .some((value: string) => value.toLowerCase().includes(params.search!.toLowerCase()))
        )
      : rawJobs;

    return {
      success: true,
      data: {
        jobs: filteredJobs.map(normalizeJob),
        total: result.data?.pagination?.total || filteredJobs.length,
        page,
        pageSize,
      },
    } as ApiResponse<JobsListResponse>;
  },

  get: async (id: string) => {
    const result = await apiCall<any>(`/api/jobs/${id}`, {
      method: 'GET',
    });

    if (!result.success) return result as ApiResponse<JobWithScore>;

    return {
      success: true,
      data: normalizeJob(result.data?.job || result.data),
    } as ApiResponse<JobWithScore>;
  },

  create: (data: Partial<Job>) =>
    apiCall<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Job>) =>
    apiCall<Job>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiCall<void>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }),
};

// Score API calls
export const scoreAPI = {
  calculate: async (jobId: string) => {
    const result = await apiCall<any>('/api/score', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    });

    if (!result.success) return result as ApiResponse<JobScore>;

    return {
      success: true,
      data: normalizeScore(result.data, jobId),
    } as ApiResponse<JobScore>;
  },

  get: async (jobId?: string) => {
    const query = jobId ? `?jobId=${jobId}` : '';
    const result = await apiCall<any>(`/api/score${query}`, {
      method: 'GET',
    });

    if (!result.success) return result as ApiResponse<JobScore | JobScore[]>;

    if (jobId) {
      return {
        success: true,
        data: normalizeScore(result.data, jobId) as JobScore,
      } as ApiResponse<JobScore>;
    }

    return {
      success: true,
      data: (result.data?.scores || []).map((item: any) => normalizeScore(item, item.jobId)).filter(Boolean),
    } as ApiResponse<JobScore[]>;
  },
};

// Utility function to parse score breakdown
export function parseScoreBreakdown(score: JobScore): ScoreBreakdown {
  return {
    skills: score.skillsScore,
    role: score.roleScore,
    tech: score.techScore,
    experience: score.experienceScore,
    overall: score.overallScore,
    reasoning: score.reasoning,
  };
}

// Helper to determine score quality
export function getScoreQuality(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// Helper to get score color
export function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}
