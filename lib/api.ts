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

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
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
  get: () =>
    apiCall<UserProfile>('/api/profile', {
      method: 'GET',
    }),

  update: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return { success: false, error: message };
    }
  },
};

// Onboarding API calls
export const onboardingAPI = {
  submit: (data: OnboardingRequest) =>
    apiCall<UserProfile>('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Jobs API calls
export const jobsAPI = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.search) query.append('search', params.search);

    return apiCall<JobsListResponse>(`/api/jobs?${query.toString()}`, {
      method: 'GET',
    });
  },

  get: (id: string) =>
    apiCall<JobWithScore>(`/api/jobs/${id}`, {
      method: 'GET',
    }),

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
  calculate: (jobId: string) =>
    apiCall<JobScore>('/api/score', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    }),

  get: (jobId?: string) => {
    const query = jobId ? `?jobId=${jobId}` : '';
    return apiCall<JobScore | JobScore[]>(`/api/score${query}`, {
      method: 'GET',
    });
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
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#3b82f6'; // blue
  if (score >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}
