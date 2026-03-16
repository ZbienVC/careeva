'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface NavbarProps {
  showAuth?: boolean;
  showDashboard?: boolean;
}

export default function Navbar({ showAuth = false, showDashboard = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by trying to fetch profile
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

  return (
    <nav className="sticky top-0 z-50 bg-[#0d1117] border-b border-[#30363d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Careeva
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {isDashboard && (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/jobs"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Jobs
                </Link>
                <Link
                  href="/dashboard/applications"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Applications
                </Link>
                <Link
                  href="/dashboard/cover-letter"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Cover Letter
                </Link>
                <Link
                  href="/dashboard/profile"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Profile
                </Link>
              </>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
