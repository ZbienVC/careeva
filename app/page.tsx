'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Reveal from '@/components/Reveal';
import {
  IconUpload,
  IconTarget,
  IconSend,
  IconArrowRight,
  IconCheck,
  IconSparkles,
  IconClipboardCheck,
  IconListChecks,
} from '@/components/icons';

const featureCards = [
  {
    eyebrow: 'AI job scoring',
    title: 'Know which roles are worth your time before applying',
    body: 'Careeva scores every job against your resume, skills, and targets — so you focus on high-fit roles, not noise.',
    icon: IconTarget,
  },
  {
    eyebrow: 'Auto cover letters',
    title: 'Tailored cover letters in seconds',
    body: 'AI-powered writing that adapts tone, keywords, and structure to each job description. No copy-paste needed.',
    icon: IconSparkles,
  },
  {
    eyebrow: 'Review-first automation',
    title: 'Nothing sends without your approval',
    body: 'The apply engine fills each form, screenshots it, and waits for your one-click approval. You stay in control of every submission.',
    icon: IconClipboardCheck,
  },
  {
    eyebrow: 'Application tracking',
    title: 'One clean pipeline from applied to offer',
    body: 'Track status, log outcomes, set follow-up reminders, and see your response rate — all in one place.',
    icon: IconListChecks,
  },
];

const steps = [
  {
    label: 'Tell it your story',
    desc: 'Upload your resume and answer a short questionnaire — role, industries, home base, salary, goals.',
    icon: IconUpload,
  },
  {
    label: 'It finds and scores',
    desc: 'Fourteen-plus boards searched in one pass. Every role scored against your real profile, location included.',
    icon: IconTarget,
  },
  {
    label: 'You approve, it applies',
    desc: 'Forms filled, letters written, screenshots taken. You approve; it submits and tracks the outcome.',
    icon: IconSend,
  },
];

const SOURCES = [
  'Google Jobs', 'Greenhouse', 'Lever', 'Adzuna', 'The Muse', 'Remotive',
  'JSearch', 'Ashby', 'WeWorkRemotely', 'USAJobs', 'RemoteOK', 'Jobicy',
];

