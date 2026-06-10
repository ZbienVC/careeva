'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { profileAPI } from '@/lib/api';
import {
  IconBarChart,
  IconClipboardCheck,
  IconCheck,
  IconCheckCircle,
  IconBot,
  IconAlertTriangle,
  IconTarget,
  IconStar,
  IconCopy,
  IconChevronRight,
  IconArrowRight,
} from '@/components/icons';

type Mode = 'score_only' | 'prep_all' | 'auto_safe' | 'full_auto';

const MODES: { id: Mode; label: string; tagline: string; icon: typeof IconBarChart; risk: 'low' | 'medium' | 'high'; recommended?: boolean }[] = [
  { id: 'score_only',  label: 'Find & Score',     tagline: 'Discover jobs, score them. No applications yet.',           icon: IconBarChart, risk: 'low'    },
  { id: 'prep_all',   label: 'Prepare Packets',   tagline: 'Generate cover letters + answers. Review before sending.',  icon: IconClipboardCheck, risk: 'low',   recommended: true },
  { id: 'auto_safe',  label: 'Auto-Apply (Safe)', tagline: 'Submit where confident (score ≥ 80 + quality gate). Queue rest.', icon: IconCheckCircle, risk: 'medium' },
  { id: 'full_auto',  label: 'Full Auto',          tagline: 'Submit everything above threshold automatically.',           icon: IconBot, risk: 'high'   },
];

interface RunHistoryEntry {
  date: string;
  mode: Mode;
  submitted: number;
  scored: number;
  errors: number;
}

