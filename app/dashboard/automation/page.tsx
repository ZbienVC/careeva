'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { profileAPI } from '@/lib/api';

type Mode = 'score_only' | 'prep_all' | 'auto_safe' | 'full_auto';

const MODES: { id: Mode; label: string; tagline: string; icon: string; risk: 'low' | 'medium' | 'high' }[] = [
  { id: 'score_only',  label: 'Find & Score',    tagline: 'Discover jobs, score them. No applications yet.',          icon: '🔍', risk: 'low'    },
  { id: 'prep_all',   label: 'Prepare Packets',  tagline: 'Generate cover letters + answers. Review before sending.', icon: '📄', risk: 'low'    },
  { id: 'auto_safe',  label: 'Auto-Apply (Safe)', tagline: 'Submit where confident (score ≥ 80 + quality gate). Queue rest.', icon: '⚡', risk: 'medium' },
  { id: 'full_auto',  label: 'Full Auto',         tagline: 'Submit everything above threshold automatically.',          icon: '🚀', risk: 'high'   },
];

function PipelineCard({ label, value, sub, color, icon }: { label: string; value: number | string; sub?: string; color?: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-slate-50 flex-shrink-0">{icon}</div>
      <div>
        <p className={`text-2xl font-black tabular-nums leading-none ${color || 'text-slate-900'}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

type LogLine = { text: string; type: 'success' | 'error' | 'info' | 'warn' | 'header' };

function classifyLog(line: string): LogLine['type'] {
  const l = line.toLowerCase();
  if (l.includes('submitted') || l.includes('complete') || l.includes('scored') || l.startsWith('board sync complete')) return 'success';
  if (l.includes('error') || l.includes('failed') || l.includes('unauthorized')) return 'error';
  if (l.includes('queued') || l.includes('missing') || l.includes('deactivated') || l.includes('stale') || l.includes('warning')) return 'warn';
  if (l.includes('syncing') || l.includes('searching') || l.includes('summary') || l.includes('run summary')) return 'header';
  return 'info';
}

const LOG_COLORS: Record<LogLine['type'], string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warn: 'text-amber-300',
  header: 'text-indigo-300 font-bold',
  info: 'text-slate-300',
};

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
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [runStats, setRunStats] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lastRan, setLastRan] = useState<string | null>(null);

  const loadPipeline = async () => {
    const res = await fetch('/api/automate');
    if (res.ok) {
      const data = await res.json();
      setPipeline(data.pipeline);
      setRecentApps(data.recentApplications || []);
    }
  };

  useEffect(() => {
    (async () => {
      const auth = await profileAPI.get();
      if (!auth.success) { router.push('/login'); return; }
      await loadPipeline();
      setLoading(false);
    })();
  }, [router]);

  const runAutomation = async () => {
    setRunning(true);
    setLogLines([]);
    setRunStats(null);
    try {
      const res = await fetch('/api/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, threshold, maxApplies, search: doSearch }),
      });
      const data = await res.json();
      const lines: LogLine[] = (data.log || []).map((l: string) => ({ text: l, type: classifyLog(l) }));
      setLogLines(lines);
      setRunStats(data.stats);
      setLastRan(new Date().toLocaleTimeString());
      await loadPipeline();
    } catch {
      setLogLines([{ text: '❌ Failed to run automation', type: 'error' }]);
    }
    setRunning(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading pipeline…</div>;

  const selectedMode = MODES.find(m => m.id === mode)!;
  const readyToRun = pipeline?.highMatchJobs > 0 || pipeline?.totalJobs > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Application Engine</h1>
          <p className="text-slate-400 text-sm mt-0.5">AI-powered · quality-gated · automated</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/applications/patterns" target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-purple-600 hover:text-purple-800 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 transition-all">
            📊 Patterns
          </a>
          <Link href="/dashboard/profile"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-all">
            Edit Profile →
          </Link>
        </div>
      </div>

      {/* Pipeline stats */}
      {pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PipelineCard label="Jobs Found" value={pipeline.totalJobs} sub="in pipeline" icon="📋" />
          <PipelineCard label="High Match" value={pipeline.highMatchJobs} sub={`score ≥ ${threshold}`} color="text-emerald-600" icon="⭐" />
          <PipelineCard label="Applied" value={pipeline.applications} sub="total sent" color="text-indigo-600" icon="✅" />
          <PipelineCard label="Scored" value={pipeline.scoredJobs} sub={`of ${pipeline.totalJobs}`} icon="📊" />
        </div>
      )}

      {/* No jobs yet nudge */}
      {pipeline && pipeline.totalJobs === 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-2xl mt-0.5">💡</span>
          <div>
            <p className="text-sm font-semibold text-indigo-800">No jobs in pipeline yet</p>
            <p className="text-xs text-indigo-600 mt-0.5">Run <strong>Find & Score</strong> to pull jobs from 8+ job boards based on your target titles.</p>
            <p className="text-xs text-indigo-500 mt-1">Make sure your target job titles are set in <Link href="/dashboard/profile" className="underline">Profile → Job Preferences</Link>.</p>
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">What do you want to do?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                mode === m.id
                  ? m.risk === 'high' ? 'border-purple-400 bg-purple-50' : m.risk === 'medium' ? 'border-emerald-400 bg-emerald-50' : 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{m.icon}</span>
                <span className="font-bold text-slate-900 text-sm">{m.label}</span>
                {mode === m.id && (
                  <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-white">SELECTED</span>
                )}
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">{m.tagline}</p>
              {m.risk !== 'low' && (
                <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  m.risk === 'high' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {m.risk === 'high' ? '⚡ Full automation' : '🛡️ Quality-gated'}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quality note */}
      {(mode === 'auto_safe' || mode === 'full_auto') && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-base mt-0.5">🛡️</span>
          <div>
            <p className="text-xs font-bold text-slate-700">Quality gate active</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Every cover letter is scored 0–100 before submission. Anything below 65 is queued for your review instead of auto-submitted. Cover letters are archetype-aware and keyword-injected from the actual JD.
            </p>
          </div>
        </div>
      )}

      {/* Advanced settings toggle */}
      <div>
        <button onClick={() => setShowSettings(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
          <span className={`transition-transform ${showSettings ? 'rotate-90' : ''}`}>▶</span>
          Advanced settings
        </button>
        {showSettings && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">Search for new jobs first</p>
                <p className="text-xs text-slate-400 mt-0.5">Pulls from Remotive, The Muse, Adzuna, Wellfound + more</p>
              </div>
              <button onClick={() => setDoSearch(v => !v)}
                className={`w-11 h-6 rounded-full transition-all relative ${doSearch ? '' : 'bg-slate-200'}`}
                style={doSearch ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${doSearch ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Score threshold: <span className="text-slate-900 normal-case font-black">{threshold}</span>
                </label>
                <input type="range" min="50" max="95" step="5" value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>50 (more)</span><span>95 (best match)</span></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Max applications: <span className="text-slate-900 normal-case font-black">{maxApplies}</span>
                </label>
                <input type="range" min="1" max="20" step="1" value={maxApplies} onChange={e => setMaxApplies(+e.target.value)} className="w-full accent-indigo-500" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1</span><span>20/run</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="flex items-center gap-4">
        <button onClick={runAutomation} disabled={running}
          className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-60 transition-all active:scale-[0.98]"
          style={{
            background: running ? '#94a3b8' : selectedMode.risk === 'high' ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : selectedMode.risk === 'medium' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
            boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
          }}>
          {running ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running…</>
          ) : (
            <><span>{selectedMode.icon}</span> {selectedMode.label}</>
          )}
        </button>
        {lastRan && !running && (
          <p className="text-xs text-slate-400">Last ran at {lastRan}</p>
        )}
      </div>

      {/* Run log */}
      {logLines.length > 0 && (
        <div className="bg-slate-950 rounded-2xl p-5 font-mono text-xs space-y-1 max-h-80 overflow-y-auto border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Run log</p>
            {runStats && (
              <div className="flex gap-3 text-[10px]">
                {runStats.submitted > 0 && <span className="text-emerald-400 font-bold">✓ {runStats.submitted} submitted</span>}
                {runStats.queued > 0 && <span className="text-amber-400">📋 {runStats.queued} queued</span>}
                {runStats.scored > 0 && <span className="text-indigo-300">📊 {runStats.scored} scored</span>}
                {runStats.errors > 0 && <span className="text-red-400">✗ {runStats.errors} errors</span>}
              </div>
            )}
          </div>
          {logLines.map((line, i) => (
            <div key={i} className={LOG_COLORS[line.type]}>{line.text}</div>
          ))}
        </div>
      )}

      {/* Recent applications */}
      {recentApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Applications</p>
            <Link href="/dashboard/applications" className="text-xs text-indigo-600 font-semibold hover:text-indigo-800">View all →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {recentApps.map((app, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                  {app.company.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{app.role}</p>
                  <p className="text-slate-400 text-xs">{app.company}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    app.status === 'applied' ? 'bg-emerald-50 text-emerald-700' :
                    app.status === 'prepping' ? 'bg-indigo-50 text-indigo-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {app.status}
                  </span>
                  <p className="text-slate-400 text-[10px] mt-1">{new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
