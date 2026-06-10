'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconCheck, IconChevronRight } from '@/components/icons';

interface Config {
  autoApplyEnabled?: boolean;
  submitMode: string;
  unknownQuestionMode: string;
  attachCoverLetter: boolean;
  resumeVariant: string;
  minScoreToApply: number;
  minScoreToAutoApply?: number;
  maxAppliesPerRun: number;
  maxApplicationsPerDay?: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  allowSameCompanyRoles: boolean;
  companyBlacklist?: string[];
  titleBlacklist?: string[];
  titleWhitelist?: string[];
}

const DEFAULTS: Config = {
  autoApplyEnabled: false,
  submitMode: 'approve_first',
  unknownQuestionMode: 'ai_guess',
  attachCoverLetter: true,
  resumeVariant: 'uploaded',
  minScoreToApply: 65,
  minScoreToAutoApply: 75,
  maxAppliesPerRun: 0,
  maxApplicationsPerDay: 5,
  minDelaySeconds: 30,
  maxDelaySeconds: 90,
  allowSameCompanyRoles: false,
  companyBlacklist: [],
  titleBlacklist: [],
  titleWhitelist: [],
};

function ListField({ id, label, help, value, onSave, placeholder }: {
  id: string; label: string; help: string; value: string[]; onSave: (list: string[]) => void; placeholder: string;
}) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text.split(',').map((s) => s.trim()).filter(Boolean))}
      />
      <p className="field-help">{help}</p>
    </div>
  );
}

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="premium-card p-7">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Radio({ value, current, onChange, label, desc }: { value: string; current: string; onChange: (v: string) => void; label: string; desc: string }) {
  const active = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(value)}
      className={`mb-2 w-full rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
        active
          ? 'border-blue-400/40 bg-blue-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        {active && <IconCheck size={14} className="text-blue-300" />}
        {label}
      </span>
      <span className="mt-1 block text-xs text-slate-400">{desc}</span>
    </button>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-white/10'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`}
        />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-200">{label}</span>
        {help && <span className="mt-0.5 block text-xs text-slate-500">{help}</span>}
      </span>
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
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="badge mb-4">Settings</div>
            <h1 className="section-heading">Automation settings</h1>
            <p className="section-subcopy mt-3 max-w-2xl">
              Your defaults for how Careeva applies. Change anytime — updates take effect on the next run.
            </p>
          </div>
          <div aria-live="polite">
            {saving ? (
              <span className="badge">Saving…</span>
            ) : savedAt ? (
              <span className="badge-success">
                <IconCheck size={14} /> Saved
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <Section
          title="Fully-automatic daily runs"
          hint="The master switch. When on, Careeva's scheduled sync also finds, scores, and queues applications for you every run — no button pressing. Your score gate, caps, blacklists, and trust ramp all still apply."
        >
          <Toggle
            checked={config.autoApplyEnabled ?? false}
            onChange={(v) => save({ autoApplyEnabled: v })}
            label="Run the apply engine automatically on every scheduled sync"
            help="Turn off anytime to pause all automatic applying — anything already queued can still be cancelled in Review."
          />
        </Section>

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
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label className="field-label" htmlFor="apply-gate">Apply gate</label>
              <input id="apply-gate" type="number" min={0} max={100} value={config.minScoreToApply}
                onChange={(e) => save({ minScoreToApply: Number(e.target.value) })}
                className="!w-24" />
            </div>
            <div>
              <label className="field-label" htmlFor="auto-gate">Auto-submit gate (Safe mode)</label>
              <input id="auto-gate" type="number" min={0} max={100} value={config.minScoreToAutoApply ?? 75}
                onChange={(e) => save({ minScoreToAutoApply: Number(e.target.value) })}
                className="!w-24" />
            </div>
          </div>
        </Section>

        <Section title="Volume & pacing">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="field-label" htmlFor="max-applies">Max applies per run</label>
              <input id="max-applies" type="number" min={0} value={config.maxAppliesPerRun}
                onChange={(e) => save({ maxAppliesPerRun: Number(e.target.value) })} />
              <p className="field-help">0 = unlimited</p>
            </div>
            <div>
              <label className="field-label" htmlFor="max-daily">Max applications per day</label>
              <input id="max-daily" type="number" min={0} value={config.maxApplicationsPerDay ?? 5}
                onChange={(e) => save({ maxApplicationsPerDay: Number(e.target.value) })} />
              <p className="field-help">Hard daily cap across all runs. 0 = unlimited</p>
            </div>
            <div>
              <label className="field-label" htmlFor="min-delay">Min delay between apps (sec)</label>
              <input id="min-delay" type="number" min={5} value={config.minDelaySeconds}
                onChange={(e) => save({ minDelaySeconds: Number(e.target.value) })} />
            </div>
            <div>
              <label className="field-label" htmlFor="max-delay">Max delay (sec)</label>
              <input id="max-delay" type="number" min={5} value={config.maxDelaySeconds}
                onChange={(e) => save({ maxDelaySeconds: Number(e.target.value) })} />
            </div>
          </div>
        </Section>

        <Section title="Filters" hint="Hard rules the engine always honors — at selection and again at enqueue.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ListField
              id="company-blacklist"
              label="Never apply to these companies"
              help="Comma-separated. Matched anywhere in the company name."
              value={config.companyBlacklist || []}
              onSave={(list) => save({ companyBlacklist: list })}
              placeholder="e.g. Acme Corp, Globex"
            />
            <ListField
              id="title-blacklist"
              label="Never apply to these titles"
              help="Comma-separated. Matched anywhere in the job title."
              value={config.titleBlacklist || []}
              onSave={(list) => save({ titleBlacklist: list })}
              placeholder="e.g. unpaid, commission only"
            />
            <ListField
              id="title-whitelist"
              label="Only apply to titles containing"
              help="Leave empty to allow all titles."
              value={config.titleWhitelist || []}
              onSave={(list) => save({ titleWhitelist: list })}
              placeholder="e.g. analyst, strategy"
            />
          </div>
        </Section>

        <Section title="Documents">
          <div className="mb-3">
            <Toggle
              checked={config.attachCoverLetter}
              onChange={(v) => save({ attachCoverLetter: v })}
              label="Attach generated cover letter when the form accepts one"
            />
          </div>
          <Radio value="uploaded" current={config.resumeVariant} onChange={(v) => save({ resumeVariant: v })}
            label="Send my uploaded resume file"
            desc="The exact PDF/DOCX you uploaded, every time. Recommended." />
          <Radio value="tailored" current={config.resumeVariant} onChange={(v) => save({ resumeVariant: v })}
            label="AI-tailored per job (coming soon)"
            desc="Per-job tailored resume generation lands in a follow-up — falls back to uploaded for now." />
        </Section>

        <Section title="Duplicate protection" hint="By default Careeva never applies twice to the same company.">
          <Toggle
            checked={config.allowSameCompanyRoles}
            onChange={(v) => save({ allowSameCompanyRoles: v })}
            label="Allow different roles at a company I've already applied to"
            help="You'll be notified which application already exists."
          />
        </Section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/automation" className="btn-ghost text-sm">
          <IconChevronRight size={14} className="rotate-180" /> Back to Automation
        </Link>
        <Link href="/dashboard/review" className="btn-ghost text-sm">
          Review Queue <IconArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
