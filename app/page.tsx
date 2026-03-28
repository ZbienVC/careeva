'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

const featureCards = [
  {
    eyebrow: 'Resume intelligence',
    title: 'Parse your resume into structured signal',
    body: 'Turn a static PDF into clean profile data that powers scoring, recommendations, and stronger AI writing.',
  },
  {
    eyebrow: 'Job prioritization',
    title: 'See which roles actually deserve attention',
    body: 'Use fit scores, cleaner cards, and better hierarchy to focus on the opportunities most worth your time.',
  },
  {
    eyebrow: 'Application workflow',
    title: 'Track the whole pipeline without tab chaos',
    body: 'From applied to offer, keep statuses, notes, and links inside one premium-looking workflow.',
  },
];

const steps = [
  'Create your account',
  'Upload your resume',
  'Set your search preferences',
  'Browse roles and generate tailored materials',
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="page-shell space-y-8 md:space-y-10">
          <section className="hero-panel gradient-border overflow-hidden p-8 md:p-10 lg:p-12">
            <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="badge mb-5">Premium AI job search workflow</div>
                <h1 className="section-heading text-5xl md:text-6xl lg:text-7xl">
                  Find your next role with a sharper, calmer system.
                </h1>
                <p className="section-subcopy mt-6 max-w-2xl text-base leading-7 md:text-xl">
                  Careeva helps you organize your search, score better-fit jobs, parse your resume, and generate tailored application materials without the usual mess.
                </p>

                {!loading && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    {isLoggedIn ? (
                      <Link href="/dashboard" className="btn-primary">
                        Go to dashboard
                      </Link>
                    ) : (
                      <>
                        <Link href="/signup" className="btn-primary">
                          Get started free
                        </Link>
                        <Link href="/login" className="btn-secondary">
                          Sign in
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div className="premium-card-soft p-5">
                  <div className="text-sm uppercase tracking-[0.22em] text-slate-500">What Careeva does</div>
                  <div className="mt-3 text-2xl font-semibold text-white">A more premium operating layer for your job search.</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="stat-tile">
                    <div className="text-sm text-slate-400">AI-assisted flows</div>
                    <div className="mt-2 text-3xl font-bold text-blue-300">3</div>
                    <div className="mt-2 text-sm text-slate-500">Resume parsing, scoring, cover letters</div>
                  </div>
                  <div className="stat-tile">
                    <div className="text-sm text-slate-400">Core workflow</div>
                    <div className="mt-2 text-3xl font-bold text-violet-300">1</div>
                    <div className="mt-2 text-sm text-slate-500">Single dashboard for search + applications</div>
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

          <section className="grid gap-6 lg:grid-cols-3">
            {featureCards.map((card) => (
              <div key={card.title} className="premium-card p-7 transition hover:border-white/15">
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{card.eyebrow}</div>
                <h2 className="mt-4 text-2xl font-semibold text-white">{card.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">{card.body}</p>
              </div>
            ))}
          </section>

          <section className="premium-card p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <div className="badge mb-4">How it works</div>
                <h2 className="section-heading">A faster path from resume to relevant opportunities.</h2>
                <p className="section-subcopy mt-4 text-base leading-7">
                  The flow stays simple: get in, add your context, and let Careeva do more of the heavy lifting around matching and writing.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {steps.map((step, index) => (
                  <div key={step} className="premium-card-soft flex gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
