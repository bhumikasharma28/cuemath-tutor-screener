import { useState, FormEvent } from 'react';
import { TutorProfile } from '../types';

interface Props {
  onSubmit: (profile: TutorProfile) => void;
  isLoading: boolean;
  error: string | null;
}

// ── Sparkle decoration ────────────────────────────────────────────────────────
function Sparkle({ x, y, size, delay, color }: { x: string; y: string; size: number; delay: string; color: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      className="absolute pointer-events-none select-none"
      style={{ left: x, top: y, animation: `sparkle-spin ${3 + Math.random() * 2}s linear ${delay} infinite`, color }}
    >
      <path
        d="M12 2L13.09 8.26L19 6L14.74 10.91L21 12L14.74 13.09L19 18L13.09 15.74L12 22L10.91 15.74L5 18L9.26 13.09L3 12L9.26 10.91L5 6L10.91 8.26L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ── Floating illustration card ─────────────────────────────────────────────────
function FloatCard({
  children, rotation, shadow, delay = '0s',
  className = '',
}: {
  children: React.ReactNode;
  rotation: number;
  shadow: string;
  delay?: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute bg-white rounded-2xl p-4 ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        boxShadow: shadow,
        animation: `float 4s ease-in-out ${delay} infinite`,
        ['--rot' as string]: `${rotation}deg`,
      }}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage({ onSubmit, isLoading, error }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), email: email.trim() });
  };

  const sparkles = [
    { x: '6%',  y: '8%',  size: 14, delay: '0s',    color: '#A855F7' },
    { x: '18%', y: '75%', size: 10, delay: '0.8s',  color: '#7C3AED' },
    { x: '28%', y: '20%', size: 8,  delay: '1.4s',  color: '#C084FC' },
    { x: '42%', y: '88%', size: 12, delay: '0.3s',  color: '#A855F7' },
    { x: '72%', y: '6%',  size: 10, delay: '1.1s',  color: '#7C3AED' },
    { x: '85%', y: '82%', size: 14, delay: '0.6s',  color: '#C084FC' },
    { x: '92%', y: '35%', size: 8,  delay: '2s',    color: '#A855F7' },
    { x: '55%', y: '92%', size: 10, delay: '1.7s',  color: '#7C3AED' },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden"
      style={{ background: 'linear-gradient(140deg, #F9F5FF 0%, #F3E8FF 35%, #FAF5FF 60%, #EFF6FF 100%)' }}>

      {/* Sparkle decorations */}
      {sparkles.map((s, i) => <Sparkle key={i} {...s} />)}

      {/* Large decorative orbs */}
      <div className="absolute top-[-100px] left-[20%] w-80 h-80 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #C084FC, transparent)' }} />
      <div className="absolute bottom-[-80px] right-[30%] w-64 h-64 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #818CF8, transparent)' }} />

      {/* ── Left hero panel ── */}
      <div className="flex-1 flex flex-col justify-center px-12 py-12 relative z-10 min-w-0 hidden lg:flex">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <div className="flex items-center bg-white rounded-xl px-4 py-2 shadow-md shadow-purple-100">
            <span className="text-cue-purple font-black text-2xl tracking-tight">cue</span>
            <span className="text-cue-orange font-black text-2xl tracking-tight">math</span>
          </div>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.12))',
              borderColor: 'rgba(124,58,237,0.2)',
              color: '#7C3AED',
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-cue-purple-mid animate-pulse" />
            AI Powered · Human Focused
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-black text-gray-900 leading-tight tracking-tight mb-5 max-w-lg">
          Smarter hiring starts with{' '}
          <span style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #C026D3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            conversations
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 text-lg font-medium leading-relaxed max-w-md mb-12">
          AI interviews that understand, evaluate<br />and help people grow
        </p>

        {/* Floating illustration */}
        <div className="relative h-64 w-full max-w-md">

          {/* Microphone card */}
          <FloatCard rotation={-5} shadow="0 20px 60px rgba(124,58,237,0.18)" delay="0s"
            className="left-0 top-4 w-44">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)' }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-black text-gray-800">Voice Interview</p>
                <p className="text-[12px] text-gray-400 font-medium">AI powered</p>
              </div>
            </div>
            {/* Mini waveform */}
            <div className="flex items-center gap-0.5 h-6">
              {[4, 8, 14, 10, 18, 12, 16, 8, 10, 14, 6, 10].map((h, i) => (
                <div key={i} className="w-1 rounded-full"
                  style={{ height: `${h}px`, background: 'linear-gradient(180deg, #7C3AED, #A855F7)' }} />
              ))}
            </div>
          </FloatCard>

          {/* AI Evaluation card */}
          <FloatCard rotation={4} shadow="0 20px 60px rgba(16,185,129,0.15)" delay="1.2s"
            className="right-0 top-0 w-48">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <span className="text-xs font-black text-gray-700">AI Evaluation</span>
            </div>
            {[{ l: 'Clarity', v: '9.2', c: '#10B981' }, { l: 'Confidence', v: '8.8', c: '#7C3AED' }, { l: 'Fluency', v: '9.0', c: '#F97316' }].map(({ l, v, c }) => (
              <div key={l} className="flex justify-between items-center mb-1.5">
                <span className="text-[12px] text-gray-400 font-medium">{l}</span>
                <span className="text-[12px] font-black" style={{ color: c }}>{v}/10</span>
              </div>
            ))}
          </FloatCard>

          {/* Instant Insights card */}
          <FloatCard rotation={-3} shadow="0 20px 60px rgba(124,58,237,0.15)" delay="0.6s"
            className="left-16 bottom-0 w-44">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <span className="text-xs font-black text-gray-700">Instant Insights</span>
            </div>
            <div className="text-center py-1">
              <p className="text-3xl font-black" style={{ color: '#7C3AED' }}>94%</p>
              <p className="text-[12px] text-gray-400 font-bold">Match Score</p>
            </div>
          </FloatCard>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-6 lg:p-12 relative z-10 flex-shrink-0">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl shadow-purple-100/60 p-8 border border-purple-50">

            {/* Rocket icon + heading */}
            <div className="flex flex-col items-center mb-7">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
              </div>
              {/* Mobile logo */}
              <div className="flex items-center gap-1 lg:hidden mb-3">
                <span className="text-cue-purple font-black text-xl">cue</span>
                <span className="text-cue-orange font-black text-xl">math</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight text-center">Welcome Back</h2>
              <p className="text-gray-400 text-sm font-medium text-center mt-1">Sign in to continue your screening</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    required
                    disabled={isLoading}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:border-cue-purple transition disabled:opacity-50 text-gray-800 placeholder:text-gray-300"
                    style={{ '--tw-ring-color': 'rgba(124,58,237,0.3)' } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. priya@email.com"
                    required
                    disabled={isLoading}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:border-cue-purple transition disabled:opacity-50 text-gray-800 placeholder:text-gray-300"
                    style={{ '--tw-ring-color': 'rgba(124,58,237,0.3)' } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !name.trim() || !email.trim()}
                className="w-full flex items-center justify-center gap-2.5 font-black py-4 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm mt-2 shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                  boxShadow: '0 12px 40px rgba(124,58,237,0.35)',
                }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Starting your screening…
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[13px] text-gray-400 mt-5 font-medium leading-relaxed">
              By continuing you agree to our{' '}
              <a href="#" className="text-cue-purple font-semibold hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-cue-purple font-semibold hover:underline">Privacy Policy</a>
            </p>
          </div>

          <p className="text-center mt-5">
            <a href="/admin"
              className="text-xs font-medium hover:underline"
              style={{ color: 'rgba(124,58,237,0.4)' }}>
              Admin Dashboard →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
