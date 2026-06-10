'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome,
  IconUser,
  IconBriefcase,
  IconZap,
  IconClipboardCheck,
  IconListChecks,
  IconSettings,
  IconMenu,
  IconX,
} from '@/components/icons';

interface NavbarProps {
  showAuth?: boolean;
  showDashboard?: boolean;
}

// Ordered to mirror the user journey: overview → build your profile →
// find jobs → automate applications → review queue → track outcomes.
const DASHBOARD_LINKS = [
  { href: '/dashboard', label: 'Home', icon: IconHome, exact: true },
  { href: '/dashboard/profile', label: 'Profile', icon: IconUser },
  { href: '/dashboard/jobs', label: 'Jobs', icon: IconBriefcase },
  { href: '/dashboard/automation', label: 'Automate', icon: IconZap },
  { href: '/dashboard/review', label: 'Review', icon: IconClipboardCheck },
  { href: '/dashboard/applications', label: 'Tracker', icon: IconListChecks },
  { href: '/dashboard/settings', label: 'Settings', icon: IconSettings },
];

export default function Navbar({ showAuth = false, showDashboard = false }: NavbarProps) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
    // Force hard reload so cookie state fully clears from browser
    window.location.href = '/login';
  };

  const isDashboard = pathname?.startsWith('/dashboard');
  const navLinks = useMemo(() => (isDashboard ? DASHBOARD_LINKS : []), [isDashboard]);

  const isActive = (link: (typeof DASHBOARD_LINKS)[number]) =>
    link.exact ? pathname === link.href : pathname === link.href || pathname?.startsWith(`${link.href}/`);

  return (
    <nav className="sticky top-0 z-50 border-b border-ink/[0.08] bg-slate-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[72px] items-center justify-between gap-4 py-3">
          <Link href={isDashboard ? '/dashboard' : '/'} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500 font-display text-lg font-black text-paper shadow-lg shadow-blue-950/30">
              C
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight text-ink">Careeva</div>
              <div className="hidden text-xs text-slate-400 sm:block">AI job search assistant</div>
            </div>
          </Link>

          {navLinks.length > 0 && (
            <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 lg:flex">
              {navLinks.map((link) => {
                const active = isActive(link);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon size={16} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            {!loading &&
              (isLoggedIn ? (
                <button onClick={handleLogout} className="btn-secondary hidden !rounded-full !px-4 !py-2 text-sm lg:inline-flex">
                  Sign out
                </button>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost !rounded-full text-sm">
                    Sign in
                  </Link>
                  <Link href="/signup" className="btn-primary !rounded-full !px-4 !py-2 text-sm">
                    Get started
                  </Link>
                </>
              ))}

            {navLinks.length > 0 && (
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] lg:hidden"
              >
                {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation */}
        {menuOpen && navLinks.length > 0 && (
          <div className="border-t border-white/10 pb-4 pt-2 lg:hidden">
            <div className="grid gap-1">
              {navLinks.map((link) => {
                const active = isActive(link);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      active ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
              {!loading && isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
