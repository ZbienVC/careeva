'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconBarChart,
  IconTrendingUp,
  IconAlertTriangle,
  IconArrowRight,
  IconSparkles,
} from '@/components/icons';

interface ScoreBand {
  total: number;
  interviews: number;
  offers: number;
  rejected: number;
}

interface PatternsData {
  totalApplications: number;
  responseRate?: number;
  interviewRate?: number;
  offerCount?: number;
  scoreRangeAnalysis?: Record<string, ScoreBand>;
  atsPerformance?: Record<string, { total: number; interviews: number }>;
  topInterviewCompanies?: { company: string; role: string; status: string }[];
  rejectedCompanies?: { company: string; role: string }[];
  optimalScoreThreshold?: number;
  aiInsights?: string;
  recommendation?: string;
  message?: string;
}

const SCORE_BANDS = [
  { key: '80-100', label: 'Strong match', range: '80–100' },
  { key: '60-79',  label: 'Good match',   range: '60–79'  },
  { key: '40-59',  label: 'Fair match',   range: '40–59'  },
  { key: '0-39',   label: 'Low match',    range: '0–39'   },
] as const;

export default function PatternsPage() {
  const router = useRouter();
  const [data, setData] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/applications/patterns', { credentials: 'include' });
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch patterns');
        setData(await res.json());
      } catch {
        setError('Unable to load pattern insights right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
      Loading…
    </div>
  );

  const total = data?.totalApplications ?? 0;
  const lowData = total < 5;
  const bands = data?.scoreRangeAnalysis;

  return (
    <div className="page-shell space-y-8">
      {/* Hero */}
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="badge mb-4">Insights</div>
        <h1 className="section-heading text-4xl">What&apos;s working in your search.</h1>
        <p className="section-subcopy mt-4">
          Careeva studies the outcome of every application — which match scores convert,
          where interviews come from — and sharpens these insights as results accumulate.
        </p>

        {/* Stat tiles */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Applications',   value: total },
            { label: 'Response Rate',  value: `${data?.responseRate ?? 0}%` },
            { label: 'Interview Rate', value: `${data?.interviewRate ?? 0}%` },
            { label: 'Offers',         value: data?.offerCount ?? 0 },
          ].map(s => (
            <div key={s.label} className="stat-tile">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="alert-error flex items-center gap-2">
          <IconAlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Low-data notice */}
      {!error && lowData && (
        <div className="premium-card-soft flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400">
              <IconBarChart size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Insights sharpen with more data</p>
              <p className="mt-1 text-sm text-slate-400">
                You have {total} tracked application{total === 1 ? '' : 's'}. Patterns become
                meaningful after roughly 5 or more — keep applying and check back.
              </p>
            </div>
          </div>
          <Link href="/dashboard/automation" className="btn-primary text-sm !px-4 !py-2">
            Run automation <IconArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Performance by match score */}
      {!error && bands && (
        <section className="premium-card p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
              <IconTrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Performance by match score</h2>
              <p className="text-sm text-slate-400">How applications convert at each score band.</p>
            </div>
          </div>

          <div className="space-y-4">
            {SCORE_BANDS.map(band => {
              const stats = bands[band.key] || { total: 0, interviews: 0, offers: 0, rejected: 0 };
              const pct = stats.total > 0 ? Math.round((stats.interviews / stats.total) * 100) : 0;
              return (
                <div key={band.key} className="flex flex-wrap items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{band.label}</p>
                    <p className="text-xs text-slate-500">Score {band.range}</p>
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-5 text-right tabular-nums">
                    <div className="w-14">
                      <p className="text-sm font-bold text-white">{stats.total}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Applied</p>
                    </div>
                    <div className="w-16">
                      <p className="text-sm font-bold text-violet-300">{stats.interviews}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Interviews</p>
                    </div>
                    <div className="w-12">
                      <p className="text-sm font-bold text-emerald-300">{stats.offers}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Offers</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendation */}
      {!error && data?.recommendation && (
        <div className="alert-info flex items-start gap-2">
          <IconTrendingUp size={16} className="mt-0.5 flex-shrink-0" />
          <span>{data.recommendation}</span>
        </div>
      )}

      {/* AI insights */}
      {!error && data?.aiInsights && (
        <section className="premium-card-soft p-6">
          <div className="mb-3 flex items-center gap-2">
            <IconSparkles size={16} className="text-amber-300" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">AI insights</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{data.aiInsights}</p>
        </section>
      )}
    </div>
  );
}
