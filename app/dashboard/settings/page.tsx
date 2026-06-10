'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Config {
  submitMode: string;
  unknownQuestionMode: string;
  attachCoverLetter: boolean;
  resumeVariant: string;
  minScoreToApply: number;
  minScoreToAutoApply?: number;
  maxAppliesPerRun: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  allowSameCompanyRoles: boolean;
}

const DEFAULTS: Config = {
  submitMode: 'approve_first',
  unknownQuestionMode: 'pause',
  attachCoverLetter: true,
  resumeVariant: 'uploaded',
  minScoreToApply: 50,
  minScoreToAutoApply: 75,
  maxAppliesPerRun: 0,
  minDelaySeconds: 30,
  maxDelaySeconds: 90,
  allowSameCompanyRoles: false,
};

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h2 className="font-black text-slate-900 mb-1">{title}</h2>
      {hint && <p className="text-xs text-slate-400 mb-3">{hint}</p>}
      {children}
    </div>
  );
}

function Radio({ value, current, onChange, label, desc }: { value: string; current: string; onChange: (v: string) => void; label: string; desc: string }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`w-full text-left p-3 rounded-xl border transition mb-2 ${
        current === value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </button>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/settings/auto-apply', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : DEFAULTS))
      .then((c) => setConfig({ ...DEFAULTS, ...c }));
  }, []);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    await fetch('/api/settings/auto-apply', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    setSaving(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Automation Settings</h1>
          <p className="text-sm text-slate-500">Your defaults for how Careeva applies. Change anytime — applies to the next run.</p>
        </div>
        <div className="text-xs font-semibold text-slate-400">
          {saving ? 'Saving…' : savedAt ? 'Saved ✓' : ''}
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Submission mode" hint="What the worker does after filling an application form.">
          <Radio value="approve_first" current={config.submitMode} onChange={(v) => save({ submitMode: v })}
            label="Fill → screenshot → I approve → submit"
            desc="Safest. Every application waits in the Review Queue for one click from you." />
          <Radio value="fill_and_leave" current={config.submitMode} onChange={(v) => save({ submitMode: v })}
            label="Fill and leave for me"
            desc="Worker fills what it can, saves the report + screenshot; you open the form and finish/submit yourself." />
          <Radio value="full_auto" current={config.submitMode} onChange={(v) => save({ submitMode: v })}
            label="Full auto-submit"
            desc="Worker fills and submits without waiting. Quality + score gates still apply." />
        </Section>

        <Section title="Unknown required questions" hint="When a form has a required question the engine can't answer from your profile.">
          <Radio value="pause" current={config.unknownQuestionMode} onChange={(v) => save({ unknownQuestionMode: v })}
            label="Pause that application for review"
            desc="The run continues with other jobs; this one waits for you with the question listed." />
          <Radio value="ai_guess" current={config.unknownQuestionMode} onChange={(v) => save({ unknownQuestionMode: v })}
            label="AI best-guess, flagged"
            desc="AI drafts an answer grounded in your profile; it's flagged in the field report so you can check it." />
        </Section>

        <Section title="Match score gates" hint="Jobs below the apply gate are never processed. Tunable per run too.">
          <div className="flex items-center gap-6">
            <label className="text-sm font-semibold text-slate-700">
              Apply gate
              <input type="number" min={0} max={100} value={config.minScoreToApply}
                onChange={(e) => save({ minScoreToApply: Number(e.target.value) })}
                className="ml-2 w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Auto-submit gate (Safe mode)
              <input type="number" min={0} max={100} value={config.minScoreToAutoApply ?? 75}
                onChange={(e) => save({ minScoreToAutoApply: Number(e.target.value) })}
                className="ml-2 w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm" />
            </label>
          </div>
        </Section>

        <Section title="Volume & pacing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm font-semibold text-slate-700">
              Max applies per run
              <input type="number" min={0} value={config.maxAppliesPerRun}
                onChange={(e) => save({ maxAppliesPerRun: Number(e.target.value) })}
                className="mt-1 block w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
              <span className="text-[10px] font-normal text-slate-400">0 = unlimited</span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Min delay between apps (sec)
              <input type="number" min={5} value={config.minDelaySeconds}
                onChange={(e) => save({ minDelaySeconds: Number(e.target.value) })}
                className="mt-1 block w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Max delay (sec)
              <input type="number" min={5} value={config.maxDelaySeconds}
                onChange={(e) => save({ maxDelaySeconds: Number(e.target.value) })}
                className="mt-1 block w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
            </label>
          </div>
        </Section>

        <Section title="Documents">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 mb-3">
            <input type="checkbox" checked={config.attachCoverLetter}
              onChange={(e) => save({ attachCoverLetter: e.target.checked })} className="w-4 h-4" />
            Attach generated cover letter when the form accepts one
          </label>
          <Radio value="uploaded" current={config.resumeVariant} onChange={(v) => save({ resumeVariant: v })}
            label="Send my uploaded resume file"
            desc="The exact PDF/DOCX you uploaded, every time. Recommended." />
          <Radio value="tailored" current={config.resumeVariant} onChange={(v) => save({ resumeVariant: v })}
            label="AI-tailored per job (coming soon)"
            desc="Per-job tailored resume generation lands in a follow-up — falls back to uploaded for now." />
        </Section>

        <Section title="Duplicate protection" hint="By default Careeva never applies twice to the same company.">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={config.allowSameCompanyRoles}
              onChange={(e) => save({ allowSameCompanyRoles: e.target.checked })} className="w-4 h-4" />
            Allow different roles at a company I've already applied to
            <span className="text-[10px] font-normal text-slate-400">(you'll be notified which application already exists)</span>
          </label>
        </Section>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/dashboard/automation" className="text-sm font-bold text-indigo-600 hover:underline">← Back to Automation</Link>
        <Link href="/dashboard/review" className="text-sm font-bold text-indigo-600 hover:underline">Review Queue →</Link>
      </div>
    </div>
  );
}
