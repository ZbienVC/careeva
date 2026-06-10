'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Reveal from '@/components/Reveal';
import { IconUpload, IconTarget, IconSend, IconArrowRight } from '@/components/icons';

const featureCards = [
  {
    eyebrow: 'AI job scoring',
    title: 'Know which roles are worth your time before applying',
    body: 'Careeva scores every job against your resume, skills, and targets — so you focus on high-fit roles, not noise.',
  },
  {
    eyebrow: 'Auto cover letters',
    title: 'Tailored cover letters in seconds',
    body: 'AI-powered writing that adapts tone, keywords, and structure to each job description. No copy-paste needed.',
  },
  {
    eyebrow: 'Application tracking',
    title: 'One clean pipeline from applied to offer',
    body: 'Track status, log outcomes, set follow-up reminders, and see your response rate — all in one place.',
  },
  {
    eyebrow: 'Interview prep',
    title: 'Show up ready for every conversation',
    body: 'Generate tailored follow-ups, log interview notes, and track outcomes to improve over time.',
  },
];

const steps = [
  { label: 'Upload Resume', desc: 'Parse your experience, skills, and education automatically', icon: IconUpload },
  { label: 'AI Scores Jobs', desc: 'Every role is scored against your profile in real-time', icon: IconTarget },
  { label: 'Apply Smarter', desc: 'Generate cover letters and auto-apply to top matches', icon: IconSend },
];

const SOURCES = [
  'Google Jobs', 'Greenhouse', 'Lever', 'Adzuna', 'The Muse', 'Remotive',
  'JSearch', 'Ashby', 'WeWorkRemotely', 'USAJobs', 'RemoteOK', 'Jobicy',
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const featuresRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => {
        setIsLoggedIn(res.ok);
        setLoading(false);
      })
      .catch(() => {
        setIsLoggedIn(false);
        setLoading(false);
      });
  }, []);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen overflow-x-clip">
        <div className="page-shell space-y-8 md:space-y-12">
          {/* Hero */}
          <section className="hero-panel brick-texture gradient-border overflow-hidden p-8 md:p-10 lg:p-14">
            {/* Drifting warm color fields */}
            <div className="blob -top-24 -right-16 h-72 w-72 animate-drift bg-blue-500/20" />
            <div className="blob -bottom-28 left-1/4 h-80 w-80 animate-drift-slow bg-cyan-400/20" />
            <div className="blob top-1/3 -left-20 h-56 w-56 animate-drift bg-emerald-500/10" />

            <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="badge mb-5 animate-fade-up">Join 2,400+ job seekers using Careeva</div>
                <h1 className="animate-fade-up text-5xl font-semibold leading-[1.05] tracking-tight text-ink [animation-delay:80ms] md:text-6xl lg:text-7xl">
                  Find your next role with a{' '}
                  <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                    smarter
                  </span>
                  , automated system.
                </h1>
                <p className="section-subcopy mt-6 max-w-2xl animate-fade-up text-base leading-7 [animation-delay:160ms] md:text-xl">
                  Upload your resume. Careeva scores jobs for you and generates tailored cover letters — so you apply smarter, not harder.
                </p>

                {/* 3-step flow */}
                <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:240ms]">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <span className="text-blue-300"><step.icon size={18} /></span>
                      <span className="text-sm font-semibold text-ink">{step.label}</span>
                      {i < steps.length - 1 && <span className="mx-1 text-slate-600"><IconArrowRight size={14} /></span>}
                    </div>
                  ))}
                </div>

                {!loading && (
                  <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:320ms]">
                    {isLoggedIn ? (
                      <Link href="/dashboard" className="btn-primary">
                        Go to dashboard
                      </Link>
                    ) : (
                      <>
                        <Link href="/signup" className="btn-primary">
                          Get Started Free
                        </Link>
                        <button onClick={scrollToFeatures} className="btn-secondary">
                          See How It Works
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid animate-fade-up gap-4 [animation-delay:200ms]">
                <div className="premium-card-soft animate-float p-5">
                  <div className="text-sm uppercase tracking-[0.22em] text-slate-500">What Careeva does</div>
                  <div className="mt-3 font-display text-2xl font-semibold text-ink">Your job search on autopilot — without losing control.</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="stat-tile">
                    <div className="text-sm text-slate-400">Job sources</div>
                    <div className="mt-2 text-3xl font-bold text-blue-300">14+</div>
                    <div className="mt-2 text-sm text-slate-500">Boards and ATSs searched in one pass</div>
                  </div>
                  <div className="stat-tile">
                    <div className="text-sm text-slate-400">Job seekers</div>
                    <div className="mt-2 text-3xl font-bold text-violet-300">2,400+</div>
                    <div className="mt-2 text-sm text-slate-500">Already using Careeva to find roles faster</div>
                  </div>
                </div>
                <div className="premium-card-soft p-5">
                  <div className="text-sm text-slate-400">Designed for</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="badge">Operators</span>
                    <span className="badge">Analysts</span>
                    <span className="badge">Career switchers</span>
                    <span className="badge">High-volume applicants</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sources marquee */}
          <Reveal>
            <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
              <div className="flex w-max animate-marquee gap-3">
                {[...SOURCES, ...SOURCES].map((source, i) => (
                  <span key={`${source}-${i}`} className="badge whitespace-nowrap !px-4 !py-2 text-sm">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* How it works */}
          <section id="how-it-works" className="premium-card p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <Reveal>
                <div className="badge mb-4">How it works</div>
                <h2 className="section-heading">Three steps from resume to better applications.</h2>
                <p className="section-subcopy mt-4 text-base leading-7">
                  Upload once, and Careeva handles the heavy lifting — job discovery, fit scoring, cover letters, and tracking in one clean workflow.
                </p>
              </Reveal>
              <div className="grid gap-4 md:grid-cols-1">
                {steps.map((step, index) => (
                  <Reveal key={step.label} delay={index * 110}>
                    <div className="premium-card-soft flex gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-16px_rgba(94,60,30,0.3)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-paper">
                        <step.icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">
                          <span className="mr-2 font-display text-base text-blue-300">0{index + 1}</span>
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-sm leading-6 text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Feature highlights */}
          <section ref={featuresRef} className="grid gap-6 lg:grid-cols-2">
            {featureCards.map((card, index) => (
              <Reveal key={card.title} delay={(index % 2) * 110}>
                <div className="premium-card group h-full p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-20px_rgba(94,60,30,0.35)]">
                  <div className="text-sm uppercase tracking-[0.18em] text-blue-300">{card.eyebrow}</div>
                  <h2 className="mt-4 font-display text-2xl font-semibold text-ink">{card.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </section>

          {/* Bottom CTA */}
          {!loading && !isLoggedIn && (
            <Reveal>
              <section className="hero-panel brick-texture p-8 text-center md:p-12">
                <div className="blob -top-20 left-1/3 h-64 w-64 animate-drift bg-blue-500/15" />
                <div className="relative z-10">
                  <h2 className="section-heading text-3xl md:text-4xl">Ready to apply smarter?</h2>
                  <p className="section-subcopy mt-3 text-base">Join 2,400+ job seekers who use Careeva to find and land better roles.</p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link href="/signup" className="btn-primary">
                      Get Started Free
                    </Link>
                    <Link href="/login" className="btn-secondary">
                      Sign in
                    </Link>
                  </div>
                </div>
              </section>
            </Reveal>
          )}
        </div>
      </main>
    </>
  );
}
