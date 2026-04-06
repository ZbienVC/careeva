'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { JobWithScore, JobScore } from '@/lib/types';
import { jobsAPI, scoreAPI, profileAPI, parseScoreBreakdown } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';

// Score dimension bar component
function DimensionBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className={`font-bold tabular-nums ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-400">{weight}% of total score</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-black tabular-nums" style={{ color }}>{score}</p>
        <p className="text-[10px] text-slate-400 font-semibold">MATCH</p>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobWithScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoring, setScoring] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ status: string; message?: string } | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [coverLetterPreview, setCoverLetterPreview] = useState('');
  const [generatingCL, setGeneratingCL] = useState(false);
  const [showCLModal, setShowCLModal] = useState(false);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const authResult = await profileAPI.get();
        if (!authResult.success) { router.push('/login'); return; }

        const result = await jobsAPI.get(jobId);
        if (result.success) {
          setJob(result.data!);
          if (!result.data?.score) {
            setScoring(true);
            const scoreResult = await scoreAPI.calculate(jobId);
            if (scoreResult.success && result.data) {
              setJob({ ...result.data, score: scoreResult.data as any });
            }
            setScoring(false);
          }
          // Load gap analysis in background
          setLoadingAnalysis(true);
          fetch(`/api/jobs/${jobId}/analyze`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setAnalysis(data); })
            .catch(() => {})
            .finally(() => setLoadingAnalysis(false));
        } else {
          setError(result.error || 'Failed to load job');
        }
      } catch (err) {
        setError('Failed to load job details');
      } finally {
        setLoading(false);
      }
    };
    loadJob();
  }, [jobId, router]);

  const handleGenerateCL = async () => {
    if (!job) return;
    setGeneratingCL(true);
    try {
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, jobTitle: job.title, company: job.company, jobDescription: job.description }),
      });
      const data = await res.json();
      if (data.coverLetter) { setCoverLetterPreview(data.coverLetter); setShowCLModal(true); }
    } catch { /* non-fatal */ }
    setGeneratingCL(false);
  };

  const handleAutoApply = async () => {
    if (!job) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ coverLetterOverride: coverLetterPreview || undefined }),
      });
      const data = await res.json();
      setApplyResult({ status: data.status || 'applied', message: data.message });
    } catch (err) {
      setApplyResult({ status: 'error', message: 'Apply failed' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <LoadingPage />;
  if (error || !job) return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
        <Link href="/dashboard/jobs" className="text-indigo-600 font-semibold">← Back to Jobs</Link>
      </div>
    </div>
  );

  const score = job.score;
  const overallScore = score?.overallScore || 0;
  const canDirectApply = job.atsType === 'greenhouse' || job.atsType === 'lever';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/dashboard/jobs" className="text-sm text-slate-400 hover:text-slate-700 font-semibold flex items-center gap-1">
        ← Jobs
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{job.title}</h1>
            <p className="text-slate-500 text-base mt-0.5 font-medium">{job.company}</p>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-500">
              {job.location && <span>📍 {job.location}</span>}
              {job.jobType && <span className="capitalize">⏱ {job.jobType}</span>}
              {job.salary && <span>💰 {job.salary}</span>}
              {job.atsType && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase">{job.atsType}</span>
              )}
            </div>
          </div>
          {/* Score ring */}
          <div className="flex flex-col items-center gap-2">
            {scoring ? (
              <div className="w-24 h-24 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ScoreRing score={overallScore} />
            )}
            <span className="text-xs text-slate-400 font-semibold">
              {overallScore >= 75 ? '🔥 Strong Match' : overallScore >= 55 ? '👍 Good Match' : '⚠️ Weak Match'}
            </span>
          </div>
        </div>

        {/* Apply actions */}
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-100">
          <button
            onClick={handleGenerateCL}
            disabled={generatingCL}
            className="px-5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-all disabled:opacity-50"
          >
            {generatingCL ? '⏳ Generating...' : '✉️ Preview Cover Letter'}
          </button>
          {canDirectApply && (
            <button
              onClick={handleAutoApply}
              disabled={applying}
              className="px-5 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
            >
              {applying ? '⏳ Applying...' : `⚡ Auto-Apply via ${job.atsType}`}
            </button>
          )}
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
              🔗 View Original
            </a>
          )}
        </div>
        {applyResult && (
          <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold ${applyResult.status === 'applied' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {applyResult.status === 'applied' ? '✅ Application submitted!' : `ℹ️ ${applyResult.message || applyResult.status}`}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Job description */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-black text-slate-900 mb-3">About This Role</h2>
            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{job.description}</div>
            {job.requirements && (
              <>
                <h3 className="text-base font-black text-slate-900 mt-5 mb-2">Requirements</h3>
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{job.requirements}</div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar: score breakdown + gap analysis */}
        <div className="space-y-4">
          {/* Score breakdown */}
          {score && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Match Breakdown</h3>
              <DimensionBar label="Skills" score={score.skillsScore / 100} weight={30} />
              <DimensionBar label="Role Title" score={score.roleScore / 100} weight={25} />
              <DimensionBar label="Tech Stack" score={score.techScore / 100} weight={15} />
              <DimensionBar label="Experience" score={score.experienceScore / 100} weight={10} />
            </div>
          )}

          {/* Keyword gap analysis */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">Keyword Analysis</h3>
            {loadingAnalysis ? (
              <p className="text-slate-400 text-sm">Analyzing...</p>
            ) : analysis ? (
              <div className="space-y-3">
                {analysis.matchedSkills?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-emerald-600 mb-1.5">✓ You have these</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.matchedSkills.slice(0, 10).map((s: string) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.missingRequired?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-red-500 mb-1.5">⚠ Gaps to be aware of</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.missingRequired.slice(0, 8).map((s: string) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.tailoringNotes && (
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-indigo-700 mb-1">💡 How to position yourself</p>
                    <p className="text-xs text-indigo-600 leading-relaxed">{analysis.tailoringNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs">Complete your profile to see keyword analysis</p>
            )}
          </div>
        </div>
      </div>

      {/* Cover letter preview modal */}
      {showCLModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Cover Letter Preview</h2>
              <span className="text-xs text-slate-400 font-semibold">{job.title} at {job.company}</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {coverLetterPreview}
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(coverLetterPreview)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Copy
              </button>
              <button onClick={() => { setShowCLModal(false); handleAutoApply(); }}
                disabled={!canDirectApply || applying}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                {canDirectApply ? '⚡ Send & Apply' : 'No direct submit available'}
              </button>
              <button onClick={() => setShowCLModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
