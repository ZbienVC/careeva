'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { profileAPI, jobsAPI } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';

interface PipelineStats {
  totalJobs: number;
  scoredJobs: number;
  highMatchJobs: number;
  applications: number;
  interviews: number;
  interviewRate: number;
}

function StatCard({ label, value, sub, color, href }: { label: string; value: string | number; sub?: string; color?: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${href ? 'hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer' : ''}`}>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black tabular-nums ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function QuickAction({ icon, label, desc, href, gradient }: { icon: string; label: string; desc: string; href: string; gradient: string }) {
  return (
    <Link href={href} className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-slate-200 hover:shadow-md transition-all block">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3" style={{ background: gradient }}>
        {icon}
      </div>
      <p className="font-bold text-slate-900 text-sm mb-0.5">{label}</p>
      <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(0);

  useEffect(() => {
    (async () => {
      const profileResult = await profileAPI.get();
      if (!profileResult.success) { router.push('/login'); return; }
      setProfile(profileResult.data);

      // Pipeline stats
      const [pipeRes, jobsRes, appsRes, fullRes] = await Promise.all([
        fetch('/api/automate').then(r => r.ok ? r.json() : null),
        jobsAPI.list({ pageSize: 5 }),
        fetch('/api/applications').then(r => r.ok ? r.json() : []),
        fetch('/api/profile/full').then(r => r.ok ? r.json() : null),
      ]);

      if (pipeRes?.pipeline) setPipeline(pipeRes.pipeline);
      if (jobsRes.success) setRecentJobs(jobsRes.data?.jobs || []);
      if (Array.isArray(appsRes)) setRecentApps(appsRes.slice(0, 5));
      if (fullRes?.completeness) setProfileComplete(fullRes.completeness);

      setLoading(false);
    })();
  }, [router]);

  if (loading) return <LoadingPage />;

  const firstName = profile?.name?.split(' ')[0] || 'there';
  const needsOnboarding = !profile?.skills?.length && !profile?.jobTitle;
  const interviewRate = pipeline ? (pipeline.applications > 0 ? Math.round((pipeline.interviews || 0) / pipeline.applications * 100) : 0) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Hey {firstName} 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {needsOnboarding
              ? 'Complete your profile to start automating applications'
              : `Your job search is ${pipeline?.highMatchJobs ? 'active' : 'ready to run'}`}
          </p>
        </div>
        <Link href="/dashboard/automation"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Run Auto-Apply
        </Link>
      </div>

      {/* Onboarding CTA */}
      {needsOnboarding && (
        <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-2xl border border-indigo-100 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-slate-900 text-base mb-1">Complete your profile to unlock auto-apply</p>
              <p className="text-slate-500 text-sm">The more you share, the better Careeva matches and writes for you. Estimated 15-20 minutes.</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-2 bg-slate-200 rounded-full flex-1 max-w-[200px] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all" style={{ width: `${profileComplete}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-500">{profileComplete}% complete</span>
              </div>
            </div>
            <Link href="/dashboard/onboarding"
              className="px-6 py-3 rounded-xl text-white font-bold text-sm whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              Build Profile →
            </Link>
          </div>
        </div>
      )}

      {/* Pipeline Stats */}
      {pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Jobs Found" value={pipeline.totalJobs} sub="in your pipeline" href="/dashboard/jobs" />
          <StatCard label="High Match" value={pipeline.highMatchJobs} sub="score ≥ 70" color="text-emerald-600" href="/dashboard/jobs" />
          <StatCard label="Applied" value={pipeline.applications} sub="total submitted" color="text-indigo-600" href="/dashboard/applications" />
          <StatCard label="Interview Rate" value={`${interviewRate}%`} sub={`${pipeline.interviews || 0} interviews`} color={interviewRate >= 15 ? 'text-emerald-600' : 'text-slate-900'} href="/dashboard/applications" />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction icon="⚡" label="Run Auto-Apply" desc="Search, score, and apply in one click" href="/dashboard/automation" gradient="linear-gradient(135deg,#10b981,#059669)" />
          <QuickAction icon="💼" label="Browse Jobs" desc="View your scored job feed" href="/dashboard/jobs" gradient="linear-gradient(135deg,#6366f1,#4f46e5)" />
          <QuickAction icon="📋" label="Applications" desc="Track status and provide feedback" href="/dashboard/applications" gradient="linear-gradient(135deg,#0ea5e9,#0284c7)" />
          <QuickAction icon="👤" label="Profile" desc="Add more data to improve results" href="/dashboard/profile" gradient="linear-gradient(135deg,#f59e0b,#d97706)" />
        </div>
      </div>

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Recent High Matches</h2>
            <Link href="/dashboard/jobs" className="text-xs text-indigo-500 font-semibold hover:text-indigo-700">See all →</Link>
          </div>
          <div className="space-y-2">
            {recentJobs.slice(0, 5).map((job: any) => {
              const score = job.jobScores?.[0]?.overallScore || job.score?.overallScore || 0;
              return (
                <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-4 py-3 hover:border-slate-200 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm truncate">{job.title}</p>
                    <p className="text-slate-400 text-xs">{job.company} {job.location ? `· ${job.location}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {job.atsType && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{job.atsType}</span>
                    )}
                    {score > 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${score >= 75 ? 'bg-emerald-50 text-emerald-700' : score >= 55 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                        {score}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent applications */}
      {recentApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Recent Applications</h2>
            <Link href="/dashboard/applications" className="text-xs text-indigo-500 font-semibold hover:text-indigo-700">See all →</Link>
          </div>
          <div className="space-y-2">
            {recentApps.map((app: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{app.role}</p>
                  <p className="text-slate-400 text-xs">{app.company} · {new Date(app.dateApplied || app.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                  app.status === 'applied' ? 'bg-emerald-50 text-emerald-700' :
                  app.status === 'phone_screen' || app.status === 'interview' ? 'bg-indigo-50 text-indigo-700' :
                  app.status === 'offer' ? 'bg-emerald-100 text-emerald-800' :
                  app.status === 'rejected' ? 'bg-red-50 text-red-600' :
                  'bg-slate-100 text-slate-500'
                }`}>{app.status?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile completeness nudge */}
      {!needsOnboarding && profileComplete < 80 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-900 text-sm">Profile {profileComplete}% complete</p>
            <p className="text-amber-700 text-xs mt-0.5">More profile data = better job matches + more accurate cover letters</p>
          </div>
          <Link href="/dashboard/profile" className="px-4 py-2 rounded-xl text-sm font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-all whitespace-nowrap">
            Add more →
          </Link>
        </div>
      )}
    </div>
  );
}
