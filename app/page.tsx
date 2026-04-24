'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';

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
  { label: 'Upload Resume', desc: 'Parse your experience, skills, and education automatically', icon: '📄' },
  { label: 'AI Scores Jobs', desc: 'Every role is scored against your profile in real-time', icon: '🎯' },
  { label: 'Apply Smarter', desc: 'Generate cover letters and auto-apply to top matches', icon: '🚀' },
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
      <main className="min-h-screen">
        <div className="page-shell space-y-8 md:space-y-10">
          {/* Hero */}
          <section className="hero-panel gradient-border overflow-hidden p-8 md:p-10 lg:p-12">
            <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="badge mb-5">Join 2,400+ job seekers using Careeva</div>
                <h1 className="section-heading text-5xl md:text-6xl lg:text-7xl">
                  Find your next role with a smarter, automated system.
                </h1>
                <p className="section-subcopy mt-6 max-w-2xl text-base leading-7 md:text-xl">
                  Upload your resume. Careeva scores jobs for you and generates tailored cover letters — so you apply smarter, not harder.
                </p>

                {/* 3-step flow */}
                <div className="mt-8 flex flex-wrap gap-3 items-center">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <span className="text-lg">{step.icon}</span>
                      <span className="text-sm font-semibold text-white">{step.label}</span>
                      {i < steps.length - 1 && <span className="text-slate-500 mx-1">→</span>}
                    </div>
                  ))}
                </div>

                {!loading && (
                  <div className="mt-8 flex flex-wrap gap-3">
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

              <div className="grid gap-4">
                <div className="premium-card-soft p-5">
                  <div className="text-sm uppercase tracking-[0.22em] text-slate-500">What Careeva does</div>
                  <div className="mt-3 text-2xl font-semibold text-white">Your job search on autopilot — without losing control.</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="stat-tile">
                    <div className="text-sm text-slate-400">AI flows</div>
                    <div className="mt-2 text-3xl font-bold text-blue-300">4</div>
                    <div className="mt-2 text-sm text-slate-500">Scoring, cover letters, tracking, follow-ups</div>
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

          {/* How it works */}
          <section id="how-it-works" className="premium-card p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <div className="badge mb-4">How it works</div>
                <h2 className="section-heading">Three steps from resume to better applications.</h2>
                <p className="section-subcopy mt-4 text-base leading-7">
                  Upload once, and Careeva handles the heavy lifting — job discovery, fit scoring, cover letters, and tracking in one clean workflow.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-1">
                {steps.map((step, index) => (
                  <div key={step.label} className="premium-card-soft flex gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-lg">
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{step.label}</p>
                      <p className="text-sm leading-6 text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Feature highlights */}
          <section ref={featuresRef} className="grid gap-6 lg:grid-cols-2">
            {featureCards.map((card) => (
              <div key={card.title} className="premium-card p-7 transition hover:border-white/15">
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{card.eyebrow}</div>
                <h2 className="mt-4 text-2xl font-semibold text-white">{card.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">{card.body}</p>
              </div>
            ))}
          </section>

          {/* Bottom CTA */}
          {!loading && !isLoggedIn && (
            <section className="premium-card p-8 md:p-10 text-center">
              <h2 className="section-heading text-3xl">Ready to apply smarter?</h2>
              <p className="section-subcopy mt-3 text-base">Join 2,400+ job seekers who use Careeva to find and land better roles.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/signup" className="btn-primary">
                  Get Started Free
                </Link>
                <Link href="/login" className="btn-secondary">
                  Sign in
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
