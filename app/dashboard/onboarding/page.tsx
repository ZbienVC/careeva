'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'resume',
  'cover_letters',
  'basic_info',
  'work_history',
  'education',
  'skills',
  'job_preferences',
  'background',
  'standard_questions',
  'writing_style',
  'complete',
] as const;

type Step = typeof STEPS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#10b981,#6366f1)' }} />
    </div>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white" />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder = '', rows = 3, required = false }: any) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white resize-none" />
    </div>
  );
}

function RadioGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)} type="button"
            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${value === opt.value ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}
            style={value === opt.value ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({ label, values, onChange, options }: { label: string; values: string[]; onChange: (v: string[]) => void; options: string[] }) {
  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} onClick={() => toggle(opt)} type="button"
            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${values.includes(opt) ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}
            style={values.includes(opt) ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' } : {}}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function NextBtn({ onClick, label = 'Continue →', disabled = false }: any) {
  return (
    <div className="flex justify-end mt-8">
      <button onClick={onClick} disabled={disabled}
        className="px-8 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
        {label}
      </button>
    </div>
  );
}

// ─── Main Onboarding Component ────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // All collected data
  const [data, setData] = useState({
    // Resume
    resumeText: '',
    resumeUploaded: false,
    // Cover letters
    coverLetters: [] as string[],
    newCoverLetter: '',
    // Basic info
    fullName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '',
    linkedinUrl: '', githubUrl: '', portfolioUrl: '',
    // Work history (quick capture)
    currentTitle: '', currentCompany: '', yearsExperience: '',
    careerSummary: '',
    // Education
    highestDegree: '', fieldOfStudy: '', school: '', gradYear: '',
    // Skills
    skillsText: '',
    technologies: '',
    // Job preferences
    targetTitles: '', targetIndustries: [] as string[], targetSalaryMin: '',
    remotePreference: '', willingToRelocate: 'no',
    workAuthorization: 'us_citizen', requiresSponsorship: 'no',
    // Background / interests
    hobbies: '', personalStatement: '', whyJobSearch: '',
    strengthsText: '', weaknessText: '',
    // Standard EEO/application questions
    isVeteran: 'prefer_not',
    hasDisability: 'prefer_not',
    gender: 'prefer_not',
    ethnicity: 'prefer_not',
    noticePeriodWeeks: '2',
    availableStartDate: '',
    // Writing style
    toneWords: [] as string[],
    writingNotes: '',
  });

  const set = (key: string) => (val: any) => setData(d => ({ ...d, [key]: val }));
  const step = STEPS[stepIdx];
  const totalSteps = STEPS.length - 2; // exclude welcome and complete

  const handleResumeUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) {
        setData(d => ({ ...d, resumeUploaded: true }));
        return true;
      }
    } catch { /* handle */ }
    return false;
  };

  const saveAllData = async () => {
    setSaving(true);
    try {
      // Save personal info
      await fetch('/api/personal-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName, email: data.email, phone: data.phone,
          addressLine1: data.address, city: data.city, state: data.state, zipCode: data.zipCode,
          linkedinUrl: data.linkedinUrl, githubUrl: data.githubUrl, websiteUrl: data.portfolioUrl,
          workAuthorization: data.workAuthorization,
          requiresSponsorship: data.requiresSponsorship === 'yes',
        }),
      });

      // Save job preferences
      const titles = data.targetTitles.split(',').map(s => s.trim()).filter(Boolean);
      await fetch('/api/job-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTitles: titles,
          targetIndustries: data.targetIndustries,
          salaryMinUSD: parseInt(data.targetSalaryMin) || null,
          remotePreference: data.remotePreference || 'any',
          willingToRelocate: data.willingToRelocate === 'yes',
        }),
      });

      // Save skills
      const allSkills = [...data.skillsText.split(','), ...data.technologies.split(',')]
        .map(s => s.trim()).filter(Boolean);
      if (allSkills.length > 0) {
        await fetch('/api/skills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills: allSkills }),
        });
      }

      // Save writing preferences
      if (data.toneWords.length > 0 || data.personalStatement) {
        await fetch('/api/writing-preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toneWords: data.toneWords,
            positioningStatement: data.personalStatement || data.careerSummary,
          }),
        }).catch(() => {});
      }

      // Save standard answers to answer bank
      const answerBank = [
        { key: 'veteran_status', family: 'eeo', answer: data.isVeteran },
        { key: 'disability_status', family: 'eeo', answer: data.hasDisability },
        { key: 'gender', family: 'eeo', answer: data.gender },
        { key: 'ethnicity', family: 'eeo', answer: data.ethnicity },
        { key: 'notice_period', family: 'logistics', answer: `${data.noticePeriodWeeks} weeks notice` },
        { key: 'available_start_date', family: 'logistics', answer: data.availableStartDate || `${data.noticePeriodWeeks} weeks from acceptance` },
        { key: 'describe_yourself', family: 'experience', answer: data.personalStatement || data.careerSummary },
        { key: 'why_job_search', family: 'experience', answer: data.whyJobSearch },
        { key: 'strengths', family: 'experience', answer: data.strengthsText },
        { key: 'salary_expectation', family: 'compensation', answer: data.targetSalaryMin ? `$${parseInt(data.targetSalaryMin).toLocaleString()}+` : '' },
      ].filter(a => a.answer && a.answer !== 'prefer_not' && a.answer !== '');

      for (const ans of answerBank) {
        await fetch('/api/answers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ans),
        }).catch(() => {});
      }

      // Save basic onboarding profile
      await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: titles[0] || data.currentTitle,
          targetIndustries: data.targetIndustries,
          desiredSalaryMin: parseInt(data.targetSalaryMin) || 0,
          jobType: data.remotePreference === 'remote_only' ? ['Remote'] : ['Full-time'],
          willingToRelocate: data.willingToRelocate === 'yes',
          careerGoals: data.personalStatement || data.careerSummary,
          additionalInfo: data.hobbies,
          skills: allSkills,
          yearsExperience: parseInt(data.yearsExperience) || 0,
        }),
      });

      setStepIdx(STEPS.length - 1); // → complete
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx(i => Math.max(i - 1, 0));

  // ─── Step renders ─────────────────────────────────────────────────────────

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', boxShadow: '0 8px 32px rgba(16,185,129,0.25)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Let's set you up</h1>
          <p className="text-slate-500 text-base leading-relaxed mb-8">
            This takes about 5 minutes. The more you share, the smarter Careeva gets at finding the right jobs and writing applications that sound like <em>you</em>.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-8 text-xs text-slate-500">
            {['📄 Upload Resume', '🎯 Job Preferences', '🤖 Auto-Apply Ready'].map(t => (
              <div key={t} className="bg-white rounded-xl p-3 border border-slate-100 font-medium">{t}</div>
            ))}
          </div>
          <button onClick={next} className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}>
            Get Started →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">You're all set!</h1>
          <p className="text-slate-500 mb-8">Careeva now knows enough about you to find great matches and write applications in your voice.</p>
          <div className="grid grid-cols-1 gap-3 mb-6">
            <button onClick={() => router.push('/dashboard/automation')}
              className="w-full py-3.5 rounded-2xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              ⚡ Run Auto-Apply Now
            </button>
            <button onClick={() => router.push('/dashboard/jobs')}
              className="w-full py-3 rounded-2xl text-slate-700 font-semibold bg-white border border-slate-200">
              Browse Job Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepNum = STEPS.indexOf(step) - 1; // -1 for welcome

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
      <div className="max-w-2xl mx-auto">
        <ProgressBar current={stepNum} total={totalSteps} />

        {step === 'resume' && (
          <StepCard title="Upload your resume" subtitle="PDF, DOCX, or paste the text. This is the foundation of everything.">
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) await handleResumeUpload(file);
                }} />
              {data.resumeUploaded ? (
                <div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="font-semibold text-emerald-700">Resume uploaded & parsed</p>
                  <button onClick={() => fileRef.current?.click()} className="text-sm text-slate-400 mt-2 hover:text-slate-600">Upload different file</button>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">Drop your resume here</p>
                  <p className="text-sm text-slate-400 mb-3">PDF or DOCX</p>
                  <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                    Choose File
                  </button>
                </div>
              )}
            </div>
            <div className="text-center text-slate-400 text-sm">— or paste your resume text —</div>
            <Textarea label="" value={data.resumeText} onChange={set('resumeText')} placeholder="Paste your resume text here..." rows={6} />
            <NextBtn onClick={next} />
          </StepCard>
        )}

        {step === 'cover_letters' && (
          <StepCard title="Cover letters (optional)" subtitle="Upload existing cover letters — Careeva will learn your voice and style from them.">
            {data.coverLetters.map((cl, i) => (
              <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700 font-semibold">Cover letter {i + 1}</span>
                <button onClick={() => setData(d => ({ ...d, coverLetters: d.coverLetters.filter((_, j) => j !== i) }))} className="text-emerald-400 hover:text-red-400 text-sm">Remove</button>
              </div>
            ))}
            <Textarea label="Paste a cover letter" value={data.newCoverLetter} onChange={set('newCoverLetter')} placeholder="Paste a cover letter you've written before..." rows={6} />
            {data.newCoverLetter && (
              <button onClick={() => {
                setData(d => ({ ...d, coverLetters: [...d.coverLetters, d.newCoverLetter], newCoverLetter: '' }));
              }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                + Save this cover letter
              </button>
            )}
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600">← Back</button>
              <NextBtn onClick={async () => {
                // Save cover letters as writing samples
                for (const cl of data.coverLetters) {
                  await fetch('/api/writing-samples', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'Cover letter sample', type: 'cover_letter', content: cl }),
                  }).catch(() => {});
                }
                next();
              }} label={data.coverLetters.length > 0 ? `Save ${data.coverLetters.length} cover letter(s) →` : 'Skip for now →'} />
            </div>
          </StepCard>
        )}

        {step === 'basic_info' && (
          <StepCard title="Your contact information" subtitle="Used in application headers and auto-fill.">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name" value={data.fullName} onChange={set('fullName')} required placeholder="Zach Bienstock" />
              <Input label="Email" type="email" value={data.email} onChange={set('email')} required />
              <Input label="Phone" value={data.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
              <Input label="City, State" value={data.city} onChange={set('city')} placeholder="New York, NY" />
              <Input label="LinkedIn URL" value={data.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
              <Input label="GitHub / Portfolio" value={data.githubUrl} onChange={set('githubUrl')} />
            </div>
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400 hover:text-slate-600">← Back</button>
              <NextBtn onClick={next} disabled={!data.fullName || !data.email} />
            </div>
          </StepCard>
        )}

        {step === 'work_history' && (
          <StepCard title="Your work background" subtitle="Tell us about your experience — the system uses this to match and write.">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Current/Most Recent Title" value={data.currentTitle} onChange={set('currentTitle')} placeholder="Senior Data Analyst" required />
              <Input label="Current/Most Recent Company" value={data.currentCompany} onChange={set('currentCompany')} placeholder="Acme Corp" />
              <Input label="Years of Experience" type="number" value={data.yearsExperience} onChange={set('yearsExperience')} placeholder="5" />
            </div>
            <Textarea label="Career summary" value={data.careerSummary} onChange={set('careerSummary')} placeholder="In 2-3 sentences, describe your professional background, what you specialize in, and your key strengths..." rows={4} required />
            <Textarea label="Hobbies & interests (optional)" value={data.hobbies} onChange={set('hobbies')} placeholder="What do you do outside of work? This helps personalize cover letters..." rows={2} />
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} disabled={!data.currentTitle || !data.careerSummary} />
            </div>
          </StepCard>
        )}

        {step === 'education' && (
          <StepCard title="Education" subtitle="Your highest level of education.">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <RadioGroup label="Highest degree" value={data.highestDegree} onChange={set('highestDegree')} options={[
                  { value: 'High School', label: 'High School' },
                  { value: "Associate's", label: "Associate's" },
                  { value: "Bachelor's", label: "Bachelor's" },
                  { value: "Master's", label: "Master's" },
                  { value: 'PhD / Doctorate', label: 'PhD' },
                  { value: 'Bootcamp', label: 'Bootcamp' },
                  { value: 'Self-taught', label: 'Self-taught' },
                ]} />
              </div>
              <Input label="Field of study" value={data.fieldOfStudy} onChange={set('fieldOfStudy')} placeholder="Computer Science, Finance..." />
              <Input label="School / Institution" value={data.school} onChange={set('school')} placeholder="University of..." />
              <Input label="Graduation year" type="number" value={data.gradYear} onChange={set('gradYear')} placeholder="2020" />
            </div>
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} />
            </div>
          </StepCard>
        )}

        {step === 'skills' && (
          <StepCard title="Skills & technologies" subtitle="List everything — this drives your match scores.">
            <Textarea label="Skills (comma-separated)" value={data.skillsText} onChange={set('skillsText')} placeholder="SQL, Python, Excel, Tableau, Project Management, Customer Success, Salesforce..." rows={3} required />
            <Textarea label="Technical tools & technologies" value={data.technologies} onChange={set('technologies')} placeholder="Snowflake, dbt, Looker, Jira, Notion, Stripe, AWS, React..." rows={3} />
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} disabled={!data.skillsText} />
            </div>
          </StepCard>
        )}

        {step === 'job_preferences' && (
          <StepCard title="What you're looking for" subtitle="These settings drive job discovery and scoring.">
            <Input label="Target job titles (comma-separated)" value={data.targetTitles} onChange={set('targetTitles')} placeholder="Data Analyst, Business Analyst, Operations Manager..." required />
            <CheckboxGroup label="Target industries" values={data.targetIndustries} onChange={set('targetIndustries')} options={['Technology', 'Finance / Fintech', 'Crypto / Web3', 'Healthcare', 'E-commerce', 'Media', 'Consulting', 'Government', 'Startup', 'Enterprise']} />
            <Input label="Minimum salary (USD)" type="number" value={data.targetSalaryMin} onChange={set('targetSalaryMin')} placeholder="80000" />
            <RadioGroup label="Work arrangement" value={data.remotePreference} onChange={set('remotePreference')} options={[
              { value: 'remote_only', label: 'Remote only' },
              { value: 'hybrid_ok', label: 'Hybrid OK' },
              { value: 'onsite_ok', label: 'Open to onsite' },
              { value: 'any', label: 'Flexible' },
            ]} />
            <RadioGroup label="Open to relocation?" value={data.willingToRelocate} onChange={set('willingToRelocate')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'maybe', label: 'Maybe' }]} />
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} disabled={!data.targetTitles} />
            </div>
          </StepCard>
        )}

        {step === 'background' && (
          <StepCard title="About you" subtitle="Help us write applications that sound like you, not like a template.">
            <Textarea label="Personal / professional statement" value={data.personalStatement} onChange={set('personalStatement')} placeholder="Describe yourself in 2-3 sentences as you would to a recruiter. What drives you? What's your edge?" rows={4} required />
            <Textarea label="Why are you job searching right now?" value={data.whyJobSearch} onChange={set('whyJobSearch')} placeholder="Career growth, new challenge, company changes, relocation... (this helps explain gaps or transitions authentically)" rows={3} />
            <Textarea label="Your key strengths" value={data.strengthsText} onChange={set('strengthsText')} placeholder="What do you do better than most? Be specific — data analysis, cross-functional coordination, financial modeling..." rows={3} required />
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} disabled={!data.personalStatement || !data.strengthsText} />
            </div>
          </StepCard>
        )}

        {step === 'standard_questions' && (
          <StepCard title="Standard application questions" subtitle="These are pre-filled on every application. You control your answers.">
            <RadioGroup label="Work authorization (US)" value={data.workAuthorization} onChange={set('workAuthorization')} options={[
              { value: 'us_citizen', label: 'US Citizen' },
              { value: 'green_card', label: 'Green Card' },
              { value: 'h1b', label: 'H-1B Visa' },
              { value: 'opt', label: 'OPT / CPT' },
              { value: 'other', label: 'Other' },
            ]} />
            <RadioGroup label="Require visa sponsorship?" value={data.requiresSponsorship} onChange={set('requiresSponsorship')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Notice period (weeks)" type="number" value={data.noticePeriodWeeks} onChange={set('noticePeriodWeeks')} placeholder="2" />
              <Input label="Available start date (optional)" type="month" value={data.availableStartDate} onChange={set('availableStartDate')} />
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">EEO / Equal Opportunity (optional — affects nothing)</p>
              <RadioGroup label="Veteran status" value={data.isVeteran} onChange={set('isVeteran')} options={[
                { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'prefer_not', label: 'Prefer not to say' },
              ]} />
              <RadioGroup label="Disability status" value={data.hasDisability} onChange={set('hasDisability')} options={[
                { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'prefer_not', label: 'Prefer not to say' },
              ]} />
              <RadioGroup label="Gender identity" value={data.gender} onChange={set('gender')} options={[
                { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'nonbinary', label: 'Non-binary' }, { value: 'prefer_not', label: 'Prefer not to say' },
              ]} />
            </div>
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <NextBtn onClick={next} />
            </div>
          </StepCard>
        )}

        {step === 'writing_style' && (
          <StepCard title="Your writing voice" subtitle="This shapes every cover letter and application answer we generate.">
            <CheckboxGroup label="How would you describe your professional tone?" values={data.toneWords} onChange={set('toneWords')} options={['Direct', 'Warm', 'Analytical', 'Creative', 'Concise', 'Thorough', 'Casual', 'Formal', 'Confident', 'Collaborative']} />
            <Textarea label="Any additional writing notes?" value={data.writingNotes} onChange={set('writingNotes')} placeholder="e.g. I never use the word 'passionate'. I prefer short sentences. I always mention my data background first..." rows={3} />
            <div className="flex gap-3 justify-between mt-6">
              <button onClick={back} className="text-sm text-slate-400">← Back</button>
              <button onClick={saveAllData} disabled={saving}
                className="px-8 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
                {saving ? 'Saving...' : 'Finish Setup →'}
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}
