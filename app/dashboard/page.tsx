'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserProfile, JobWithScore } from '@/lib/types';
import { profileAPI, jobsAPI } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';
import ResumeUpload from '@/components/ResumeUpload';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const profileResult = await profileAPI.get();
        if (!profileResult.success) {
          router.push('/login');
          return;
        }
        setProfile(profileResult.data!);

        const jobsResult = await jobsAPI.list({ pageSize: 6 });
        if (jobsResult.success) {
          setRecentJobs(jobsResult.data?.jobs || []);
        }
      } catch (err) {
        setError('Failed to load dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const readinessScore = useMemo(() => {
    if (!profile) return 0;
    const checks = [
      Boolean(profile.jobTitle),
      Boolean(profile.careerGoals),
      (profile.skills?.length || 0) > 4,
      (profile.targetIndustries?.length || 0) > 0,
      Boolean(profile.desiredSalaryMin || profile.desiredSalaryMax),
      Boolean(profile.resumeUrl),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const topMatches = useMemo(
    () => [...recentJobs].sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0)).slice(0, 3),
    [recentJobs]
  );

  if (loading) return <LoadingPage />;

  if (error || !profile) {
    return (
      <div className="page-shell">
        <div className="premium-card p-8 text-center">
          <p className="text-red-300">{error || 'Failed to load profile'}</p>
          <Link href="/" className="mt-4 inline-block text-blue-300 hover:text-blue-200">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Skills captured', value: profile.skills?.length || 0, detail: 'Resume + profile intelligence' },
    { label: 'Years of experience', value: profile.yearsOfExperience || 0, detail: 'Used for job fit scoring' },
    { label: 'Target industries', value: profile.targetIndustries?.length || 0, detail: 'Powering search alignment' },
    { label: 'Saved opportunities', value: recentJobs.length, detail: 'Fresh roles in your pipeline' },
  ];

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
          <div>
            <div className="badge mb-4">Career command center</div>
            <h1 className="section-heading text-4xl md:text-5xl">
              Welcome back{profile.jobTitle ? `, ${profile.jobTitle}` : ''}.
            </h1>
            <p className="section-subcopy mt-4 max-w-2xl text-base md:text-lg">
              Keep your search momentum high with tighter profile data, sharper cover letters, and a cleaner view of the roles that deserve your time.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setShowUpload((prev) => !prev)} className="btn-primary">
                {showUpload ? 'Close resume upload' : 'Upload resume'}
              </button>
              <Link href="/dashboard/jobs" className="btn-secondary">
                Browse job matches
              </Link>
              <Link href="/dashboard/applications" className="btn-secondary">
                Open application tracker
              </Link>
            </div>
          </div>

          <div className="premium-card-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Profile readiness</div>
                <div className="mt-2 text-5xl font-bold text-white">{readinessScore}%</div>
              </div>
              <div className="h-24 w-24 rounded-full border-[10px] border-blue-500/30 flex items-center justify-center text-lg font-semibold text-blue-300">
                {readinessScore}
              </div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500" style={{ width: `${readinessScore}%` }} />
            </div>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Resume uploaded</span><span>{profile.resumeUrl ? 'Yes' : 'Not yet'}</span></div>
              <div className="flex items-center justify-between"><span>Career goals defined</span><span>{profile.careerGoals ? 'Yes' : 'Add context'}</span></div>
              <div className="flex items-center justify-between"><span>Preferred industries</span><span>{profile.targetIndustries?.length || 0}</span></div>
            </div>
          </div>
        </div>
      </section>

      {showUpload && (
        <section className="premium-card p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Refresh your resume intelligence</h2>
              <p className="mt-1 text-sm text-slate-400">Upload your latest resume so Careeva can sharpen scoring, writing, and search suggestions.</p>
            </div>
            <button onClick={() => setShowUpload(false)} className="btn-ghost">Close</button>
          </div>
          <ResumeUpload
            onSuccess={() => {
              setShowUpload(false);
              profileAPI.get().then((result) => {
                if (result.success) setProfile(result.data!);
              });
            }}
            onError={(message) => setError(message)}
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-tile">
            <div className="text-sm text-slate-400">{stat.label}</div>
            <div className="mt-3 text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-500">{stat.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="premium-card p-7">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top opportunities</h2>
              <p className="mt-1 text-sm text-slate-400">Highest-signal roles from your latest job feed.</p>
            </div>
            <Link href="/dashboard/jobs" className="btn-ghost">See all jobs</Link>
          </div>

          {topMatches.length > 0 ? (
            <div className="space-y-4">
              {topMatches.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="premium-card-soft block p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">{job.title}</div>
                      <div className="mt-1 text-sm text-slate-300">{job.company} · {job.location}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="badge capitalize">{job.jobType}</span>
                        {job.salary && <span className="badge">{job.salary}</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-center">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Match</div>
                      <div className="mt-1 text-3xl font-bold text-blue-300">{Math.round(job.score?.overallScore || 0)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state !p-8">
              <div className="text-4xl">💼</div>
              <h3 className="mt-4 text-xl font-semibold text-white">No role recommendations yet</h3>
              <p className="mt-2 text-slate-400">Complete onboarding and upload a resume to unlock stronger job matching.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/dashboard/onboarding" className="btn-primary">Complete onboarding</Link>
                <button onClick={() => setShowUpload(true)} className="btn-secondary">Upload resume</button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="premium-card p-7">
            <h2 className="text-2xl font-semibold text-white">Next best actions</h2>
            <div className="mt-5 space-y-3 text-sm">
              <Link href="/dashboard/onboarding" className="premium-card-soft flex items-start justify-between gap-3 p-4 hover:bg-white/[0.05]">
                <div>
                  <div className="font-medium text-white">Refine your job preferences</div>
                  <div className="mt-1 text-slate-400">Dial in salary, industries, and job types for stronger targeting.</div>
                </div>
                <span className="text-slate-500">→</span>
              </Link>
              <Link href="/dashboard/cover-letter" className="premium-card-soft flex items-start justify-between gap-3 p-4 hover:bg-white/[0.05]">
                <div>
                  <div className="font-medium text-white">Generate a tailored cover letter</div>
                  <div className="mt-1 text-slate-400">Turn a job description into a polished draft in one flow.</div>
                </div>
                <span className="text-slate-500">→</span>
              </Link>
              <Link href="/dashboard/profile" className="premium-card-soft flex items-start justify-between gap-3 p-4 hover:bg-white/[0.05]">
                <div>
                  <div className="font-medium text-white">Polish profile context</div>
                  <div className="mt-1 text-slate-400">Add goals and positioning to improve application quality.</div>
                </div>
                <span className="text-slate-500">→</span>
              </Link>
            </div>
          </div>

          <div className="premium-card p-7">
            <h2 className="text-2xl font-semibold text-white">Snapshot</h2>
            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div>
                <div className="text-slate-500">Target title</div>
                <div className="mt-1 text-base text-white">{profile.jobTitle || 'Not set yet'}</div>
              </div>
              <div>
                <div className="text-slate-500">Preferred industries</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.targetIndustries?.length ? profile.targetIndustries : ['Add industries']).map((industry) => (
                    <span key={industry} className="badge">{industry}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Career goals</div>
                <p className="mt-1 leading-6 text-slate-300">{profile.careerGoals || 'Add a short direction statement so writing and matching feels more personal and aligned.'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
