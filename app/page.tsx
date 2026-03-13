'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

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
      <main className="min-h-screen bg-[#0d1117]">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Find Your Next
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Perfect Job
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Careeva uses AI to match you with jobs based on your skills, experience, and goals. Upload your resume
              and let us find the perfect opportunities for you.
            </p>

            {!loading && (
              <div className="flex gap-4 justify-center">
                {isLoggedIn ? (
                  <Link
                    href="/dashboard"
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Get Started Free
                    </Link>
                    <Link
                      href="/login"
                      className="px-8 py-3 border border-[#30363d] hover:border-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-lg font-bold text-white mb-3">Smart Resume Upload</h3>
              <p className="text-gray-400">
                Upload your resume in PDF or DOCX format. Our AI automatically extracts your skills, experience, and
                qualifications.
              </p>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-bold text-white mb-3">AI Job Matching</h3>
              <p className="text-gray-400">
                Our algorithm matches you with relevant jobs based on your unique profile. See your compatibility
                score for each position.
              </p>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-bold text-white mb-3">Save Time</h3>
              <p className="text-gray-400">
                Stop wasting time on job applications that aren't a good fit. Focus on opportunities that matter.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-20 bg-[#161b22] border border-[#30363d] rounded-lg p-12">
            <h2 className="text-3xl font-bold text-white mb-12 text-center">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="font-bold text-white mb-2">Sign Up</h3>
                <p className="text-gray-400 text-sm">Create your account in seconds with your email</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="font-bold text-white mb-2">Upload Resume</h3>
                <p className="text-gray-400 text-sm">Share your resume for AI analysis</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="font-bold text-white mb-2">Complete Profile</h3>
                <p className="text-gray-400 text-sm">Tell us your preferences and goals</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4">
                  4
                </div>
                <h3 className="font-bold text-white mb-2">Find Jobs</h3>
                <p className="text-gray-400 text-sm">Browse matched opportunities</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
