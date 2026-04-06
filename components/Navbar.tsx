'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface NavbarProps {
  showAuth?: boolean;
  showDashboard?: boolean;
}

const DASHBOARD_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/jobs', label: 'Jobs' },
  { href: '/dashboard/automation', label: '⚡ Automate' },
  { href: '/dashboard/applications', label: 'Tracker' },
  { href: '/dashboard/profile', label: 'Profile' },
];

export default function Navbar({ showAuth = false, showDashboard = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
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

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
  };

  const isDashboard = pathname?.startsWith('/dashboard');
  const navLinks = useMemo(() => (isDashboard ? DASHBOARD_LINKS : []), [isDashboard]);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500 text-lg font-black text-white shadow-lg shadow-blue-950/40">
              C
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white">Careeva</div>
              <div className="text-xs text-slate-400">AI job search operating system</div>
            </div>
          </Link>

          {navLinks.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {navLinks.map((link) => {
                const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            {isDashboard && <span className="badge hidden md:inline-flex">Premium workflow</span>}
            {!loading && (
              isLoggedIn ? (
                <button onClick={handleLogout} className="btn-secondary !rounded-full !px-4 !py-2 text-sm">
                  Sign Out
                </button>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost !rounded-full text-sm">
                    Sign In
                  </Link>
                  <Link href="/signup" className="btn-primary !rounded-full !px-4 !py-2 text-sm">
                    Get Started
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
