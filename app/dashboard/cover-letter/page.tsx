'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { profileAPI } from '@/lib/api';

interface SavedLetter {
  id: string;
  company: string;
  jobTitle: string;
  date: string;
  content: string;
}

interface LocalDraft {
  company: string;
  jobTitle: string;
  content: string;
  date: string;
}

const toneOptions = [
  { value: 'professional', label: 'Professional', desc: 'Formal, polished, traditional. Great for corporate roles.' },
  { value: 'confident', label: 'Confident', desc: 'Bold and assertive. Shows conviction in your value.' },
  { value: 'conversational', label: 'Conversational', desc: 'Natural and approachable. Works well for startups.' },
  { value: 'creative', label: 'Creative', desc: 'Distinct and memorable. Best for creative/marketing roles.' },
];

const LOCAL_DRAFTS_KEY = 'careeva_cover_letter_drafts';

function loadLocalDrafts(): LocalDraft[] {
  try {
    const stored = localStorage.getItem(LOCAL_DRAFTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLocalDraft(draft: LocalDraft) {
  try {
    const existing = loadLocalDrafts();
    const updated = [draft, ...existing].slice(0, 3);
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export default function CoverLetterPage() {
  return (
    <Suspense fallback={null}>
      <CoverLetterInner />
    </Suspense>
  );
}

function CoverLetterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [jobTitle, setJobTitle] = useState(searchParams.get('jobTitle') || '');
  const [hiringManager, setHiringManager] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [tone, setTone] = useState('professional');
  const [jd, setJd] = useState(searchParams.get('jd') || '');
  const [variation, setVariation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    profileAPI.get().then((result) => {
      if (!result.success) {
        router.push('/login');
        return;
      }
      fetchSavedLetters();
      setLocalDrafts(loadLocalDrafts());
    });
  }, [router]);

  const fetchSavedLetters = async () => {
    try {
      const res = await fetch('/api/writing-samples', { credentials: 'include' });
      if (res.ok) {
        const samples = await res.json();
        const coverLetters = samples.filter((s: any) => s.type === 'cover_letter');
        setSavedLetters(
          coverLetters.map((s: any) => ({
            id: s.id,
            company: s.title?.split(' - ')[0] || 'Saved',
            jobTitle: s.title?.split(' - ')[1] || 'Letter',
            date: new Date(s.createdAt).toLocaleDateString(),
            content: s.content,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to fetch letters:', e);
    }
  };

  const wordCount = letter.trim() ? letter.trim().split(/\s+/).length : 0;

  const generate = async () => {
    if (!company || !jobTitle || !jd) {
      setError('Company, job title, and job description are required.');
      return;
    }

    setLoading(true);
    setError('');
    setLetter('');

    try {
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jd,
          jobTitle,
          company,
          hiringManager,
          candidateName,
          tone,
          variation,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLetter(data.coverLetter);
      // Save to localStorage drafts
      saveLocalDraft({
        company,
        jobTitle,
        content: data.coverLetter,
        date: new Date().toLocaleString(),
      });
      setLocalDrafts(loadLocalDrafts());
    } catch (e: any) {
      setError(e.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${company || 'draft'}-${jobTitle || 'role'}.txt`.replace(/\s+/g, '-').toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const regenerate = async () => {
    setVariation((v) => v + 1);
    await generate();
  };

  const save = async () => {
    if (!letter.trim()) {
      setError('Generate or paste a cover letter before saving.');
      return;
    }

    try {
      const res = await fetch('/api/writing-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${company} - ${jobTitle}`,
          type: 'cover_letter',
          content: letter,
        }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to save cover letter');
      await fetchSavedLetters();
      setSaveMessage('Cover letter saved to your library.');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (e) {
      console.error('Failed to save letter:', e);
      setError('Failed to save cover letter.');
    }
  };

  const loadLetter = (savedLetter: SavedLetter | LocalDraft) => {
    setLetter(savedLetter.content);
    setCompany(savedLetter.company);
    setJobTitle(savedLetter.jobTitle);
    setShowDrafts(false);
  };

  const seedPrompt = (preset: 'analyst' | 'growth' | 'ops') => {
    const presets = {
      analyst: {
        company: 'BridgePoint Capital',
        jobTitle: 'Investment Analyst',
        jd: 'Seeking an analytical candidate with strong financial modeling, market research, stakeholder communication, and deal execution support experience.',
      },
      growth: {
        company: 'Northstar Labs',
        jobTitle: 'Growth Operations Associate',
        jd: 'Looking for someone who can combine analytics, operations, experimentation, and cross-functional execution to accelerate growth initiatives.',
      },
      ops: {
        company: 'CareSpring Health',
        jobTitle: 'Strategic Operations Manager',
        jd: 'Candidate should be comfortable with process design, KPI dashboards, stakeholder management, and using AI or automation to improve execution.',
      },
    };

    const next = presets[preset];
    setCompany(next.company);
    setJobTitle(next.jobTitle);
    setJd(next.jd);
  };

  const selectedTone = toneOptions.find(t => t.value === tone);

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div>
            <div className="badge mb-4">Writing workflow</div>
            <h1 className="section-heading text-4xl md:text-5xl">Generate cover letters that actually feel tailored.</h1>
            <p className="section-subcopy mt-4 text-base md:text-lg">
              Turn a job description into a polished draft, then save, reuse, and refine it without breaking flow.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button onClick={() => seedPrompt('analyst')} className="btn-secondary !py-3 !px-4 text-sm">Analyst</button>
            <button onClick={() => seedPrompt('growth')} className="btn-secondary !py-3 !px-4 text-sm">Growth Ops</button>
            <button onClick={() => seedPrompt('ops')} className="btn-secondary !py-3 !px-4 text-sm">Strategy Ops</button>
          </div>
        </div>
      </section>

      {error && <div className="premium-card border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
      {saveMessage && <div className="premium-card border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{saveMessage}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="premium-card p-6 md:p-8 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Company *</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" />
            </div>
            <div>
              <label className="field-label">Job title *</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Analyst" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Your name</label>
              <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="field-label">Hiring manager</label>
              <input value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="field-label">Tone</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTone(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all ${tone === option.value ? 'border-blue-400/40 bg-blue-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]'}`}
                >
                  <span className="font-semibold block">{option.label}</span>
                  {tone === option.value && <span className="text-xs text-slate-400 mt-0.5 block">{option.desc}</span>}
                </button>
              ))}
            </div>
            {selectedTone && tone !== 'professional' && (
              <p className="text-xs text-slate-500 mt-2">{selectedTone.desc}</p>
            )}
          </div>

          <div>
            <label className="field-label">Job description * <span className="text-slate-500 font-normal normal-case tracking-normal">({jd.length} chars)</span></label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={12} placeholder="Paste the job description here..." />
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={generate} disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Writing with AI...' : 'Generate cover letter'}
            </button>
            <button onClick={() => { setCompany(''); setJobTitle(''); setHiringManager(''); setJd(''); setLetter(''); setError(''); }} className="btn-secondary">
              Reset
            </button>
          </div>
        </div>

        <div className="premium-card p-6 md:p-8">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Draft output</div>
              <h2 className="mt-2 text-2xl font-bold text-white">Cover letter preview</h2>
              {letter && <p className="text-xs text-slate-500 mt-0.5">{wordCount} words</p>}
            </div>
            {letter && (
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="btn-primary !px-4 !py-2 text-sm">{copied ? '✅ Copied' : '📋 Copy'}</button>
                <button onClick={regenerate} disabled={loading} className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-50">Regenerate</button>
                <button onClick={download} className="btn-secondary !px-4 !py-2 text-sm">⬇ Download .txt</button>
                <button onClick={save} className="btn-secondary !px-4 !py-2 text-sm">Save</button>
              </div>
            )}
          </div>

          {/* Previous drafts */}
          {localDrafts.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowDrafts(v => !v)}
                className="text-xs text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors">
                {showDrafts ? '▼' : '▶'} Previous drafts ({localDrafts.length})
              </button>
              {showDrafts && (
                <div className="mt-2 space-y-1.5">
                  {localDrafts.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-xs font-semibold text-white">{d.jobTitle}</span>
                        <span className="text-xs text-slate-400 ml-2">@ {d.company}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{d.date}</span>
                      </div>
                      <button onClick={() => loadLetter(d)}
                        className="text-xs px-2 py-1 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 font-semibold transition-all">
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={20}
            placeholder="Your tailored cover letter will appear here..."
            className="min-h-[420px] leading-7"
          />

          {!letter && (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
              Tip: the best drafts come from pasting the full job description and keeping your target role details specific.
            </div>
          )}
        </div>
      </section>

      {savedLetters.length > 0 && (
        <section className="premium-card p-6 md:p-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Saved drafts</h2>
              <p className="mt-1 text-sm text-slate-400">Reload a prior letter, use it as a starting point, and iterate faster.</p>
            </div>
            <div className="badge">{savedLetters.length} saved</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {savedLetters.map((saved) => (
              <div key={saved.id} className="premium-card-soft p-5">
                <div className="text-lg font-semibold text-white">{saved.jobTitle}</div>
                <div className="mt-1 text-sm text-slate-300">{saved.company}</div>
                <div className="mt-2 text-xs text-slate-500">Saved {saved.date}</div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{saved.content}</p>
                <button onClick={() => loadLetter(saved)} className="btn-secondary mt-4 !px-4 !py-2 text-sm">
                  Load draft
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
