'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome', title: '', subtitle: '' },
  // Documents
  { id: 'resume_upload', title: 'Upload your resume(s)', subtitle: 'Upload every version you have. The system learns from all of them.' },
  { id: 'cover_letters', title: 'Upload your cover letters', subtitle: 'Every cover letter teaches the system your voice and what works for you.' },
  { id: 'portfolio_links', title: 'Portfolio, websites & samples', subtitle: 'Links to your work, GitHub projects, writing samples, case studies.' },
  // Identity & Contact
  { id: 'contact_info', title: 'Contact & identity', subtitle: 'Pre-filled on every application - be thorough.' },
  { id: 'demographics', title: 'Work authorization & personal details', subtitle: 'Used to answer eligibility questions accurately on every application.' },
  // Work history
  { id: 'work_history_1', title: 'Work history - most recent role', subtitle: 'Tell us everything. The more detail, the better your applications.' },
  { id: 'work_history_2', title: 'Previous roles', subtitle: 'Add as many roles as you want. Each one expands your answer bank.' },
  { id: 'achievements', title: 'Specific achievements & metrics', subtitle: 'Concrete wins with numbers - these go directly into cover letters and answers.' },
  // Education & certs
  { id: 'education', title: 'Education', subtitle: 'Degrees, bootcamps, certifications, courses.' },
  { id: 'certifications', title: 'Certifications & credentials', subtitle: 'Professional certifications, licenses, and credentials.' },
  // Skills
  { id: 'skills_technical', title: 'Technical skills', subtitle: 'Every tool, language, platform, and system you have used.' },
  { id: 'skills_soft', title: 'Soft skills & competencies', subtitle: 'Communication, leadership, domain expertise, functional skills.' },
  { id: 'skills_domain', title: 'Domain knowledge & specializations', subtitle: 'Industries, functions, and areas where you have deep expertise.' },
  // Career targets
  { id: 'job_preferences', title: 'Target roles & preferences', subtitle: 'What you want - drives all scoring and job discovery.' },
  { id: 'company_preferences', title: 'Company preferences', subtitle: 'Specific companies, company types, cultures you want to target.' },
  { id: 'compensation', title: 'Compensation expectations', subtitle: 'Salary, equity, benefits expectations - used to filter and answer salary questions.' },
  // Background & narrative
  { id: 'career_narrative', title: 'Your career story', subtitle: 'How you describe yourself, what drives you, and what you are looking for.' },
  { id: 'accomplishments', title: 'Key projects & case studies', subtitle: 'Deep dives on your most impactful work - used in detailed application answers.' },
  { id: 'interests_background', title: 'Background, interests & personality', subtitle: 'Hobbies, volunteer work, side projects - humanizes your applications.' },
  // Standard application questions
  { id: 'standard_questions', title: 'Standard application questions', subtitle: 'Pre-answered for every application you submit.' },
  { id: 'behavioral_answers', title: 'Behavioral & situational answers', subtitle: 'Pre-written answers to common interview questions - reused in applications.' },
  { id: 'industry_answers', title: 'Industry-specific answers', subtitle: 'Answers specific to your target roles and industries.' },
  // Writing style
  { id: 'writing_style', title: 'Your writing voice', subtitle: 'Guides every sentence the system writes for you.' },
  // Complete
  { id: 'complete', title: '', subtitle: '' },
] as const;

type StepId = typeof STEPS[number]['id'];

// ─── Shared UI components ────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>Step {current} of {total}</span>
        <span>{pct}% complete</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#10b981,#6366f1)' }} />
      </div>
    </div>
  );
}

function StepCard({ step, children }: { step: typeof STEPS[number]; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900">{step.title}</h2>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{step.subtitle}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

const F = ({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {label}{req && <span className="text-red-400 ml-1">*</span>}
    </label>
    {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white";
const taCls = `${inputCls} resize-none`;

function Inp({ label, value, onChange, type = 'text', placeholder = '', req = false, hint = '' }: any) {
  return (
    <F label={label} req={req} hint={hint}>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </F>
  );
}

// Month/Year picker - much easier than native date input
function MonthYearPicker({ label, value, onChange, hint = '', placeholder = 'Select...' }: any) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => currentYear - i);
  const [month, year] = value ? value.split('-') : ['', ''];
  const mIdx = month ? parseInt(month) - 1 : -1;
  const selectCls = "flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 cursor-pointer";
  const handleChange = (newMonth: string, newYear: string) => {
    if (newMonth && newYear) onChange(newYear + '-' + newMonth);
    else if (newYear && month) onChange(newYear + '-' + month);
    else if (newMonth && year) onChange(year + '-' + newMonth);
    else onChange('');
  };
  return (
    <F label={label} hint={hint}>
      <div className="flex gap-2">
        <select value={mIdx >= 0 ? String(mIdx + 1).padStart(2,'0') : ''} onChange={e => handleChange(e.target.value, year)} className={selectCls}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        <select value={year || ''} onChange={e => handleChange(month, e.target.value)} className={selectCls}>
          <option value="">Year</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
    </F>
  );
}


function TA({ label, value, onChange, placeholder = '', rows = 4, req = false, hint = '' }: any) {
  return (
    <F label={label} req={req} hint={hint}>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={taCls} />
    </F>
  );
}

function Radio({ label, value, onChange, options, hint = '' }: any) {
  return (
    <F label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((o: any) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <button key={v} type="button" onClick={() => onChange(v)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${value === v ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}
              style={value === v ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
              {l}
            </button>
          );
        })}
      </div>
    </F>
  );
}

function Multi({ label, values, onChange, options, hint = '' }: any) {
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x: string) => x !== v) : [...values, v]);
  return (
    <F label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((o: any) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <button key={v} type="button" onClick={() => toggle(v)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${values.includes(v) ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}
              style={values.includes(v) ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' } : {}}>
              {l}
            </button>
          );
        })}
      </div>
    </F>
  );
}

function NavBar({ onBack, onNext, nextLabel = 'Continue →', nextDisabled = false, saving = false }: any) {
  return (
    <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
      {onBack ? (
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600 font-medium">← Back</button>
      ) : <div />}
      <button onClick={onNext} disabled={nextDisabled || saving}
        className="px-8 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
        {saving ? 'Saving...' : nextLabel}
      </button>
    </div>
  );
}

