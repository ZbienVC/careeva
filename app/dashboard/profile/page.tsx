'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingPage } from '@/components/Loading';

// ─── Section components ───────────────────────────────────────────────────────

function Section({ title, subtitle, icon, children, completeness }: {
  title: string; subtitle: string; icon: string; children: React.ReactNode; completeness?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>
        {completeness !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${completeness}%`, background: completeness >= 80 ? '#10b981' : completeness >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <span className="text-xs font-bold text-slate-400">{completeness}%</span>
          </div>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all bg-white" />
    </div>
  );
}

function MonthYearPicker({ label, value, onChange, required = false }: any) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 45 }, (_, i) => currentYear - i);
  const parts = value ? value.substring(0,7).split('-') : ['',''];
  const [yr, mo] = [parts[0] || '', parts[1] || ''];
  const sel = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all bg-white cursor-pointer';
  const update = (newYr: string, newMo: string) => {
    if (newYr && newMo) onChange(newYr + '-' + newMo + '-01');
    else onChange('');
  };
  return (
    <div>
      <label className='block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5'>
        {label}{required && <span className='text-red-400 ml-1'>*</span>}
      </label>
      <div className='flex gap-2'>
        <select value={mo} onChange={e => update(yr, e.target.value)} className={sel}>
          <option value=''>Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        <select value={yr} onChange={e => update(e.target.value, mo)} className={sel}>
          <option value=''>Year</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}


function TextArea({ label, value, onChange, placeholder = '', rows = 3 }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all bg-white resize-none" />
    </div>
  );
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all"
      style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
      {saving ? 'Saving...' : 'Save Changes'}
    </button>
  );
}

// ─── Main Profile Builder ─────────────────────────────────────────────────────

export default function ProfileBuilderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Personal info
  const [personal, setPersonal] = useState<any>({});
  // Work history
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [newWork, setNewWork] = useState<any>({ company: '', title: '', startDate: '', endDate: '', isCurrent: false, summary: '', skills: '', technologies: '' });
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  // Education
  const [education, setEducation] = useState<any[]>([]);
  const [newEdu, setNewEdu] = useState<any>({ institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', isCurrent: false });
  // Skills
  const [skills, setSkills] = useState<any[]>([]);
  const [skillInput, setSkillInput] = useState('');
  // Job preferences
  const [prefs, setPrefs] = useState<any>({});
  // Writing style
  const [writing, setWriting] = useState<any>({});
  // Answers bank
  const [answers, setAnswers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [piRes, whRes, eduRes, skillsRes, prefsRes, answersRes] = await Promise.all([
          fetch('/api/personal-info').then(r => r.json()),
          fetch('/api/work-history').then(r => r.json()),
          fetch('/api/education').then(r => r.json()),
          fetch('/api/skills').then(r => r.json()),
          fetch('/api/job-preferences').then(r => r.json()),
          fetch('/api/answers').then(r => r.json()),
        ]);
        setPersonal(piRes.info || {});
        setWorkHistory(whRes.workHistory || []);
        setEducation(eduRes.entries || []);
        setSkills(skillsRes.skills || []);
        setPrefs(prefsRes.prefs || {});
        setAnswers(answersRes.answers || []);
      } catch {
        // first load
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = useCallback(async (key: string, url: string, data: any) => {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
    } catch { /* handle */ }
    setSaving(s => ({ ...s, [key]: false }));
  }, []);

  const parseFromResume = async () => {
    setParsing(true);
    setParseMsg('');
    try {
      const profileRes = await fetch('/api/profile/full', { credentials: 'include' });
      const profile = profileRes.ok ? await profileRes.json() : null;

      // Use structured workHistory already saved to DB from resume upload
      const savedWorkHistory: any[] = profile?.workHistory || [];
      const savedEducation: any[] = profile?.education || [];
      const userProfile = profile?.userProfile;

      if (savedWorkHistory.length === 0 && savedEducation.length === 0 && !userProfile?.roles?.length) {
        setParseMsg('No resume data found. Upload your resume first (Resume step), then come back to import.');
        return;
      }

      let imported = 0;

      // Import all work history positions not already shown
      for (const wh of savedWorkHistory) {
        if (!wh.company || !wh.title) continue;
        // Check if already in local state
        const alreadyHave = workHistory.some(
          (w: any) => w.company?.toLowerCase() === wh.company?.toLowerCase() &&
                      w.title?.toLowerCase() === wh.title?.toLowerCase()
        );
        if (alreadyHave) continue;
        // These are already in DB (saved by upload route) — just refresh local state
        imported++;
      }

      // If work history is in DB, just reload it
      if (savedWorkHistory.length > 0) {
        setWorkHistory(savedWorkHistory);
        imported += savedWorkHistory.length;
      }

      // Import education
      if (savedEducation.length > 0) {
        setEducation(savedEducation);
        imported += savedEducation.length;
      }

      // Pre-fill newWork form with first role if work history is empty
      if (savedWorkHistory.length === 0 && userProfile?.roles?.length > 0) {
        setNewWork((w: any) => ({ ...w, title: userProfile.roles[0] || '' }));
        setParseMsg('Job title pre-filled. Fill in details and click + Add Position for each role.');
        return;
      }

      if (imported > 0) {
        setParseMsg('✓ Imported ' + savedWorkHistory.length + ' position(s) and ' + savedEducation.length + ' education entry/entries from your resume. Review and edit anything that looks wrong.');
      } else {
        setParseMsg('All resume data is already loaded. Edit any field directly to make corrections.');
      }
    } catch {
      setParseMsg('Could not read resume data. Please fill in manually.');
    } finally {
      setParsing(false);
    }
  };

  const addWork = async () => {
    if (!newWork.company || !newWork.title) return;
    await fetch('/api/work-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newWork,
        skills: newWork.skills.split(',').map((s: string) => s.trim()).filter(Boolean),
        technologies: newWork.technologies.split(',').map((s: string) => s.trim()).filter(Boolean),
      }),
    });
    const res = await fetch('/api/work-history').then(r => r.json());
    setWorkHistory(res.workHistory || []);
    setNewWork({ company: '', title: '', startDate: '', endDate: '', isCurrent: false, summary: '', skills: '', technologies: '' });
  };

  const addEducation = async () => {
    if (!newEdu.institution) return;
    await fetch('/api/education', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newEdu) });
    const res = await fetch('/api/education').then(r => r.json());
    setEducation(res.entries || []);
    setNewEdu({ institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', isCurrent: false });
  };

  const addSkills = async () => {
    if (!skillInput.trim()) return;
    const skillList = skillInput.split(',').map(s => s.trim()).filter(Boolean);
    await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: skillList }) });
    const res = await fetch('/api/skills').then(r => r.json());
    setSkills(res.skills || []);
    setSkillInput('');
  };

  const removeSkill = async (id: string) => {
    await fetch(`/api/skills?id=${id}`, { method: 'DELETE' });
    setSkills(s => s.filter(sk => sk.id !== id));
  };

  const saveAnswer = async (questionKey: string, questionFamily: string, answer: string) => {
    await fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionKey, questionFamily, answer }) });
    const res = await fetch('/api/answers').then(r => r.json());
    setAnswers(res.answers || []);
  };

  // Completeness scoring
  const personalComplete = [personal.fullName, personal.email, personal.phone, personal.linkedinUrl].filter(Boolean).length * 25;
  const workComplete = workHistory.length >= 2 ? 100 : workHistory.length === 1 ? 60 : 0;
  const eduComplete = education.length >= 1 ? 100 : 0;
  const skillsComplete = skills.length >= 10 ? 100 : skills.length >= 5 ? 60 : skills.length > 0 ? 30 : 0;
  const prefsComplete = [prefs.salaryMinUSD, prefs.remotePreference, (prefs.targetTitles || []).length > 0].filter(Boolean).length * 33;
  const overall = Math.round((personalComplete + workComplete + eduComplete + skillsComplete + prefsComplete) / 5);

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Profile</h1>
            <p className="text-slate-400 text-sm mt-0.5">The richer your profile, the better your applications</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
              style={{ background: `conic-gradient(#10b981 ${overall}%, #e2e8f0 0)` }}>
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-base font-bold text-slate-700">{overall}%</div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Complete</p>
          </div>
        </div>
        {overall < 80 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            💡 Fill in more details to improve auto-apply quality. Aim for 80%+ for best results.
          </div>
        )}
      </div>

      {/* 1. Personal Info */}
      <Section title="Contact & Identity" subtitle="Used on every application" icon="👤" completeness={personalComplete}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={personal.fullName} onChange={(v: string) => setPersonal((p: any) => ({ ...p, fullName: v }))} required />
          <Input label="Email" type="email" value={personal.email} onChange={(v: string) => setPersonal((p: any) => ({ ...p, email: v }))} required />
          <Input label="Phone" value={personal.phone} onChange={(v: string) => setPersonal((p: any) => ({ ...p, phone: v }))} placeholder="+1 (555) 000-0000" />
          <Input label="Location (City, State)" value={personal.city} onChange={(v: string) => setPersonal((p: any) => ({ ...p, city: v }))} placeholder="New York, NY" />
          <Input label="LinkedIn URL" value={personal.linkedinUrl} onChange={(v: string) => setPersonal((p: any) => ({ ...p, linkedinUrl: v }))} placeholder="https://linkedin.com/in/..." />
          <Input label="GitHub URL" value={personal.githubUrl} onChange={(v: string) => setPersonal((p: any) => ({ ...p, githubUrl: v }))} placeholder="https://github.com/..." />
          <Input label="Portfolio / Website" value={personal.websiteUrl} onChange={(v: string) => setPersonal((p: any) => ({ ...p, websiteUrl: v }))} />
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Work Authorization</label>
            <select value={personal.workAuthorization || 'us_citizen'} onChange={e => setPersonal((p: any) => ({ ...p, workAuthorization: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white">
              <option value="us_citizen">US Citizen</option>
              <option value="green_card">Green Card</option>
              <option value="h1b">H-1B Visa</option>
              <option value="opt">OPT/CPT</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={personal.requiresSponsorship || false}
              onChange={e => setPersonal((p: any) => ({ ...p, requiresSponsorship: e.target.checked }))}
              className="rounded" />
            Requires visa sponsorship
          </label>
          <div className="ml-auto">
            <SaveBtn saving={saving.personal} onClick={() => save('personal', '/api/personal-info', personal)} />
          </div>
        </div>
      </Section>

      {/* 2. Work History */}
      <Section title="Work History" subtitle="Your professional experience — be thorough" icon="💼" completeness={workComplete}>
        {/* Existing entries */}
        {workHistory.length > 0 && (
          <div className="space-y-3 mb-6">
            {workHistory.map((wh: any) => (
              <div key={wh.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{wh.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{wh.company} · {wh.isCurrent ? 'Present' : (wh.endDate ? new Date(wh.endDate).getFullYear() : '')}</p>
                    {wh.summary && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{wh.summary}</p>}
                  </div>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{(wh.bullets || []).length} bullets</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import from resume CTA */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400">Add each position you have held</p>
          <button onClick={parseFromResume} disabled={parsing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all disabled:opacity-50">
            {parsing ? '⏳ Parsing...' : '📄 Import from Resume'}
          </button>
        </div>
        {parseMsg && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{parseMsg}</p>
        )}

        {/* Add new */}
        <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Add Position</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Job Title" value={newWork.title} onChange={(v: string) => setNewWork((w: any) => ({ ...w, title: v }))} placeholder="Senior Data Analyst" required />
            <Input label="Company" value={newWork.company} onChange={(v: string) => setNewWork((w: any) => ({ ...w, company: v }))} placeholder="Company Name" required />
                <MonthYearPicker label="Start Date" value={newWork.startDate} onChange={(v: string) => setNewWork((w: any) => ({ ...w, startDate: v }))} />
                <MonthYearPicker label="End Date" value={newWork.endDate} onChange={(v: string) => setNewWork((w: any) => ({ ...w, endDate: v }))} />
          </div>
          <TextArea label="Summary / Key responsibilities" value={newWork.summary} onChange={(v: string) => setNewWork((w: any) => ({ ...w, summary: v }))} placeholder="Describe what you did and the impact you had..." rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Skills used (comma-separated)" value={newWork.skills} onChange={(v: string) => setNewWork((w: any) => ({ ...w, skills: v }))} placeholder="SQL, Python, Tableau..." />
            <Input label="Technologies (comma-separated)" value={newWork.technologies} onChange={(v: string) => setNewWork((w: any) => ({ ...w, technologies: v }))} placeholder="Snowflake, dbt, Looker..." />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={newWork.isCurrent} onChange={e => setNewWork((w: any) => ({ ...w, isCurrent: e.target.checked }))} className="rounded" />
              Current position
            </label>
            <button onClick={addWork} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              + Add Position
            </button>
          </div>
        </div>
      </Section>

      {/* 3. Education */}
      <Section title="Education" subtitle="Degrees, certifications, bootcamps" icon="🎓" completeness={eduComplete}>
        {education.length > 0 && (
          <div className="space-y-2 mb-4">
            {education.map((ed: any) => (
              <div key={ed.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{ed.degree} {ed.fieldOfStudy && `in ${ed.fieldOfStudy}`}</p>
                  <p className="text-slate-500 text-xs">{ed.institution}</p>
                </div>
                <button onClick={() => fetch(`/api/education?id=${ed.id}`, { method: 'DELETE' }).then(() => setEducation(e => e.filter(x => x.id !== ed.id)))}
                  className="text-slate-300 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
        {education.length === 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-400">No education entries yet</p>
            <button onClick={parseFromResume} disabled={parsing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all disabled:opacity-50">
              {parsing ? '⏳ Importing...' : '📄 Import from Resume'}
            </button>
          </div>
        )}
        <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Institution" value={newEdu.institution} onChange={(v: string) => setNewEdu((e: any) => ({ ...e, institution: v }))} placeholder="University of..." required />
            <Input label="Degree" value={newEdu.degree} onChange={(v: string) => setNewEdu((e: any) => ({ ...e, degree: v }))} placeholder="Bachelor of Science" />
            <Input label="Field of Study" value={newEdu.fieldOfStudy} onChange={(v: string) => setNewEdu((e: any) => ({ ...e, fieldOfStudy: v }))} placeholder="Computer Science" />
            <Input label="Graduation Year" type="number" value={newEdu.endDate ? new Date(newEdu.endDate).getFullYear().toString() : ''} onChange={(v: string) => setNewEdu((e: any) => ({ ...e, endDate: `${v}-05-01` }))} placeholder="2022" />
          </div>
          <div className="flex justify-end">
            <button onClick={addEducation} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              + Add Education
            </button>
          </div>
        </div>
      </Section>

      {/* 4. Skills */}
      <Section title="Skills & Technologies" subtitle="Add everything — it powers your match scores" icon="⚡" completeness={skillsComplete}>
        <div className="flex flex-wrap gap-2 mb-4">
          {skills.map((sk: any) => (
            <span key={sk.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100">
              {sk.name}
              <button onClick={() => removeSkill(sk.id)} className="text-indigo-300 hover:text-red-400 ml-1">✕</button>
            </span>
          ))}
          {skills.length === 0 && <p className="text-slate-400 text-sm">No skills added yet</p>}
        </div>
        <div className="flex gap-2">
          <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkills()}
            placeholder="SQL, Python, Tableau, Salesforce... (comma-separated)"
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white" />
          <button onClick={addSkills} className="px-4 py-2 rounded-xl text-white text-sm font-semibold whitespace-nowrap" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            Add Skills
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Press Enter or click Add. Include tools, languages, frameworks, methodologies, soft skills.</p>
      </Section>

      {/* 5. Job Preferences */}
      <Section title="Job Preferences" subtitle="What you're looking for — used for scoring and auto-apply" icon="🎯" completeness={prefsComplete}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Target Job Titles (comma-separated)" value={(prefs.targetTitles || []).join(', ')} onChange={(v: string) => setPrefs((p: any) => ({ ...p, targetTitles: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="Data Analyst, Ops Manager, BI Analyst" />
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remote Preference</label>
            <select value={prefs.remotePreference || 'any'} onChange={e => setPrefs((p: any) => ({ ...p, remotePreference: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white">
              <option value="remote_only">Remote Only</option>
              <option value="hybrid_ok">Hybrid OK</option>
              <option value="onsite_ok">Open to Onsite</option>
              <option value="any">Flexible</option>
            </select>
          </div>
          <Input label="Minimum Salary (USD)" type="number" value={prefs.salaryMinUSD} onChange={(v: string) => setPrefs((p: any) => ({ ...p, salaryMinUSD: parseInt(v) || null }))} placeholder="80000" />
          <Input label="Maximum Salary (USD)" type="number" value={prefs.salaryMaxUSD} onChange={(v: string) => setPrefs((p: any) => ({ ...p, salaryMaxUSD: parseInt(v) || null }))} placeholder="130000" />
          <Input label="Target Locations (comma-separated)" value={(prefs.preferredLocations || []).join(', ')} onChange={(v: string) => setPrefs((p: any) => ({ ...p, preferredLocations: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="New York, Remote, San Francisco" />
          <Input label="Target Industries (comma-separated)" value={(prefs.targetIndustries || []).join(', ')} onChange={(v: string) => setPrefs((p: any) => ({ ...p, targetIndustries: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="Fintech, Data, Crypto, SaaS" />
        </div>
        <div className="flex justify-end mt-4">
          <SaveBtn saving={saving.prefs} onClick={() => save('prefs', '/api/job-preferences', prefs)} />
        </div>
      </Section>

      {/* 6. Reusable Answers */}
      <Section title="Application Answers" subtitle="Save answers to common questions — used in every application" icon="💬">
        <div className="space-y-4">
          {[
            { key: 'why_this_role', family: 'experience', label: 'Why are you interested in this type of role?', placeholder: 'I have X years of experience in... I am passionate about...' },
            { key: 'biggest_achievement', family: 'experience', label: 'What is your biggest professional achievement?', placeholder: 'I led a project that resulted in...' },
            { key: 'describe_yourself', family: 'experience', label: 'Tell us about yourself (elevator pitch)', placeholder: '2-3 sentences. Background, what you do, what you\'re looking for.' },
            { key: 'salary_expectation', family: 'compensation', label: 'What are your salary expectations?', placeholder: '$80,000 – $110,000 depending on total compensation' },
            { key: 'notice_period', family: 'logistics', label: 'What is your notice period / when can you start?', placeholder: '2 weeks notice, available [month]' },
          ].map(q => {
            const existing = answers.find((a: any) => a.questionKey === q.key);
            return (
              <AnswerField key={q.key} question={q} existing={existing} onSave={saveAnswer} />
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function AnswerField({ question, existing, onSave }: { question: any; existing?: any; onSave: (k: string, f: string, a: string) => void }) {
  const [value, setValue] = useState(existing?.answer || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(question.key, question.family, value);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700">{question.label}</label>
      <div className="flex gap-2">
        <textarea value={value} onChange={e => setValue(e.target.value)} placeholder={question.placeholder} rows={2}
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white resize-none" />
        <button onClick={handleSave} disabled={saving || !value.trim()}
          className={`self-end px-3 py-2 rounded-xl text-xs font-bold transition-all ${saved ? 'bg-emerald-50 text-emerald-700' : 'text-white'} disabled:opacity-40`}
          style={!saved ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
          {saved ? '✓' : saving ? '...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