// The hero's living pipeline — job cards cycling through real product states.
const TICKER_ITEMS = [
  { title: 'Data Analyst', company: 'Brex', status: 'Scored 87', tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' },
  { title: 'Strategy Associate', company: 'Ramp', status: 'Letter drafted', tone: 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10' },
  { title: 'Ops Analyst', company: 'Stripe', status: 'Awaiting approval', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  { title: 'BizOps Manager', company: 'Notion', status: 'Submitted', tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10', check: true },
  { title: 'Revenue Analyst', company: 'Plaid', status: 'Found · matching', tone: 'text-slate-400 border-ink/10 bg-ink/[0.04]' },
  { title: 'Program Manager', company: 'Figma', status: 'Scored 82', tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' },
];

function TickerCard({ item }: { item: (typeof TICKER_ITEMS)[number] }) {
  return (
    <div className="premium-card-soft flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{item.company}</div>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${item.tone}`}>
        {item.check && <IconCheck size={11} />}
        {item.status}
      </span>
    </div>
  );
}

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
        <div className="page-shell space-y-10 md:space-y-14">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <section className="hero-panel brick-texture gradient-border overflow-hidden p-8 md:p-10 lg:p-14">
            <div className="blob -top-24 -right-16 h-72 w-72 animate-drift bg-blue-500/20" />
            <div className="blob -bottom-28 left-1/4 h-80 w-80 animate-drift-slow bg-cyan-400/20" />
            <div className="blob top-1/3 -left-20 h-56 w-56 animate-drift bg-emerald-500/10" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="eyebrow animate-fade-up flex items-center gap-3">
                  <span className="inline-block h-px w-8 bg-blue-400/60" />
                  The job search, run like a studio
                </div>
                <h1 className="mt-5 animate-fade-up text-5xl font-semibold leading-[1.02] tracking-tight text-ink [animation-delay:80ms] md:text-6xl lg:text-7xl">
                  Your next role,{' '}
                  <em className="font-display italic text-blue-300">found</em>,{' '}
                  <em className="font-display italic text-cyan-300">scored</em>, and{' '}
                  <em className="font-display italic text-violet-300">applied to</em>{' '}
                  while you sleep.
                </h1>
                <p className="section-subcopy mt-6 max-w-xl animate-fade-up text-base leading-7 [animation-delay:160ms] md:text-lg">
                  Upload your resume once. Careeva searches 14+ job boards, scores every role against
                  your real profile, writes the letters — and waits for your one-click approval before
                  anything is sent.
                </p>

                {!loading && (
                  <div className="mt-9 flex animate-fade-up flex-wrap items-center gap-4 [animation-delay:240ms]">
                    {isLoggedIn ? (
                      <Link href="/dashboard" className="btn-primary !px-7">
                        Go to dashboard <IconArrowRight size={16} />
                      </Link>
                    ) : (
                      <>
                        <Link href="/signup" className="btn-primary !px-7">
                          Start free <IconArrowRight size={16} />
                        </Link>
                        <button onClick={scrollToFeatures} className="btn-ghost">
                          See how it works
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-10 grid max-w-md animate-fade-up grid-cols-3 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 [animation-delay:320ms]">
                  {[
                    { n: '14+', l: 'job sources' },
                    { n: '2,400+', l: 'job seekers' },
                    { n: '1-click', l: 'approvals' },
                  ].map((stat) => (
                    <div key={stat.l} className="bg-[#fdf9f0] px-4 py-3">
                      <div className="font-display text-2xl font-semibold tabular-nums text-blue-300">{stat.n}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{stat.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* The kiln — a live pipeline flowing through the arch */}
              <div className="relative mx-auto w-full max-w-sm animate-fade-up [animation-delay:200ms]">
                <div className="arch relative overflow-hidden border border-ink/10 bg-gradient-to-b from-[#fdf9f0] to-[#f8efdd] p-5 pt-12 shadow-[0_24px_64px_-24px_rgba(94,60,30,0.4)]">
                  <div className="absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
                    Live pipeline
                  </div>
                  <div className="relative h-[380px] overflow-hidden [mask-image:linear-gradient(180deg,transparent,black_14%,black_86%,transparent)]">
                    <div className="animate-ticker space-y-3">
                      {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                        <TickerCard key={`${item.title}-${i}`} item={item} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  found → scored → written → approved → sent
                </div>
              </div>
            </div>
          </section>

          {/* ── Sources wire ─────────────────────────────────────────────── */}
          <Reveal>
            <div className="rule border-b border-ink/10 py-4">
              <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
                <div className="flex w-max animate-marquee items-center gap-8">
                  {[...SOURCES, ...SOURCES].map((source, i) => (
                    <span key={`${source}-${i}`} className="flex items-center gap-8 whitespace-nowrap font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
                      {source}
                      <span className="h-1 w-1 rounded-full bg-blue-400/60" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* ── How it works — editorial numbered steps ──────────────────── */}
          <section id="how-it-works">
            <Reveal>
              <div className="mb-10 max-w-2xl">
                <div className="eyebrow flex items-center gap-3">
                  <span className="inline-block h-px w-8 bg-blue-400/60" />
                  How it works
                </div>
                <h2 className="section-heading mt-4 text-3xl md:text-4xl">
                  Three steps. Then it mostly runs itself.
                </h2>
              </div>
            </Reveal>
            <div className="grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <Reveal key={step.label} delay={index * 120}>
                  <div className="rule group pt-6 transition-colors duration-300">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-5xl font-light italic text-blue-300/70 transition-colors duration-300 group-hover:text-blue-300">
                        0{index + 1}
                      </span>
                      <span className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-300">
                        <step.icon size={20} />
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-xl font-semibold text-ink">{step.label}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ── Features — asymmetric, one dominant terracotta moment ───── */}
          <section ref={featuresRef} className="grid gap-6 lg:grid-cols-2">
            {featureCards.map((card, index) => {
              const inverted = index === 0;
              return (
                <Reveal key={card.title} delay={(index % 2) * 110} className={inverted ? 'lg:col-span-2' : ''}>
                  {inverted ? (
                    <div className="brick-texture group relative overflow-hidden rounded-3xl bg-blue-600 p-8 transition-all duration-300 hover:-translate-y-1 md:p-12 shadow-[0_32px_64px_-24px_rgba(110,40,16,0.5)]">
                      <div className="blob -right-20 -top-24 h-64 w-64 animate-drift bg-cyan-400/20" />
                      <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-50/80">{card.eyebrow}</div>
                          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold text-paper md:text-4xl">{card.title}</h2>
                          <p className="mt-4 max-w-xl text-sm leading-7 text-paper/80">{card.body}</p>
                        </div>
                        <div className="hidden text-paper/30 transition-all duration-500 group-hover:rotate-6 group-hover:text-paper/60 md:block">
                          <card.icon size={72} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="premium-card group h-full p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-20px_rgba(94,60,30,0.35)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="eyebrow">{card.eyebrow}</div>
                        <span className="text-slate-600 transition-colors duration-300 group-hover:text-blue-300">
                          <card.icon size={20} />
                        </span>
                      </div>
                      <h2 className="mt-4 font-display text-2xl font-semibold text-ink">{card.title}</h2>
                      <p className="mt-4 text-sm leading-7 text-slate-400">{card.body}</p>
                    </div>
                  )}
                </Reveal>
              );
            })}
          </section>

          {/* ── Pull quote ───────────────────────────────────────────────── */}
          <Reveal>
            <figure className="relative mx-auto max-w-3xl px-6 py-10 text-center md:py-14">
              <span aria-hidden="true" className="pointer-events-none absolute -top-2 left-0 font-display text-[120px] leading-none text-blue-300/20 md:text-[160px]">
                “
              </span>
              <blockquote className="font-display text-2xl font-medium italic leading-snug text-ink md:text-4xl">
                It feels less like applying to jobs and more like reviewing work someone already did for you.
              </blockquote>
              <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                — Early Careeva user
              </figcaption>
            </figure>
          </Reveal>

          {/* ── Closing CTA — full terracotta band ───────────────────────── */}
          {!loading && !isLoggedIn && (
            <Reveal>
              <section className="brick-texture relative overflow-hidden rounded-3xl bg-blue-600 p-10 text-center md:p-16">
                <div className="blob -top-24 left-1/4 h-72 w-72 animate-drift bg-cyan-400/25" />
                <div className="blob -bottom-24 right-1/5 h-64 w-64 animate-drift-slow bg-violet-500/30" />
                <div className="relative z-10">
                  <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold text-paper md:text-5xl">
                    Stop applying. Start <em className="italic">approving</em>.
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base text-paper/80">
                    Join 2,400+ job seekers who let Careeva do the heavy lifting — and keep the final say.
                  </p>
                  <div className="mt-8 flex justify-center gap-3">
                    <Link href="/signup" className="btn-paper !px-7">
                      Get started free <IconArrowRight size={16} />
                    </Link>
                    <Link href="/login" className="btn-outline-paper">
                      Sign in
                    </Link>
                  </div>
                </div>
              </section>
            </Reveal>
          )}

          {/* ── Footer masthead ──────────────────────────────────────────── */}
          <footer className="rule pb-6 pt-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="font-display text-4xl font-semibold tracking-tight text-ink">Careeva</div>
                <p className="mt-2 max-w-xs text-sm text-slate-500">
                  The AI job search assistant that works while you sleep — and never sends without asking.
                </p>
              </div>
              <nav className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <Link href="/signup" className="transition-colors hover:text-blue-300">Get started</Link>
                <Link href="/login" className="transition-colors hover:text-blue-300">Sign in</Link>
                <button onClick={scrollToFeatures} className="uppercase tracking-[0.18em] transition-colors hover:text-blue-300">Features</button>
                <a href="#how-it-works" className="transition-colors hover:text-blue-300">How it works</a>
              </nav>
            </div>
            <div className="rule mt-8 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
              © {new Date().getFullYear()} Careeva · Built for the long search, made short
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