function PipelineCard({ label, value, sub, color, icon: Icon, href }: { label: string; value: number | string; sub?: string; color?: string; icon: typeof IconBarChart; href?: string }) {
  const inner = (
    <div className={`stat-tile flex items-center gap-4 transition-all ${href ? 'cursor-pointer hover:border-blue-400/30 hover:bg-white/[0.05]' : ''}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300">
        <Icon size={18} />
      </div>
      <div>
        <p className={`text-3xl font-bold tabular-nums leading-none ${color || 'text-white'}`}>{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
        {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}


function CompletenessBanner() {
  const [data, setData] = useState<{ readyToAutoApply: boolean; percentComplete: number; missingRequired: string[] } | null>(null);
  const [seeding, setSeeding] = useState(false);
  useEffect(() => {
    fetch('/api/profile/completeness', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);
  const seed = async () => {
    setSeeding(true);
    await fetch('/api/job-preferences/seed', { method: 'POST', credentials: 'include' });
    setSeeding(false);
    window.location.reload();
  };
  if (!data) return null;
  if (data.readyToAutoApply) {
    return (
      <div className="alert-success flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 font-semibold">
          <IconCheckCircle size={16} className="flex-shrink-0 text-emerald-300" />
          Profile complete ({data.percentComplete}%) — ready to auto-apply
        </span>
        <span className="flex flex-shrink-0 gap-3">
          <Link href="/dashboard/review" className="font-semibold text-emerald-200 underline underline-offset-2 hover:text-emerald-100">Review Queue</Link>
          <Link href="/dashboard/settings" className="font-semibold text-emerald-200 underline underline-offset-2 hover:text-emerald-100">Settings</Link>
        </span>
      </div>
    );
  }
  return (
    <div className="alert-warning">
      <p className="flex items-center gap-2 font-bold">
        <IconAlertTriangle size={16} className="flex-shrink-0 text-amber-300" />
        Profile {data.percentComplete}% complete — auto-apply is blocked until these are set:
      </p>
      <p className="mt-1 text-amber-200/80">{data.missingRequired.join(' · ')}</p>
      <div className="mt-3 flex gap-4">
        <Link href="/dashboard/profile" className="inline-flex items-center gap-1 font-bold text-amber-200 underline underline-offset-2 hover:text-amber-100">
          Complete profile <IconArrowRight size={14} />
        </Link>
        <button onClick={seed} disabled={seeding} className="font-bold text-amber-200 underline underline-offset-2 hover:text-amber-100 disabled:opacity-50">
          {seeding ? 'Seeding…' : 'Seed starter job preferences'}
        </button>
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
  header: 'text-blue-300 font-bold',
  info: 'text-slate-300',
};

const MODE_LABELS: Record<Mode, string> = {
  score_only: 'Find & Score',
  prep_all: 'Prepare Packets',
  auto_safe: 'Auto-Apply Safe',
  full_auto: 'Full Auto',
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
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [logCopied, setLogCopied] = useState(false);
  const [showFullAutoWarning, setShowFullAutoWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadPipeline = async () => {
    const res = await fetch('/api/automate');
    if (res.ok) {
      const data = await res.json();
      setPipeline(data.pipeline);
      setRecentApps(data.recentApplications || []);
      setLastSynced(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    (async () => {
      const auth = await profileAPI.get();
      if (!auth.success) { router.push('/login'); return; }
      await loadPipeline();
      // Load run history from localStorage
      try {
        const stored = localStorage.getItem('careeva_run_history');
        if (stored) setRunHistory(JSON.parse(stored));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [router]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logLines.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines]);

  const selectMode = (m: Mode) => {
    if (m === 'full_auto') {
      setPendingMode(m);
      setShowFullAutoWarning(true);
    } else {
      setMode(m);
    }
  };

  const confirmFullAuto = () => {
    if (pendingMode) setMode(pendingMode);
    setShowFullAutoWarning(false);
    setPendingMode(null);
  };

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
      const now = new Date().toLocaleTimeString();
      setLastRan(now);
      await loadPipeline();
      // Save run to history
      const entry: RunHistoryEntry = {
        date: new Date().toLocaleString(),
        mode,
        submitted: data.stats?.submitted || 0,
        scored: data.stats?.scored || 0,
        errors: data.stats?.errors || 0,
      };
      setRunHistory(prev => {
        const updated = [entry, ...prev].slice(0, 5);
        try { localStorage.setItem('careeva_run_history', JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
    } catch {
      setLogLines([{ text: 'Failed to run automation', type: 'error' }]);
    }
    setRunning(false);
  };

  const copyLog = async () => {
    const text = logLines.map(l => l.text).join('\n');
    await navigator.clipboard.writeText(text);
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading pipeline…</div>;

  const selectedMode = MODES.find(m => m.id === mode)!;
  const SelectedIcon = selectedMode.icon;
  const runBtnBg = running ? 'rgba(116,97,74,0.8)'
    : selectedMode.risk === 'high' ? 'linear-gradient(135deg,#91471d,#683012)'
    : selectedMode.risk === 'medium' ? 'linear-gradient(135deg,#b97f24,#9a6a1e)'
    : 'linear-gradient(135deg,#c0501f,#a63d17)';

  return (
    <div className="page-shell space-y-8">
      <div className="mx-auto max-w-3xl space-y-8">
      <CompletenessBanner />

      {/* Full Auto Warning Modal */}
      {showFullAutoWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-sm space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
                <IconAlertTriangle size={20} />
              </div>
              <h2 className="text-lg font-bold text-white">Full Automation Warning</h2>
            </div>
            <p className="text-sm text-slate-300">This will <strong className="text-white">automatically submit applications</strong> without manual review. Make sure your profile and preferences are fully set up before proceeding.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowFullAutoWarning(false); setPendingMode(null); }}
                className="btn-secondary flex-1 text-sm !px-4 !py-2.5">
                Cancel
              </button>
              <button onClick={confirmFullAuto}
                className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-paper transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                style={{ background: 'linear-gradient(135deg,#91471d,#683012)' }}>
                Yes, enable Full Auto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="badge mb-4">Step 3 of 5 · Automation</div>
            <h1 className="section-heading text-4xl">Put your applications on autopilot.</h1>
            <p className="section-subcopy mt-4">AI-powered, quality-gated automation — from job discovery to submitted application.</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <a href="/api/applications/patterns" target="_blank" rel="noopener noreferrer"
              className="btn-ghost text-sm !px-4 !py-2">
              <IconBarChart size={14} /> Patterns
            </a>
            <Link href="/dashboard/profile" className="btn-secondary text-sm !px-4 !py-2">
              Edit Profile <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Pipeline stats */}
      {pipeline && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PipelineCard label="Jobs Found" value={pipeline.totalJobs} sub="in pipeline" icon={IconBarChart} href="/dashboard/jobs" />
            <PipelineCard label="High Match" value={pipeline.highMatchJobs} sub={`score ≥ ${threshold}`} color="text-emerald-300" icon={IconTarget} href="/dashboard/jobs" />
            <PipelineCard label="Applied" value={pipeline.applications} sub="total sent" color="text-blue-300" icon={IconCheckCircle} href="/dashboard/applications" />
            <PipelineCard label="Scored" value={pipeline.scoredJobs} sub={`of ${pipeline.totalJobs}`} icon={IconStar} />
          </div>
          {lastSynced && (
            <p className="mt-2 text-right text-[10px] text-slate-500">Last synced: {lastSynced}</p>
          )}
        </div>
      )}

      {/* No jobs yet nudge */}
      {pipeline && pipeline.totalJobs === 0 && (
        <div className="alert-info flex items-start gap-3 !p-5">
          <IconClipboardCheck size={20} className="mt-0.5 flex-shrink-0 text-blue-300" />
          <div>
            <p className="text-sm font-semibold text-blue-100">No jobs in pipeline yet</p>
            <p className="mt-0.5 text-xs text-blue-200/80">Run <strong className="text-blue-100">Find &amp; Score</strong> to pull jobs from 8+ job boards based on your target titles.</p>
            <p className="mt-1 text-xs text-blue-200/60">Make sure your target job titles are set in <Link href="/dashboard/profile" className="underline underline-offset-2 hover:text-blue-100">Profile → Job Preferences</Link>.</p>
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">What do you want to do?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map(m => (
            <button key={m.id} onClick={() => selectMode(m.id)}
              className={`rounded-2xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                mode === m.id
                  ? m.risk === 'high' ? 'border-violet-400/40 bg-violet-500/10' : m.risk === 'medium' ? 'border-amber-400/40 bg-amber-500/10' : 'border-blue-400/40 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}>
              <div className="mb-1 flex items-center gap-2">
                <span className={mode === m.id ? (m.risk === 'high' ? 'text-violet-300' : m.risk === 'medium' ? 'text-amber-300' : 'text-blue-300') : 'text-slate-400'}>
                  <m.icon size={18} />
                </span>
                <span className="text-sm font-bold text-white">{m.label}</span>
                <div className="ml-auto flex items-center gap-1">
                  {m.recommended && (
                    <span className="badge-success !px-2 !py-0.5 !text-[9px] font-black">RECOMMENDED</span>
                  )}
                  {mode === m.id && (
                    <span className="badge bg-white !px-2 !py-0.5 !text-[9px] font-black text-slate-950">SELECTED</span>
                  )}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">{m.tagline}</p>
              {m.risk !== 'low' && (
                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  m.risk === 'high' ? 'bg-violet-500/15 text-violet-300' : 'bg-amber-500/15 text-amber-300'
                }`}>
                  {m.risk === 'high' ? <><IconBot size={11} /> Full automation</> : <><IconAlertTriangle size={11} /> Quality-gated</>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quality note */}
      {(mode === 'auto_safe' || mode === 'full_auto') && (
        <div className="premium-card-soft flex items-start gap-3 px-4 py-3">
          <IconBot size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-300">Quality gate active</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Every cover letter is scored 0-100 before submission. Anything below 65 is queued for your review instead of auto-submitted. Cover letters are archetype-aware and keyword-injected from the actual JD.
            </p>
          </div>
        </div>
      )}

      {/* Advanced settings toggle */}
      <div>
        <button onClick={() => setShowSettings(v => !v)}
          className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 rounded-lg">
          <IconChevronRight size={14} className={`transition-transform ${showSettings ? 'rotate-90' : ''}`} />
          Advanced settings
        </button>
        {showSettings && (
          <div className="premium-card-soft mt-3 space-y-5 p-5">
            <div className="flex items-center justify-between border-b border-white/10 py-2 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Search for new jobs first</p>
                <p className="mt-0.5 text-xs text-slate-500">Pulls from Remotive, The Muse, Adzuna, Wellfound + more</p>
              </div>
              <button onClick={() => setDoSearch(v => !v)}
                aria-pressed={doSearch}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${doSearch ? '' : 'bg-ink/15'}`}
                style={doSearch ? { background: 'linear-gradient(135deg,#5f8a45,#4f7539)' } : {}}>
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-paper shadow transition-transform ${doSearch ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="field-label !text-xs font-bold uppercase tracking-wider !text-slate-400">
                  Score threshold: <span className="normal-case font-black text-white">{threshold}</span>
                </label>
                <input type="range" min="50" max="95" step="5" value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-full accent-emerald-500" />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>50 (more)</span><span>95 (best match)</span></div>
              </div>
              <div>
                <label className="field-label !text-xs font-bold uppercase tracking-wider !text-slate-400">
                  Max applications: <span className="normal-case font-black text-white">{maxApplies}</span>
                </label>
                <input type="range" min="1" max="20" step="1" value={maxApplies} onChange={e => setMaxApplies(+e.target.value)} className="w-full accent-blue-500" />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>1</span><span>20/run</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="flex items-center gap-4">
        <button onClick={runAutomation} disabled={running}
          className="flex min-h-[48px] items-center gap-2.5 rounded-2xl px-7 py-3.5 text-sm font-bold text-paper transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          style={{
            background: runBtnBg,
            boxShadow: running ? 'none' : '0 4px 20px rgba(166,61,23,0.3)',
          }}>
          {running ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" /> Running…</>
          ) : (
            <><SelectedIcon size={16} /> {selectedMode.label}</>
          )}
        </button>
        {lastRan && !running && (
          <p className="text-xs text-slate-500">Last ran at {lastRan}</p>
        )}
      </div>

      {/* Run history */}
      {runHistory.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Run History</p>
          <div className="space-y-1.5">
            {runHistory.map((h, i) => (
              <div key={i} className="premium-card-soft flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className="flex-shrink-0 tabular-nums text-slate-500">{h.date}</span>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  h.mode === 'full_auto' ? 'bg-violet-500/15 text-violet-300' :
                  h.mode === 'auto_safe' ? 'bg-amber-500/15 text-amber-300' :
                  'bg-blue-500/15 text-blue-300'
                }`}>{MODE_LABELS[h.mode]}</span>
                <span className="text-slate-400">{h.scored} scored</span>
                {h.submitted > 0 && <span className="font-semibold text-emerald-300">{h.submitted} submitted</span>}
                {h.errors > 0 && <span className="text-red-300">{h.errors} errors</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run log */}
      {logLines.length > 0 && (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 font-mono text-xs">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Run log</p>
            <button onClick={copyLog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-all hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50">
              {logCopied ? <><IconCheck size={14} /> Copied</> : <><IconCopy size={14} /> Copy log</>}
            </button>
          </div>
          {/* Log legend */}
          <div className="mb-2 flex gap-3 border-b border-white/10 pb-2">
            <span className="text-[10px] text-emerald-400">Success</span>
            <span className="text-[10px] text-amber-300">Warning</span>
            <span className="text-[10px] text-red-400">Error</span>
          </div>
          {runStats && (
            <div className="mb-2 flex gap-3 border-b border-white/10 pb-2 text-[10px]">
              {runStats.submitted > 0 && <span className="font-bold text-emerald-400">{runStats.submitted} submitted</span>}
              {runStats.queued > 0 && <span className="text-amber-300">{runStats.queued} queued</span>}
              {runStats.scored > 0 && <span className="text-blue-300">{runStats.scored} scored</span>}
              {runStats.errors > 0 && <span className="text-red-400">{runStats.errors} errors</span>}
            </div>
          )}
          {logLines.map((line, i) => (
            <div key={i} className={LOG_COLORS[line.type]}>{line.text}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Recent applications */}
      {recentApps.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Applications</p>
            <Link href="/dashboard/applications" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200">
              View all <IconArrowRight size={12} />
            </Link>
          </div>
          <div className="premium-card-soft divide-y divide-white/5 overflow-hidden">
            {recentApps.map((app, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-bold text-slate-300">
                  {app.company.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{app.role}</p>
                  <p className="text-xs text-slate-500">{app.company}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    app.status === 'applied' ? 'bg-emerald-500/15 text-emerald-300' :
                    app.status === 'prepping' ? 'bg-blue-500/15 text-blue-300' :
                    'bg-white/[0.06] text-slate-400'
                  }`}>
                    {app.status}
                  </span>
                  <p className="mt-1 text-[10px] text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