function UploadZone({ label, onFile, uploaded, hint, fileName, uploading, extractedText }: {
  label: string; onFile: (f: File) => void; uploaded: boolean; hint?: string;
  fileName?: string; uploading?: boolean; extractedText?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-semibold text-slate-700">{label}</p>}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <input ref={ref} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div
        onClick={() => !uploading && ref.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 transition-all text-center ${
          uploading ? 'border-indigo-300 bg-indigo-50 cursor-wait' :
          uploaded ? 'border-emerald-300 bg-emerald-50 cursor-pointer' :
          'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-3 text-indigo-600">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div className="text-left">
              <p className="text-sm font-semibold">Uploading & extracting...</p>
              <p className="text-xs text-indigo-400 mt-0.5">Parsing your resume now</p>
            </div>
          </div>
        ) : uploaded ? (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-sm font-bold">Resume saved ✓</span>
            </div>
            {fileName && <p className="text-xs text-emerald-600 font-medium">{fileName}</p>}
            <p className="text-xs text-emerald-500">Click to replace</p>
          </div>
        ) : (
          <div className="text-slate-400">
            <svg className="w-8 h-8 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm font-medium text-slate-600">Click to upload PDF or DOCX</p>
            <p className="text-xs text-slate-400 mt-1">Skills and experience will be auto-extracted</p>
          </div>
        )}
      </div>
      {/* Show extracted text preview after upload */}
      {uploaded && extractedText && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">✓ Extracted from your resume</p>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{extractedText.slice(0, 400)}{extractedText.length > 400 ? '...' : ''}</p>
          <p className="text-xs text-emerald-600 font-semibold mt-1.5">Skills, experience & education saved to your profile</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── ALL data fields ────────────────────────────────────────────────────────
  const [d, setD] = useState({
    // Resumes
    resumes: [] as { name: string; uploaded: boolean; extractedText?: string }[],
    resumeText: '',
    resumeUploading: false,
    // Cover letters
    coverLetters: [] as string[],
    coverLetterInput: '',
    // Portfolio
    portfolioLinks: '',
    githubUrl: '',
    websiteUrl: '',
    writingSampleLinks: '',
    caseStudyLinks: '',
    // Contact
    fullName: '', preferredName: '', email: '', phone: '',
    addressLine1: '', city: '', state: '', zipCode: '', country: 'US',
    linkedinUrl: '', pronouns: '',
    // Work auth & demographics
    workAuthorization: 'us_citizen', requiresSponsorship: 'no',
    isVeteran: 'prefer_not', hasDisability: 'prefer_not',
    gender: 'prefer_not', ethnicity: 'prefer_not',
    noticePeriodWeeks: '2', availableDate: '',
    citizenshipCountry: 'US', secondaryNationality: '',
    // Work history - role 1
    r1Title: '', r1Company: '', r1Start: '', r1End: '', r1Current: 'no',
    r1Location: '', r1Remote: 'no', r1Summary: '', r1Bullets: '',
    r1Skills: '', r1Tech: '', r1TeamSize: '', r1Budget: '', r1Reports: '',
    r1Achievements: '',
    // Role 2
    r2Title: '', r2Company: '', r2Start: '', r2End: '',
    r2Summary: '', r2Bullets: '', r2Skills: '',
    // Role 3+
    additionalRoles: '',
    // Achievements
    achievement1: '', achievement2: '', achievement3: '',
    achievement4: '', achievement5: '',
    // Education
    degree1Type: '', degree1Field: '', degree1School: '', degree1Year: '', degree1GPA: '', degree1Honors: '',
    degree2Type: '', degree2Field: '', degree2School: '', degree2Year: '',
    bootcamps: '', onlineCourses: '', continuingEd: '',
    // Certifications
    certs: '',
    // Skills
    programmingLanguages: '', databases: '', analyticsTools: '', cloudPlatforms: '',
    crmErp: '', projectMgmt: '', designTools: '', otherTech: '',
    softSkills: '', leadershipExp: '', stakeholderMgmt: '', clientFacing: '',
    analyticsExp: '', operationsExp: '', processImprovement: '', dataVisualization: '',
    financialModeling: '', automationExp: '', aiToolsExp: '', apiIntegration: '',
    // Domain
    fintech: 'no', crypto: 'no', healthtech: 'no', saas: 'no', ecommerce: 'no',
    dataSci: 'no', mlai: 'no', ops: 'no', productMgmt: 'no', bizDev: 'no',
    domainDepth: '',
    // Job preferences
    targetTitles: '', targetFunctions: [], targetIndustries: [] as string[],
    seniority: [] as string[], companySize: [] as string[],
    remotePreference: 'any', willingToRelocate: 'no', travelPercent: '0',
    fullTimeOk: 'yes', contractOk: 'no', partTimeOk: 'no',
    // Company prefs
    dreamCompanies: '', avoidCompanies: '', companyTypes: [] as string[],
    companyCareerUrls: '',
    // Compensation
    salaryMin: '', salaryMax: '', equityImportance: 'nice_to_have',
    benefitsPriorities: '',
    // Career narrative
    elevatorPitch: '', whyJobSearch: '', careerGoals: '',
    biggestStrengths: '', uniqueValue: '', personalStatement: '',
    // Projects / accomplishments
    project1Name: '', project1Desc: '', project1Impact: '', project1Tech: '',
    project2Name: '', project2Desc: '', project2Impact: '',
    project3Name: '', project3Desc: '', project3Impact: '',
    // Interests
    hobbies: '', volunteerWork: '', sideProjects: '', communityInvolvement: '',
    funFact: '', personalValues: '',
    // Standard answers
    whyThisRole: '', whyThisCompany: '', greatestAchievement: '',
    challengeOvercome: '', leadershipExample: '', conflictResolution: '',
    fiveYearPlan: '', weaknesses: '', salaryAnswer: '',
    // Industry-specific
    industryAnswer1: '', industryAnswer2: '', industryAnswer3: '',
    cryptoExperience: '', fintechExperience: '', dataAnalyticsExp: '',
    // Writing style
    toneWords: [] as string[], avoidPhrases: '',
    coverLetterStyle: '', answerStyle: '',
    writingNotes: '',
  });

  const s = (key: string) => (val: any) => setD(prev => ({ ...prev, [key]: val }));
  const step = STEPS[stepIdx];
  const stepNum = stepIdx; // actual step index
  const totalSteps = STEPS.length - 2;

  const handleResumeFile = async (file: File) => {
    setD(prev => ({ ...prev, resumeUploading: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await res.json().catch(() => ({ success: false, error: 'Server error' }));
      if (result.success || result.profile) {
        const extractedText = result.resume?.rawText || result.profile?.rawText || '';
        const workHist: any[] = result.resume?.workHistory || [];
        const eduList: any[] = result.resume?.educationEntries || [];
        const skillsList: string[] = result.resume?.skills || [];
        const techList: string[] = result.resume?.technologies || [];

        // Auto-populate form fields from parsed resume
        setD(prev => {
          const updates: any = {
            ...prev,
            resumes: [...prev.resumes.filter((r: any) => r.name !== file.name), { name: file.name, uploaded: true, extractedText }],
            resumeUploading: false,
          };

          // Auto-fill work history role 1 if available
          if (workHist.length > 0) {
            const w0 = workHist[0];
            updates.r1Title = w0.title || prev.r1Title;
            updates.r1Company = w0.company || prev.r1Company;
            updates.r1Start = w0.startDate ? w0.startDate.substring(0, 7) : prev.r1Start;
            updates.r1End = w0.endDate ? w0.endDate.substring(0, 7) : prev.r1End;
            updates.r1Current = w0.isCurrent ? 'yes' : prev.r1Current;
            updates.r1Summary = w0.summary || prev.r1Summary;
            updates.r1Skills = (w0.skills || []).join(', ') || prev.r1Skills;
            updates.r1Tech = (w0.technologies || []).join(', ') || prev.r1Tech;
          }
          if (workHist.length > 1) {
            const w1 = workHist[1];
            updates.r2Title = w1.title || prev.r2Title;
            updates.r2Company = w1.company || prev.r2Company;
            updates.r2Start = w1.startDate ? w1.startDate.substring(0, 7) : prev.r2Start;
            updates.r2End = w1.endDate ? w1.endDate.substring(0, 7) : prev.r2End;
            updates.r2Summary = w1.summary || prev.r2Summary;
            updates.r2Skills = (w1.skills || []).join(', ') || prev.r2Skills;
          }

          // Auto-fill education
          if (eduList.length > 0) {
            const e0 = eduList[0];
            updates.degree1Type = e0.degree || prev.degree1Type;
            updates.degree1Field = e0.fieldOfStudy || prev.degree1Field;
            updates.degree1School = e0.institution || prev.degree1School;
            updates.degree1Year = e0.endDate ? e0.endDate.substring(0, 4) : prev.degree1Year;
          }

          // Auto-fill skills from resume
          const allSkills = [...new Set([...skillsList, ...techList])];
          if (allSkills.length > 0 && !prev.technicalSkills) {
            updates.technicalSkills = allSkills.slice(0, 20);
          }

          return updates;
        });
      } else {
        setD(prev => ({ ...prev, resumeUploading: false }));
        alert('Upload failed: ' + (result.error || 'Unknown error. Please try again.'));
      }
    } catch (err) {
      setD(prev => ({ ...prev, resumeUploading: false }));
      alert('Upload failed — check your connection and try again.');
      console.error('Upload error:', err);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const reqs: Promise<any>[] = [];

      // Personal info
      reqs.push(fetch('/api/personal-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: d.fullName, preferredName: d.preferredName,
          email: d.email, phone: d.phone,
          addressLine1: d.addressLine1, city: d.city, state: d.state, zipCode: d.zipCode, country: d.country,
          linkedinUrl: d.linkedinUrl, githubUrl: d.githubUrl,
          portfolioUrl: d.websiteUrl,
          workAuthorization: d.workAuthorization,
          requiresSponsorship: d.requiresSponsorship === 'yes',
        }),
      }));

      // Job preferences
      const titles = d.targetTitles.split(',').map(s => s.trim()).filter(Boolean);
      reqs.push(fetch('/api/job-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTitles: titles,
          targetFunctions: d.targetFunctions,
          targetIndustries: d.targetIndustries,
          targetCompanyTypes: d.companyTypes,
          roleFamilies: [
            d.dataSci === 'yes' && 'analytics',
            d.crypto === 'yes' && 'crypto',
            d.fintech === 'yes' && 'fintech',
            d.ops === 'yes' && 'ops',
            d.mlai === 'yes' && 'ai_ml',
            d.automationExp && 'automation',
          ].filter(Boolean) as string[],
          salaryMinUSD: parseInt(d.salaryMin) || null,
          salaryMaxUSD: parseInt(d.salaryMax) || null,
          remotePreference: d.remotePreference,
          willingToRelocate: d.willingToRelocate === 'yes',
          preferredLocations: d.city ? [d.city] : [],
          seniority: d.seniority,
          fullTimeOk: d.fullTimeOk === 'yes',
          contractOk: d.contractOk === 'yes',
          partTimeOk: d.partTimeOk === 'yes',
        }),
      }));

      // Skills - collect ALL sources
      const allSkillsList = [
        ...d.programmingLanguages.split(','),
        ...d.databases.split(','),
        ...d.analyticsTools.split(','),
        ...d.cloudPlatforms.split(','),
        ...d.crmErp.split(','),
        ...d.projectMgmt.split(','),
        ...d.designTools.split(','),
        ...d.otherTech.split(','),
        ...d.softSkills.split(','),
        ...d.r1Skills.split(','),
        ...d.r2Skills.split(','),
      ].map(s => s.trim()).filter(Boolean);
      if (allSkillsList.length > 0) {
        reqs.push(fetch('/api/skills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills: [...new Set(allSkillsList)] }),
        }));
      }

      // Work history - role 1
      if (d.r1Title && d.r1Company) {
        reqs.push(fetch('/api/work-history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: d.r1Title, company: d.r1Company,
            startDate: d.r1Start ? new Date(d.r1Start + '-01') : new Date('2020-01-01'),
            endDate: d.r1Current === 'yes' ? null : (d.r1End ? new Date(d.r1End + '-01') : null),
            isCurrent: d.r1Current === 'yes',
            location: d.r1Location, isRemote: d.r1Remote === 'yes',
            summary: d.r1Summary,
            skills: d.r1Skills.split(',').map(s => s.trim()).filter(Boolean),
            technologies: d.r1Tech.split(',').map(s => s.trim()).filter(Boolean),
            bullets: d.r1Bullets.split('\n').filter(Boolean).map((b, i) => ({ content: b.replace(/^[-•]\s*/, '').trim(), sortOrder: i })),
          }),
        }));
      }

      // Role 2
      if (d.r2Title && d.r2Company) {
        reqs.push(fetch('/api/work-history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: d.r2Title, company: d.r2Company,
            startDate: d.r2Start ? new Date(d.r2Start + '-01') : new Date('2018-01-01'),
            endDate: d.r2End ? new Date(d.r2End + '-01') : null,
            isCurrent: false, summary: d.r2Summary,
            skills: d.r2Skills.split(',').map(s => s.trim()).filter(Boolean),
            bullets: d.r2Bullets.split('\n').filter(Boolean).map((b, i) => ({ content: b.replace(/^[-•]\s*/, '').trim(), sortOrder: i })),
          }),
        }));
      }

      // Education
      if (d.degree1School || d.degree1Type) {
        reqs.push(fetch('/api/education', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution: d.degree1School, degree: d.degree1Type,
            fieldOfStudy: d.degree1Field,
            endDate: d.degree1Year ? new Date(d.degree1Year + '-05-01') : null,
            gpa: d.degree1GPA, honors: d.degree1Honors,
          }),
        }));
      }

      // Writing preferences
      reqs.push(fetch('/api/writing-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toneWords: d.toneWords,
          avoidWords: d.avoidPhrases.split(',').map(s => s.trim()).filter(Boolean),
          positioningStatement: d.personalStatement || d.elevatorPitch,
        }),
      }));

      // Answer bank - save EVERY answer
      const answerPairs = [
        // Standard
        { key: 'work_authorization_us', family: 'legal', answer: ['us_citizen', 'green_card'].includes(d.workAuthorization) ? 'Yes' : 'No' },
        { key: 'requires_sponsorship', family: 'legal', answer: d.requiresSponsorship === 'yes' ? 'Yes' : 'No' },
        { key: 'veteran_status', family: 'eeo', answer: d.isVeteran },
        { key: 'disability_status', family: 'eeo', answer: d.hasDisability },
        { key: 'gender', family: 'eeo', answer: d.gender },
        { key: 'ethnicity', family: 'eeo', answer: d.ethnicity },
        { key: 'notice_period', family: 'logistics', answer: `${d.noticePeriodWeeks} weeks notice` },
        { key: 'available_start_date', family: 'logistics', answer: d.availableDate || `${d.noticePeriodWeeks} weeks after acceptance` },
        { key: 'linkedin_url', family: 'links', answer: d.linkedinUrl },
        { key: 'github_url', family: 'links', answer: d.githubUrl },
        { key: 'portfolio_url', family: 'links', answer: d.websiteUrl || d.portfolioLinks },
        { key: 'salary_expectation', family: 'compensation', answer: d.salaryMin ? `$${parseInt(d.salaryMin).toLocaleString()}${d.salaryMax ? ' - $' + parseInt(d.salaryMax).toLocaleString() : '+'}` : '' },
        { key: 'willing_to_relocate', family: 'logistics', answer: d.willingToRelocate === 'yes' ? 'Yes' : 'No' },
        { key: 'remote_preference', family: 'logistics', answer: { remote_only: 'Remote only', hybrid_ok: 'Open to hybrid or remote', onsite_ok: 'Open to onsite', any: 'Flexible' }[d.remotePreference] || d.remotePreference },
        // Behavioral
        { key: 'describe_yourself', family: 'experience', answer: d.elevatorPitch },
        { key: 'why_job_search', family: 'experience', answer: d.whyJobSearch },
        { key: 'greatest_achievement', family: 'experience', answer: d.greatestAchievement },
        { key: 'challenge_overcome', family: 'experience', answer: d.challengeOvercome },
        { key: 'leadership_example', family: 'experience', answer: d.leadershipExample },
        { key: 'conflict_resolution', family: 'experience', answer: d.conflictResolution },
        { key: 'five_year_plan', family: 'experience', answer: d.fiveYearPlan },
        { key: 'weaknesses', family: 'experience', answer: d.weaknesses },
        { key: 'why_this_role', family: 'experience', answer: d.whyThisRole },
        { key: 'why_this_company', family: 'experience', answer: d.whyThisCompany },
        { key: 'personal_statement', family: 'experience', answer: d.personalStatement },
        { key: 'strengths', family: 'experience', answer: d.biggestStrengths },
        { key: 'unique_value', family: 'experience', answer: d.uniqueValue },
        // Industry
        { key: 'crypto_experience', family: 'industry', answer: d.cryptoExperience },
        { key: 'fintech_experience', family: 'industry', answer: d.fintechExperience },
        { key: 'data_analytics_experience', family: 'industry', answer: d.dataAnalyticsExp },
      ].filter(a => a.answer && a.answer !== 'prefer_not' && a.answer !== '');

      for (const ans of answerPairs) {
        reqs.push(fetch('/api/answers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ans),
        }).catch(() => Promise.resolve()));
      }

      // Save cover letters as writing samples
      for (const cl of d.coverLetters) {
        reqs.push(fetch('/api/writing-samples', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Cover letter sample', type: 'cover_letter', content: cl }),
        }).catch(() => Promise.resolve()));
      }

      // Company targets
      if (d.companyCareerUrls) {
        const urls = d.companyCareerUrls.split('\n').map(u => u.trim()).filter(Boolean);
        reqs.push(fetch('/api/company-targets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companies: urls.map(url => ({ careerPageUrl: url })) }),
        }).catch(() => Promise.resolve()));
      }

      // Dream companies
      if (d.dreamCompanies) {
        const companies = d.dreamCompanies.split('\n').map(c => c.trim()).filter(Boolean);
        reqs.push(fetch('/api/job-preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyPriority: companies }),
        }).catch(() => Promise.resolve()));
      }

      // Flat profile
      reqs.push(fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: d.targetTitles.split(',')[0]?.trim() || d.r1Title,
          targetIndustries: d.targetIndustries,
          desiredSalaryMin: parseInt(d.salaryMin) || 0,
          desiredSalaryMax: parseInt(d.salaryMax) || 0,
          jobType: [d.remotePreference === 'remote_only' ? 'Remote' : 'Full-time'],
          willingToRelocate: d.willingToRelocate === 'yes',
          careerGoals: d.careerGoals,
          additionalInfo: d.hobbies,
          skills: allSkillsList,
          technologies: [d.r1Tech, d.programmingLanguages, d.databases].join(',').split(',').map(s => s.trim()).filter(Boolean),
          yearsExperience: d.r1Start ? Math.floor((Date.now() - new Date(d.r1Start + '-01').getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0,
        }),
      }));

      await Promise.all(reqs);
      setStepIdx(STEPS.length - 1);
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };

  const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx(i => Math.max(i - 1, 0));

  // ─── Render steps ──────────────────────────────────────────────────────────

  if (step.id === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
        <div className="max-w-xl text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', boxShadow: '0 8px 32px rgba(16,185,129,0.25)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Build your job-search profile</h1>
          <p className="text-slate-500 text-base leading-relaxed mb-6">
            This is not a quick setup. This is a comprehensive data collection - the more you provide, the more precisely Careeva can match jobs, write in your voice, and answer application questions correctly the first time.
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-8 text-left space-y-2">
            {[
              '📄 Resumes & cover letters (multiple)',
              '💼 Complete work history with bullet points',
              '🎓 Education, certifications, credentials',
              '⚡ Every skill, tool, and technology',
              '🎯 Detailed job preferences & company targets',
              '✍️ Career narrative & behavioral answers',
              '📋 Pre-answered standard application questions',
              '🎨 Your exact writing voice & style',
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-600">
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-4">Takes 15-20 minutes. Every field you fill improves automation quality.</p>
          <button onClick={next} className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}>
            Start Building My Profile →
          </button>
        </div>
      </div>
    );
  }

  if (step.id === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Profile complete.</h1>
          <p className="text-slate-500 mb-2">Careeva now has everything it needs to find, match, and apply to jobs for you - in your voice, with your actual experience.</p>
          <p className="text-slate-400 text-sm mb-8">You can always go back and add more. More data = better results.</p>
          <div className="space-y-3 mb-6">
            <button onClick={() => router.push('/dashboard/automation')}
              className="w-full py-3.5 rounded-2xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              ⚡ Run Auto-Apply Now
            </button>
            <button onClick={() => router.push('/dashboard/jobs')}
              className="w-full py-3 rounded-2xl text-slate-700 font-semibold bg-white border border-slate-200">
              Browse Job Feed
            </button>
            <button onClick={() => router.push('/dashboard/profile')}
              className="w-full py-3 rounded-2xl text-slate-500 font-medium text-sm bg-transparent">
              Add more profile details →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'linear-gradient(160deg,#f0fdf4,#eff6ff,#faf5ff)' }}>
      <div className="max-w-2xl mx-auto">
        <ProgressBar current={stepNum} total={totalSteps} />
        <div className="mb-8" />

        {/* RESUME UPLOAD */}
        {step.id === 'resume_upload' && (
          <StepCard step={step}>
            <UploadZone label="Upload resume (PDF or DOCX)" onFile={handleResumeFile} uploaded={d.resumes.length > 0}
              uploading={d.resumeUploading}
              fileName={d.resumes[d.resumes.length - 1]?.name}
              extractedText={d.resumes[d.resumes.length - 1]?.extractedText}
              hint="Upload your primary resume. Skills and experience will be auto-extracted." />
            {d.resumes.length > 0 && d.resumes.map((r, i) => (
              <div key={i} className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">&#10003; {r.name}</div>
            ))}
            <TA label="Paste additional resume text (optional - if you have multiple versions)" value={d.resumeText} onChange={s('resumeText')}
              hint="Paste the text of a different resume variant here. The more versions you provide, the more the system learns about your full experience."
              placeholder="Paste resume text here..." rows={6} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* COVER LETTERS */}
        {step.id === 'cover_letters' && (
          <StepCard step={step}>
            {d.coverLetters.map((cl, i) => (
              <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-emerald-700">Cover letter {i + 1}</span>
                  <button onClick={() => setD(prev => ({ ...prev, coverLetters: prev.coverLetters.filter((_, j) => j !== i) }))} className="text-xs text-red-400">Remove</button>
                </div>
                <p className="text-xs text-emerald-600 line-clamp-2">{cl.slice(0, 150)}...</p>
              </div>
            ))}
            <TA label="Paste a cover letter" value={d.coverLetterInput} onChange={s('coverLetterInput')}
              hint="Paste cover letters you have written before. Each one teaches the system your writing voice and what language resonates with employers."
              placeholder="Paste full cover letter text here..." rows={10} />
            <div className="flex gap-3">
              {d.coverLetterInput && (
                <button onClick={() => setD(prev => ({ ...prev, coverLetters: [...prev.coverLetters, prev.coverLetterInput], coverLetterInput: '' }))}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  + Save this cover letter
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">Add as many as you have. They are analyzed for tone, structure, and vocabulary.</p>
            <NavBar onBack={back} onNext={async () => {
              for (const cl of d.coverLetters) {
                await fetch('/api/writing-samples', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Cover letter sample', type: 'cover_letter', content: cl }) }).catch(() => {});
              }
              next();
            }} nextLabel={d.coverLetters.length > 0 ? `Save ${d.coverLetters.length} & continue →` : 'Skip for now →'} />
          </StepCard>
        )}

        {/* PORTFOLIO */}
        {step.id === 'portfolio_links' && (
          <StepCard step={step}>
            <Inp label="Portfolio / personal website URL" value={d.portfolioLinks} onChange={s('portfolioLinks')} placeholder="https://yourportfolio.com" />
            <Inp label="GitHub profile URL" value={d.githubUrl} onChange={s('githubUrl')} placeholder="https://github.com/username" />
            <TA label="Writing samples / published work (one URL per line)" value={d.writingSampleLinks} onChange={s('writingSampleLinks')}
              hint="Links to articles, blog posts, reports, or any written work you want referenced in applications."
              placeholder="https://medium.com/your-article&#10;https://substack.com/your-post" rows={3} />
            <TA label="Case studies or project links (one URL per line)" value={d.caseStudyLinks} onChange={s('caseStudyLinks')}
              placeholder="https://github.com/project&#10;https://notion.so/case-study" rows={3} />
            <NavBar onBack={back} onNext={next} nextLabel="Continue →" />
          </StepCard>
        )}

        {/* CONTACT */}
        {step.id === 'contact_info' && (
          <StepCard step={step}>
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Full legal name" value={d.fullName} onChange={s('fullName')} req placeholder="Zach Bienstock" />
              <Inp label="Preferred name" value={d.preferredName} onChange={s('preferredName')} placeholder="Zach" hint="Used in personalized greetings" />
              <Inp label="Email address" type="email" value={d.email} onChange={s('email')} req />
              <Inp label="Phone number" value={d.phone} onChange={s('phone')} placeholder="+1 (555) 000-0000" />
              <Inp label="Street address" value={d.addressLine1} onChange={s('addressLine1')} placeholder="123 Main St" />
              <Inp label="City" value={d.city} onChange={s('city')} placeholder="New York" />
              <Inp label="State" value={d.state} onChange={s('state')} placeholder="NY" />
              <Inp label="ZIP code" value={d.zipCode} onChange={s('zipCode')} placeholder="10001" />
              <div className="col-span-2">
                <Inp label="LinkedIn profile URL" value={d.linkedinUrl} onChange={s('linkedinUrl')} req placeholder="https://linkedin.com/in/username" />
              </div>
              <Inp label="Pronouns (optional)" value={d.pronouns} onChange={s('pronouns')} placeholder="he/him, she/her, they/them..." />
            </div>
            <NavBar onBack={back} onNext={next} nextDisabled={!d.fullName || !d.email} />
          </StepCard>
        )}

        {/* DEMOGRAPHICS */}
        {step.id === 'demographics' && (
          <StepCard step={step}>
            <Radio label="US work authorization" value={d.workAuthorization} onChange={s('workAuthorization')} options={[
              { value: 'us_citizen', label: 'US Citizen' }, { value: 'green_card', label: 'Green Card / LPR' },
              { value: 'h1b', label: 'H-1B' }, { value: 'opt', label: 'OPT / CPT' }, { value: 'tn', label: 'TN Visa' }, { value: 'other', label: 'Other' },
            ]} />
            <Radio label="Will you require visa sponsorship?" value={d.requiresSponsorship} onChange={s('requiresSponsorship')} options={[
              { value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }, { value: 'maybe', label: 'In the future' },
            ]} />
            <Inp label="Citizenship country" value={d.citizenshipCountry} onChange={s('citizenshipCountry')} placeholder="US" />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Notice period (weeks)" type="number" value={d.noticePeriodWeeks} onChange={s('noticePeriodWeeks')} />
              <MonthYearPicker label="Earliest available date (optional)" value={d.availableDate} onChange={s('availableDate')} />
            </div>
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equal Opportunity / Voluntary Disclosures</p>
              <p className="text-xs text-slate-400">These answers are stored and auto-filled when applications ask for them. They have no effect on Careeva's matching.</p>
              <Radio label="Veteran status" value={d.isVeteran} onChange={s('isVeteran')} options={[
                { value: 'protected_veteran', label: 'Protected veteran' }, { value: 'active_duty', label: 'Active duty' },
                { value: 'no', label: 'Not a veteran' }, { value: 'prefer_not', label: 'Prefer not to disclose' },
              ]} />
              <Radio label="Disability status" value={d.hasDisability} onChange={s('hasDisability')} options={[
                { value: 'yes', label: 'Yes, I have a disability' }, { value: 'no', label: 'No disability' }, { value: 'prefer_not', label: 'Prefer not to disclose' },
              ]} />
              <Radio label="Gender identity" value={d.gender} onChange={s('gender')} options={[
                { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'nonbinary', label: 'Non-binary' },
                { value: 'other', label: 'Other' }, { value: 'prefer_not', label: 'Prefer not to disclose' },
              ]} />
              <Radio label="Race / ethnicity" value={d.ethnicity} onChange={s('ethnicity')} options={[
                { value: 'white', label: 'White' }, { value: 'asian', label: 'Asian' }, { value: 'black', label: 'Black / African American' },
                { value: 'hispanic', label: 'Hispanic / Latino' }, { value: 'mixed', label: 'Two or more races' },
                { value: 'native', label: 'Native American' }, { value: 'prefer_not', label: 'Prefer not to disclose' },
              ]} />
            </div>
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* WORK HISTORY 1 */}
        {step.id === 'work_history_1' && (
          <StepCard step={step}>
            {d.resumes.length > 0 && d.r1Title ? (
              <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100 mb-1">
                ✓ Auto-filled from your resume — review and edit anything that looks wrong.
              </p>
            ) : d.resumes.length > 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100 mb-1">
                ℹ️ Resume uploaded but positions couldn't be auto-detected — please fill in manually.
              </p>
            ) : (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                💡 Be thorough — every detail feeds directly into your cover letters and application answers.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Job title" value={d.r1Title} onChange={s('r1Title')} req placeholder="Senior Data Analyst" />
              <Inp label="Company name" value={d.r1Company} onChange={s('r1Company')} req placeholder="Acme Corp" />
              <MonthYearPicker label="Start date" value={d.r1Start} onChange={s('r1Start')} />
              <MonthYearPicker label="End date" value={d.r1End} onChange={s('r1End')} hint="Leave blank if current" />
              <Inp label="Location" value={d.r1Location} onChange={s('r1Location')} placeholder="New York, NY" />
              <Radio label="Remote?" value={d.r1Remote} onChange={s('r1Remote')} options={['yes', 'no', 'hybrid']} />
              <Inp label="Team size" type="number" value={d.r1TeamSize} onChange={s('r1TeamSize')} placeholder="12" />
              <Inp label="Reports / direct reports" type="number" value={d.r1Reports} onChange={s('r1Reports')} placeholder="0" />
            </div>
            <Radio label="Is this your current role?" value={d.r1Current} onChange={s('r1Current')} options={[{ value: 'yes', label: 'Yes, current' }, { value: 'no', label: 'No' }]} />
            <TA label="Role summary" value={d.r1Summary} onChange={s('r1Summary')} req
              hint="Describe what you owned, what you built, what you improved, and the scope of your impact."
              placeholder="Led end-to-end analytics for a $50M product line. Owned data infrastructure, reporting, and cross-functional insight delivery..." rows={4} />
            <TA label="Bullet points (one per line)" value={d.r1Bullets} onChange={s('r1Bullets')}
              hint="Your resume bullet points. One per line. Include metrics. These go directly into cover letters and answers."
              placeholder="• Built automated reporting system that reduced analyst time by 60%&#10;• Managed $2M analytics budget across 3 product lines&#10;• Led migration to Snowflake, reducing query time by 40%&#10;• Partnered with VP to design KPI framework adopted org-wide" rows={8} />
            <TA label="Key achievements with numbers" value={d.r1Achievements} onChange={s('r1Achievements')}
              hint="Anything with a metric that didn't make it into the bullets. The more quantified wins you give us, the better your applications."
              placeholder="Increased revenue by $X, reduced costs by Y%, led team of Z people, managed $X budget..." rows={4} />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Skills used" value={d.r1Skills} onChange={s('r1Skills')} placeholder="SQL, Python, Tableau, Excel..." />
              <Inp label="Technologies used" value={d.r1Tech} onChange={s('r1Tech')} placeholder="Snowflake, dbt, Looker, AWS..." />
            </div>
            <NavBar onBack={back} onNext={next} nextDisabled={!d.r1Title || !d.r1Company} />
          </StepCard>
        )}

        {/* WORK HISTORY 2 */}
        {step.id === 'work_history_2' && (
          <StepCard step={step}>
            <p className="text-xs text-slate-400">Add your second most recent role below. Then add remaining roles in the text area at the bottom.</p>
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Job title" value={d.r2Title} onChange={s('r2Title')} placeholder="Data Analyst" />
              <Inp label="Company name" value={d.r2Company} onChange={s('r2Company')} placeholder="Previous Company" />
              <MonthYearPicker label="Start date" value={d.r2Start} onChange={s('r2Start')} />
              <MonthYearPicker label="End date" value={d.r2End} onChange={s('r2End')} />
            </div>
            <TA label="Role summary" value={d.r2Summary} onChange={s('r2Summary')} placeholder="What did you own and accomplish in this role?" rows={3} />
            <TA label="Bullet points (one per line)" value={d.r2Bullets} onChange={s('r2Bullets')} placeholder="• Built X that achieved Y&#10;• Led initiative that resulted in Z" rows={5} />
            <Inp label="Skills used" value={d.r2Skills} onChange={s('r2Skills')} placeholder="Skills, tools, technologies..." />
            <TA label="Additional roles (earlier in your career - paste or summarize)" value={d.additionalRoles} onChange={s('additionalRoles')}
              hint="Include company, title, dates, and 1-2 key accomplishments per role. Everything you add improves matching."
              placeholder="2018-2019: Operations Coordinator at XYZ. Managed logistics for 50+ client accounts. Reduced fulfillment errors by 30%.&#10;2016-2018: Business Analyst at ABC. Built dashboards used by C-suite. Saved $200K through process optimization." rows={6} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* ACHIEVEMENTS */}
        {step.id === 'achievements' && (
          <StepCard step={step}>
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
              These are your highlight reel. The more specific and quantified, the more compelling your applications.
            </p>
            {[1, 2, 3, 4, 5].map(n => (
              <TA key={n} label={`Achievement ${n}`} value={(d as any)[`achievement${n}`]} onChange={s(`achievement${n}`)}
                hint={n === 1 ? "Format: What you did, how you did it, what the measurable result was" : undefined}
                placeholder={[
                  "Led migration from Excel to Snowflake for 50-person analytics team. Reduced report generation time from 4 hours to 15 minutes. Saved $180K/year in analyst time.",
                  "Built automated customer churn prediction model with 87% accuracy. Enabled proactive outreach that recovered $2.3M in at-risk revenue.",
                  "Managed cross-functional launch of new pricing strategy across 5 product lines. Generated $4.2M incremental ARR in first 6 months.",
                  "Designed and implemented OKR framework adopted by 200+ person organization. Increased goal completion rate from 42% to 78%.",
                  "",
                ][n - 1]}
                rows={3} />
            ))}
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* EDUCATION */}
        {step.id === 'education' && (
          <StepCard step={step}>
            <div className="space-y-4 p-4 bg-white rounded-2xl border border-slate-100">
              <p className="text-sm font-bold text-slate-700">Primary degree</p>
              <div className="grid grid-cols-2 gap-4">
                <Radio label="Degree type" value={d.degree1Type} onChange={s('degree1Type')} options={["Bachelor's", "Master's", "PhD", "Associate's", "MBA", "JD", "MD", "Bootcamp", "Self-taught", "Other"]} />
                <Inp label="Field of study" value={d.degree1Field} onChange={s('degree1Field')} placeholder="Computer Science, Finance, Economics..." />
                <Inp label="Institution" value={d.degree1School} onChange={s('degree1School')} placeholder="University of..." />
                <Inp label="Graduation year" type="number" value={d.degree1Year} onChange={s('degree1Year')} placeholder="2020" />
                <Inp label="GPA (optional)" value={d.degree1GPA} onChange={s('degree1GPA')} placeholder="3.8" />
                <Inp label="Honors / distinctions" value={d.degree1Honors} onChange={s('degree1Honors')} placeholder="Summa Cum Laude, Dean's List..." />
              </div>
            </div>
            <div className="space-y-4 p-4 bg-white rounded-2xl border border-slate-100">
              <p className="text-sm font-bold text-slate-700">Secondary degree (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <Inp label="Degree type" value={d.degree2Type} onChange={s('degree2Type')} placeholder="Master's, MBA..." />
                <Inp label="Field of study" value={d.degree2Field} onChange={s('degree2Field')} placeholder="Data Science..." />
                <Inp label="Institution" value={d.degree2School} onChange={s('degree2School')} />
                <Inp label="Graduation year" type="number" value={d.degree2Year} onChange={s('degree2Year')} />
              </div>
            </div>
            <TA label="Bootcamps, online courses, continuing education" value={d.bootcamps} onChange={s('bootcamps')}
              hint="Include any completed courses, nanodegrees, or professional development that is relevant."
              placeholder="Google Data Analytics Certificate (2022)&#10;Coursera Machine Learning Specialization (2021)&#10;Le Wagon Data Science Bootcamp (2020)" rows={4} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* CERTIFICATIONS */}
        {step.id === 'certifications' && (
          <StepCard step={step}>
            <TA label="Certifications & credentials (one per line)" value={d.certs} onChange={s('certs')}
              hint="Include every certification, license, or credential - technical, professional, industry-specific."
              placeholder="AWS Certified Solutions Architect (2023)&#10;PMP - Project Management Professional (2022)&#10;Series 65 - Investment Advisor (2021)&#10;Google Analytics Certified&#10;Salesforce Administrator Certification&#10;CFA Level 1 (in progress)" rows={8} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* TECHNICAL SKILLS */}
        {step.id === 'skills_technical' && (
          <StepCard step={step}>
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100 mb-2">
              Add everything. Include tools you used briefly. The system filters by proficiency level, not just presence.
            </p>
            <div className="grid grid-cols-1 gap-4">
              <Inp label="Programming languages" value={d.programmingLanguages} onChange={s('programmingLanguages')} placeholder="Python, SQL, R, JavaScript, Scala, Java..." />
              <Inp label="Databases & data warehouses" value={d.databases} onChange={s('databases')} placeholder="PostgreSQL, MySQL, Snowflake, BigQuery, Redshift, MongoDB..." />
              <Inp label="Analytics & BI tools" value={d.analyticsTools} onChange={s('analyticsTools')} placeholder="Tableau, Looker, Power BI, Mode, Metabase, dbt, Pandas..." />
              <Inp label="Cloud platforms" value={d.cloudPlatforms} onChange={s('cloudPlatforms')} placeholder="AWS, GCP, Azure, Databricks..." />
              <Inp label="CRM / ERP / business systems" value={d.crmErp} onChange={s('crmErp')} placeholder="Salesforce, HubSpot, SAP, Workday, NetSuite, Stripe..." />
              <Inp label="Project management & collaboration" value={d.projectMgmt} onChange={s('projectMgmt')} placeholder="Jira, Notion, Asana, Linear, Confluence, Monday.com..." />
              <Inp label="Design & creative tools (if relevant)" value={d.designTools} onChange={s('designTools')} placeholder="Figma, Sketch, Adobe Creative Suite..." />
              <Inp label="Other tools & technologies" value={d.otherTech} onChange={s('otherTech')} placeholder="Docker, Git, Airflow, Kafka, Spark, Terraform..." />
            </div>
            <NavBar onBack={back} onNext={next} nextDisabled={!d.programmingLanguages && !d.analyticsTools} />
          </StepCard>
        )}

        {/* SOFT SKILLS */}
        {step.id === 'skills_soft' && (
          <StepCard step={step}>
            <TA label="Soft skills & professional competencies" value={d.softSkills} onChange={s('softSkills')}
              hint="Think beyond buzzwords - describe your actual capabilities."
              placeholder="Executive stakeholder communication, cross-functional project leadership, data storytelling, translating complex analysis for non-technical audiences, building trust with C-suite..." rows={4} />
            <TA label="Leadership & management experience" value={d.leadershipExp} onChange={s('leadershipExp')}
              hint="Include formal management, informal leadership, mentorship, project leadership."
              placeholder="Managed team of 5 analysts. Led cross-functional working group of 15. Mentored 3 junior analysts who were promoted within 18 months..." rows={4} />
            <TA label="Analytical & quantitative capabilities" value={d.analyticsExp} onChange={s('analyticsExp')}
              placeholder="Statistical modeling, A/B testing, financial modeling, forecasting, cohort analysis, funnel analysis, attribution modeling..." rows={3} />
            <TA label="Operations & process expertise" value={d.operationsExp} onChange={s('operationsExp')}
              placeholder="Supply chain, fulfillment, process mapping, Six Sigma, workflow automation, vendor management..." rows={3} />
            <TA label="Client-facing & commercial experience" value={d.clientFacing} onChange={s('clientFacing')}
              placeholder="Enterprise sales support, customer success, account management, revenue operations, contract negotiation..." rows={3} />
            <TA label="AI & automation experience" value={d.aiToolsExp} onChange={s('aiToolsExp')}
              placeholder="Prompt engineering, LLM integration, GPT API usage, automation with Zapier/Make, RPA tools, ML model deployment..." rows={3} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* DOMAIN KNOWLEDGE */}
        {step.id === 'skills_domain' && (
          <StepCard step={step}>
            <p className="text-xs text-slate-400 mb-2">Mark each domain where you have real, demonstrable experience.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'fintech', label: 'Fintech / Payments' },
                { key: 'crypto', label: 'Crypto / Web3 / DeFi' },
                { key: 'healthtech', label: 'Health Tech / BioTech' },
                { key: 'saas', label: 'SaaS / B2B Software' },
                { key: 'ecommerce', label: 'E-commerce / Retail' },
                { key: 'dataSci', label: 'Data Science / ML' },
                { key: 'mlai', label: 'AI / LLMs / NLP' },
                { key: 'ops', label: 'Operations / Supply Chain' },
                { key: 'productMgmt', label: 'Product Management' },
                { key: 'bizDev', label: 'Business Development' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => s(key)((d as any)[key] === 'yes' ? 'no' : 'yes')}
                  className={`p-3 rounded-xl text-sm font-semibold border transition-all text-left ${(d as any)[key] === 'yes' ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white'}`}
                  style={(d as any)[key] === 'yes' ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' } : {}}>
                  {label}
                </button>
              ))}
            </div>
            <TA label="Describe your deepest domain expertise in detail" value={d.domainDepth} onChange={s('domainDepth')}
              hint="For your primary 1-2 domains, write 2-3 sentences about the depth of your knowledge."
              placeholder="For fintech: I have worked in payments processing for 4 years. I understand the full stack from card networks and interchange to merchant acquiring and fraud detection. I have built reporting systems for a $2B payments platform..." rows={5} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* JOB PREFERENCES */}
        {step.id === 'job_preferences' && (
          <StepCard step={step}>
            <TA label="Target job titles (comma-separated)" value={d.targetTitles} onChange={s('targetTitles')} req
              hint="List every title you would accept. The more you list, the broader the job discovery net."
              placeholder="Data Analyst, Senior Data Analyst, Business Intelligence Analyst, Analytics Engineer, Operations Analyst, Strategy & Analytics, Data & Insights Lead..." rows={2} />
            <Multi label="Target functions" values={d.targetFunctions} onChange={s('targetFunctions')} options={['Analytics', 'Operations', 'Finance', 'Product', 'Engineering', 'Strategy', 'Sales Ops', 'RevOps', 'Customer Success', 'Data Science', 'Business Intelligence', 'Growth']} />
            <Multi label="Target industries" values={d.targetIndustries} onChange={s('targetIndustries')} options={['Technology', 'Fintech', 'Crypto / Web3', 'Healthcare', 'E-commerce', 'Media', 'Consulting', 'Financial Services', 'Real Estate', 'Government', 'Non-profit', 'Education', 'Retail', 'Energy', 'Travel']} />
            <Multi label="Target seniority level" values={d.seniority} onChange={s('seniority')} options={['Entry Level (0-2 yrs)', 'Mid Level (2-5 yrs)', 'Senior (5-8 yrs)', 'Staff / Lead', 'Manager', 'Director', 'VP', 'C-Suite']} />
            <Radio label="Work arrangement" value={d.remotePreference} onChange={s('remotePreference')} options={[
              { value: 'remote_only', label: 'Remote only' }, { value: 'hybrid_ok', label: 'Hybrid OK' },
              { value: 'onsite_ok', label: 'Open to onsite' }, { value: 'any', label: 'Flexible' },
            ]} />
            <div className="grid grid-cols-3 gap-3">
              <Radio label="Full-time?" value={d.fullTimeOk} onChange={s('fullTimeOk')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
              <Radio label="Contract?" value={d.contractOk} onChange={s('contractOk')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
              <Radio label="Part-time?" value={d.partTimeOk} onChange={s('partTimeOk')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
            </div>
            <Radio label="Open to relocation?" value={d.willingToRelocate} onChange={s('willingToRelocate')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'maybe', label: 'Maybe' }]} />
            <NavBar onBack={back} onNext={next} nextDisabled={!d.targetTitles} />
          </StepCard>
        )}

        {/* COMPANY PREFERENCES */}
        {step.id === 'company_preferences' && (
          <StepCard step={step}>
            <TA label="Dream companies / companies you want to work at (one per line)" value={d.dreamCompanies} onChange={s('dreamCompanies')}
              hint="The system will auto-discover open roles at these companies."
              placeholder="Stripe&#10;Coinbase&#10;Plaid&#10;Brex&#10;Chime&#10;OpenAI&#10;Anthropic" rows={6} />
            <TA label="Direct career page URLs (one per line)" value={d.companyCareerUrls} onChange={s('companyCareerUrls')}
              hint="Paste Greenhouse or Lever career page URLs for instant job sync."
              placeholder="https://boards.greenhouse.io/stripe&#10;https://jobs.lever.co/plaid&#10;https://boards.greenhouse.io/coinbase" rows={5} />
            <Multi label="Company types you prefer" values={d.companyTypes} onChange={s('companyTypes')} options={['Startup (Seed-Series B)', 'Growth Stage (Series C+)', 'Late Stage / Pre-IPO', 'Public Company', 'Enterprise / Fortune 500', 'Non-profit / Mission-driven', 'Agency / Consulting', 'Family-owned / SMB']} />
            <Multi label="Company size preference" values={d.companySize} onChange={s('companySize')} options={['1-10', '11-50', '51-200', '201-500', '501-2000', '2001-10000', '10000+']} />
            <TA label="Companies or types of companies to avoid" value={d.avoidCompanies} onChange={s('avoidCompanies')}
              placeholder="MLM companies, specific industries, company names..." rows={2} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* COMPENSATION */}
        {step.id === 'compensation' && (
          <StepCard step={step}>
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Minimum acceptable salary (USD)" type="number" value={d.salaryMin} onChange={s('salaryMin')} req placeholder="80000" hint="The floor below which you will not accept" />
              <Inp label="Target / ideal salary (USD)" type="number" value={d.salaryMax} onChange={s('salaryMax')} placeholder="120000" hint="What you are actually targeting" />
            </div>
            <Radio label="How important is equity/stock?" value={d.equityImportance} onChange={s('equityImportance')} options={[
              { value: 'critical', label: 'Critical - equity-first' },
              { value: 'important', label: 'Important factor' },
              { value: 'nice_to_have', label: 'Nice to have' },
              { value: 'not_important', label: 'Not a factor' },
            ]} />
            <TA label="Benefits priorities (what matters most to you)" value={d.benefitsPriorities} onChange={s('benefitsPriorities')}
              placeholder="Full remote flexibility, strong 401k match, generous PTO, health/dental/vision, stipends for home office or learning, parental leave, equity/ESPP..." rows={3} />
            <NavBar onBack={back} onNext={next} nextDisabled={!d.salaryMin} />
          </StepCard>
        )}

        {/* CAREER NARRATIVE */}
        {step.id === 'career_narrative' && (
          <StepCard step={step}>
            <TA label="Elevator pitch - how you describe yourself in 2-3 sentences" value={d.elevatorPitch} onChange={s('elevatorPitch')} req
              hint="This becomes your default 'tell me about yourself' answer and is used in cover letter openers."
              placeholder="I am a data professional with 6 years of experience turning messy data into business decisions. I specialize in building analytics systems at fintech and crypto companies, and I have a track record of shipping work that directly influences product strategy and revenue." rows={4} />
            <TA label="Why are you looking for a new role right now?" value={d.whyJobSearch} onChange={s('whyJobSearch')}
              hint="Used to authentically explain transitions. Be honest - the system uses this to frame your story correctly."
              placeholder="After 4 years at the same company, I have maxed out the growth trajectory and am looking for a role with greater scope and impact. I want to work at a faster-moving company where data is more central to decision-making." rows={4} />
            <TA label="Your career goals for the next 3-5 years" value={d.careerGoals} onChange={s('careerGoals')}
              placeholder="I want to move into a Head of Analytics role at a growth-stage company. In 5 years, I see myself either as a VP-level data leader or founding the data function at a Series A/B company." rows={3} />
            <TA label="What makes you distinctly valuable? Your unique edge." value={d.uniqueValue} onChange={s('uniqueValue')} req
              hint="What can you do that most people with your title cannot? This is your differentiator."
              placeholder="I can communicate complex analysis to non-technical executives in a way that drives actual decisions - not just nods. I have built end-to-end data pipelines and dashboards from scratch, which means I understand the full stack from ingestion to insight." rows={4} />
            <TA label="Full personal / professional statement" value={d.personalStatement} onChange={s('personalStatement')}
              hint="A longer version (4-5 sentences) used in cover letters and long-form answer fields."
              placeholder="A comprehensive statement about who you are professionally, what you have built, what you are looking for, and why you are a strong candidate for your target roles..." rows={5} />
            <NavBar onBack={back} onNext={next} nextDisabled={!d.elevatorPitch || !d.uniqueValue} />
          </StepCard>
        )}

        {/* PROJECTS */}
        {step.id === 'accomplishments' && (
          <StepCard step={step}>
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">These are used when applications ask for specific examples of your work.</p>
            {[1, 2, 3].map(n => (
              <div key={n} className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                <p className="text-sm font-bold text-slate-700">Project / Case Study {n}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Inp label="Project name" value={(d as any)[`project${n}Name`]} onChange={s(`project${n}Name`)} placeholder="Customer Churn Prediction Model" />
                  <Inp label="Technologies used" value={(d as any)[`project${n}Tech`]} onChange={s(`project${n}Tech`)} placeholder="Python, XGBoost, Snowflake..." />
                </div>
                <TA label="Description" value={(d as any)[`project${n}Desc`]} onChange={s(`project${n}Desc`)}
                  placeholder="What you built, the problem it solved, your specific contribution..." rows={3} />
                <TA label="Impact & results" value={(d as any)[`project${n}Impact`]} onChange={s(`project${n}Impact`)}
                  placeholder="Quantified outcomes - revenue saved, time reduced, users impacted, decisions influenced..." rows={2} />
              </div>
            ))}
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* INTERESTS */}
        {step.id === 'interests_background' && (
          <StepCard step={step}>
            <TA label="Hobbies & personal interests" value={d.hobbies} onChange={s('hobbies')}
              hint="These can appear in cover letter closings and make you a more memorable candidate."
              placeholder="Distance running, building side projects in Go, reading about macro economics, amateur poker player, Brazilian jiu-jitsu..." rows={3} />
            <TA label="Volunteer work & community involvement" value={d.volunteerWork} onChange={s('volunteerWork')}
              placeholder="Code.org mentor (2021-present). Habitat for Humanity project lead. Local blockchain meetup organizer." rows={3} />
            <TA label="Side projects (personal or professional)" value={d.sideProjects} onChange={s('sideProjects')}
              hint="Include GitHub repos, apps you have built, experiments, writing, podcasts, anything you have created."
              placeholder="Built a crypto portfolio tracker with 200+ users. Wrote a newsletter about data engineering with 1,400 subscribers. Built and sold an e-commerce store..." rows={4} />
            <TA label="Personal values (what matters to you in a workplace)" value={d.personalValues} onChange={s('personalValues')}
              placeholder="Autonomy, ownership, rapid iteration, intellectual honesty, strong documentation culture, diverse teams, mission-driven work, learning budget..." rows={3} />
            <TA label="Fun fact or memorable personal detail" value={d.funFact} onChange={s('funFact')}
              hint="Optional - but a good one makes cover letters more human."
              placeholder="I ran my first marathon at 32 while working full time and completing an online ML course. I have visited 47 countries. I taught myself to code at 28 with no formal background..." rows={2} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* STANDARD BEHAVIORAL ANSWERS */}
        {step.id === 'standard_questions' && (
          <StepCard step={step}>
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100 mb-2">
              These answers are stored and reused across all applications. Write them once, get them auto-inserted everywhere.
            </p>
            <TA label='"Tell me about yourself" - 3-4 sentence professional summary' value={d.elevatorPitch} onChange={s('elevatorPitch')} rows={4} />
            <TA label='"What is your greatest professional achievement?"' value={d.greatestAchievement} onChange={s('greatestAchievement')}
              hint="Use the STAR format: Situation, Task, Action, Result. Include a metric."
              placeholder="When I joined XYZ, the analytics team was spending 20 hours per week manually pulling reports... I built an automated pipeline that... resulting in a 95% reduction in manual effort and saving $140K/year in analyst time." rows={5} />
            <TA label='"Describe a challenge you overcame"' value={d.challengeOvercome} onChange={s('challengeOvercome')} placeholder="Situation, what was at stake, your specific approach, the outcome..." rows={4} />
            <TA label='"Give an example of leadership or influencing without authority"' value={d.leadershipExample} onChange={s('leadershipExample')} rows={4} />
            <TA label='"Describe a time you handled a conflict or difficult stakeholder"' value={d.conflictResolution} onChange={s('conflictResolution')} rows={4} />
            <TA label='"Where do you see yourself in 5 years?"' value={d.fiveYearPlan} onChange={s('fiveYearPlan')} placeholder="Tie your answer to the type of role you are targeting..." rows={3} />
            <TA label='"What is your biggest weakness?"' value={d.weaknesses} onChange={s('weaknesses')}
              hint="Be honest but frame it as something you are actively improving."
              placeholder="Early in my career I would over-engineer solutions before validating the problem. I now... (specific practice you have adopted to address it)" rows={3} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* BEHAVIORAL ANSWERS */}
        {step.id === 'behavioral_answers' && (
          <StepCard step={step}>
            <TA label='"Why are you interested in this role?" (template)' value={d.whyThisRole} onChange={s('whyThisRole')}
              hint="Write a template - the system will customize it per application."
              placeholder="I am drawn to this role because [it aligns with my background in X and my goal to Y]. The opportunity to [do Z] is particularly compelling given my experience with [specific thing]." rows={4} />
            <TA label='"Why do you want to work at [Company]?" (template)' value={d.whyThisCompany} onChange={s('whyThisCompany')}
              placeholder="I have followed [Company] since [specific thing that shows genuine knowledge]. What draws me most is [specific aspect of their product, culture, or mission] because [authentic reason tied to your experience or values]." rows={4} />
            <TA label='"What salary are you expecting?"' value={d.salaryAnswer} onChange={s('salaryAnswer')}
              placeholder="Based on my experience and current market data, I am targeting $[X]-$[Y]. I am open to discussing the full compensation package." rows={2} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* INDUSTRY-SPECIFIC */}
        {step.id === 'industry_answers' && (
          <StepCard step={step}>
            <p className="text-xs text-slate-400 mb-2">These are used when applications ask industry-specific questions. Fill in only the ones relevant to your target roles.</p>
            <TA label="Describe your crypto / Web3 / blockchain experience" value={d.cryptoExperience} onChange={s('cryptoExperience')}
              placeholder="I have worked in crypto since 2021 at [Company]. My experience spans [DeFi, NFTs, L1/L2, token economics, smart contracts, trading infrastructure, compliance/AML]... Specific projects: ..." rows={5} />
            <TA label="Describe your fintech / payments / financial services experience" value={d.fintechExperience} onChange={s('fintechExperience')}
              placeholder="My fintech background includes... I have worked with [payment rails, interchange, card networks, lending, banking APIs, compliance]..." rows={5} />
            <TA label="Describe your data analytics experience in depth" value={d.dataAnalyticsExp} onChange={s('dataAnalyticsExp')}
              placeholder="My analytics experience includes... I have built [data models, dashboards, pipelines, ML models]... The tools I am most proficient in are... I have presented analysis to [C-suite, investors, clients]..." rows={5} />
            <TA label="Any other industry-specific context you want pre-written" value={d.industryAnswer1} onChange={s('industryAnswer1')}
              placeholder="Healthcare, operations, e-commerce, real estate, government, consulting - write your domain experience here..." rows={5} />
            <NavBar onBack={back} onNext={next} />
          </StepCard>
        )}

        {/* WRITING STYLE */}
        {step.id === 'writing_style' && (
          <StepCard step={step}>
            <Multi label="How would you describe your professional writing voice?" values={d.toneWords} onChange={s('toneWords')} options={['Direct', 'Concise', 'Warm', 'Analytical', 'Data-driven', 'Strategic', 'Humble', 'Confident', 'Human', 'Formal', 'Casual', 'Creative', 'Precise']} />
            <TA label="Phrases, words, or styles to AVOID in your applications" value={d.avoidPhrases} onChange={s('avoidPhrases')}
              hint="Words and phrases that don't sound like you - the system will never use them."
              placeholder="passionate, synergy, leverage, rockstar, ninja, disruptive, utilize, stakeholders, impactful, dynamic, hardworking, team player..." rows={3} />
            <TA label="Cover letter style notes" value={d.coverLetterStyle} onChange={s('coverLetterStyle')}
              hint="Describe how your cover letters should be structured and what tone they should strike."
              placeholder="I prefer cover letters that open with a specific hook related to the company, not a generic opener. I like to lead with results. I never use the first paragraph to repeat my resume. I keep it under 3 paragraphs." rows={4} />
            <TA label="Short-answer / application question style notes" value={d.answerStyle} onChange={s('answerStyle')}
              placeholder="For short text fields, I prefer 2-3 sentence answers that start with a verb. For longer fields, I like to use the structure: what I did, what happened, what it means for the role I'm applying to." rows={3} />
            <TA label="Anything else the system should know about how you communicate" value={d.writingNotes} onChange={s('writingNotes')}
              placeholder="I often use em dashes. I never start sentences with 'I'. I prefer active voice. I frequently reference specific numbers. I tend to be more formal in cover letters than in short answers..." rows={3} />
            <NavBar onBack={back} onNext={async () => { await saveAll(); }} nextLabel={saving ? 'Saving everything...' : 'Finish & Save Profile →'} saving={saving} nextDisabled={d.toneWords.length === 0} />
          </StepCard>
        )}
      </div>
    </div>
  );
}
