'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileAPI } from '@/lib/api';

type Mode = 'score_only' | 'prep_all' | 'auto_safe' | 'full_auto';

const MODES: { id: Mode; label: string; desc: string; color: string; icon: string }[] = [
  { id: 'score_only', label: 'Score Only', desc: 'Find and score new jobs. No applications generated.', color: 'border-blue-200 bg-blue-50', icon: '📊' },
  { id: 'prep_all', label: 'Prep Packets', desc: 'Generate application packets for high-scoring jobs. Review before submitting.', color: 'border-indigo-200 bg-indigo-50', icon: '📋' },
  { id: 'auto_safe', label: 'Auto-Apply (Safe)', desc: 'Auto-submit to Greenhouse/Lever where confident (score ≥ 80). Queue the rest for review.', color: 'border-emerald-200 bg-emerald-50', icon: '🚀' },
  { id: 'full_auto', label: 'Full Auto', desc: 'Submit everything above your threshold. Maximum automation.', color: 'border-purple-200 bg-purple-50', icon: '⚡' },
];

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black tabular-nums ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AutomatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>('score_only');
  const [threshold, setThreshold] = useState(70);
  const [maxApplies, setMaxApplies] = useState(10);
  const [doSearch, setDoSearch] = useState(true);
  const [pipeline, setPipeline] = useState<any>(null);
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runStats, setRunStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const auth = await profileAPI.get();
      if (!auth.success) { router.push('/login'); return; }
      const res = await fetch('/api/automate');
      if (res.ok) {
        const data = await res.json();
        setPipeline(data.pipeline);
        setRecentApps(data.recentApplications || []);
      }
      setLoading(false);
    })();
  }, [router]);

  const runAutomation = async () => {
    setRunning(true);
    setRunLog([]);
    setRunStats(null);
    try {
      const res = await fetch('/api/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, threshold, maxApplies, search: doSearch }),
      });
      const data = await res.json();
      setRunLog(data.log || []);
      setRunStats(data.stats);
      // Refresh pipeline stats
      const pipeRes = await fetch('/api/automate');
      if (pipeRes.ok) {
        const pipeData = await pipeRes.json();
        setPipeline(pipeData.pipeline);
        setRecentApps(pipeData.recentApplications || []);
      }
    } catch (err) {
      setRunLog(['❌ Failed to run automation']);
    }
    setRunning(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  const selectedMode = MODES.find(m => m.id === mode)!;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automation Control</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure and run your automated job application pipeline</p>
      </div>

      {/* Pipeline Stats */}
      {pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Jobs Found" value={pipeline.totalJobs} sub="in pipeline" />
          <StatCard label="Scored" value={pipeline.scoredJobs} sub={`${pipeline.totalJobs - pipeline.scoredJobs} unscored`} />
          <StatCard label="High Match" value={pipeline.highMatchJobs} sub="score ≥ 70" color="text-emerald-600" />
          <StatCard label="Applied" value={pipeline.applications} sub="total applications" color="text-indigo-600" />
        </div>
      )}

      {/* Mode Selector */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Automation Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${mode === m.id ? m.color + ' border-current' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{m.icon}</span>
                <span className="font-bold text-slate-900 text-sm">{m.label}</span>
                {mode === m.id && <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">Selected</span>}
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Settings</h2>

        <div className="flex items-center justify-between py-3 border-b border-slate-50">
          <div>
            <p className="text-sm font-semibold text-slate-900">Search for new jobs first</p>
            <p className="text-xs text-slate-400">Pulls from Remotive, The Muse, Adzuna + your Greenhouse/Lever boards</p>
          </div>
          <button onClick={() => setDoSearch(v => !v)}
            className={`w-12 h-6 rounded-full transition-all relative ${doSearch ? '' : 'bg-slate-200'}`}
            style={doSearch ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${doSearch ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Score Threshold: <span className="text-slate-900">{threshold}</span>
            </label>
            <input type="range" min="50" max="95" step="5" value={threshold} onChange={e => setThreshold(+e.target.value)}
              className="w-full accent-emerald-500" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>50 (more jobs)</span>
              <span>95 (best match)</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Max Applications: <span className="text-slate-900">{maxApplies}</span>
            </label>
            <input type="range" min="1" max="20" step="1" value={maxApplies} onChange={e => setMaxApplies(+e.target.value)}
              className="w-full accent-indigo-500" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>1</span>
              <span>20 per run</span>
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <div className="flex items-center gap-4">
        <button onClick={runAutomation} disabled={running}
          className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-60 transition-all"
          style={{ background: running ? '#94a3b8' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: running ? 'none' : '0 4px 20px rgba(16,185,129,0.35)' }}>
          {running ? (
            <><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Running {selectedMode.label}...</>
          ) : (
            <><span>{selectedMode.icon}</span> Run {selectedMode.label}</>
          )}
        </button>
        <p className="text-xs text-slate-400">This will search, score, and {mode === 'score_only' ? 'display results' : 'process up to ' + maxApplies + ' applications'}</p>
      </div>

      {/* Run Log */}
      {runLog.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
          {runLog.map((line, i) => (
            <div key={i} className={`${line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('❌') ? 'text-red-400' : line.startsWith('⚠️') ? 'text-amber-400' : line.startsWith('📊') || line.startsWith('📋') ? 'text-indigo-300' : 'text-slate-300'}`}>
              {line}
            </div>
          ))}
          {runStats && (
            <div className="mt-3 pt-3 border-t border-slate-700 text-slate-400">
              Searched: {runStats.searched} · Scored: {runStats.scored} · Built: {runStats.packetsBuilt} · Submitted: {runStats.submitted} · Queued: {runStats.queued}
            </div>
          )}
        </div>
      )}

      {/* Recent Applications */}
      {recentApps.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Recent Applications</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {recentApps.map((app, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{app.role}</p>
                  <p className="text-slate-500 text-xs">{app.company}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${app.status === 'applied' ? 'bg-emerald-50 text-emerald-700' : app.status === 'prepping' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                    {app.status}
                  </span>
                  <p className="text-slate-400 text-xs mt-0.5">{new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
