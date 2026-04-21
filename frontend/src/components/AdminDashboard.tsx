import { useState, useEffect } from 'react';
import { EvaluationReport, TutorProfile } from '../types';
import { getSessions, getSession } from '../api';
import ResultsPage from './ResultsPage';

type SessionRow = {
  id: string;
  tutorName: string;
  email: string;
  isComplete: boolean;
  recommendation?: 'hire' | 'hold' | 'reject';
  overallScore?: number;
  createdAt: string;
  completedAt?: string;
};

type FilterKey = 'all' | 'hire' | 'hold' | 'reject';

const REC_CFG = {
  hire:   { label: 'Selected',  dot: '#10B981', bg: 'rgba(16,185,129,0.12)', text: '#065F46' },
  hold:   { label: 'Potential', dot: '#F59E0B', bg: 'rgba(245,158,11,0.12)', text: '#78350F' },
  reject: { label: 'Rejected',  dot: '#EF4444', bg: 'rgba(239,68,68,0.12)',  text: '#7F1D1D' },
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[55, 70, 50, 30, 45, 35].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-3.5 rounded-lg skeleton" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Report modal ───────────────────────────────────────────────────────────────
function ReportModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);

  useEffect(() => {
    getSession(sessionId)
      .then((s) => {
        if (!s.evaluation) { setError('No evaluation data found.'); return; }
        setEvaluation(s.evaluation);
        setTutorProfile(s.tutorProfile);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(4,47,46,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="relative w-full max-w-2xl mt-4 mb-8">
        <button onClick={onClose}
          className="fixed top-5 right-5 z-50 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-100 transition"
          aria-label="Close">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="bg-white rounded-3xl p-16 text-center shadow-2xl">
            <svg className="animate-spin h-9 w-9 mx-auto mb-4" style={{ color: '#0F766E' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">Loading report…</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-2xl">
            <p className="text-red-500 font-bold">{error}</p>
            <button onClick={onClose} className="mt-4 text-sm font-semibold hover:underline" style={{ color: '#0F766E' }}>Close</button>
          </div>
        )}

        {!loading && !error && evaluation && tutorProfile && (
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            <ResultsPage evaluation={evaluation} tutorProfile={tutorProfile} onRestart={onClose} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar nav item ───────────────────────────────────────────────────────────
function NavItem({ icon, label, active, count, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; count: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left group"
      style={{
        background: active ? 'rgba(94,234,212,0.15)' : 'transparent',
        border: active ? '1px solid rgba(94,234,212,0.25)' : '1px solid transparent',
      }}>
      <div className="flex items-center gap-3">
        <span className={`transition-colors ${active ? 'text-cue-light' : 'text-white/40 group-hover:text-white/70'}`}>
          {icon}
        </span>
        <span className={`text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
          {label}
        </span>
      </div>
      <span className="text-xs font-black px-2 py-0.5 rounded-full"
        style={{
          background: active ? 'rgba(94,234,212,0.2)' : 'rgba(255,255,255,0.07)',
          color: active ? '#5EEAD4' : 'rgba(255,255,255,0.4)',
        }}>
        {count}
      </span>
    </button>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getSessions()
      .then((data) => {
        const completed = data
          .filter((s) => s.isComplete)
          .sort((a, b) =>
            new Date(b.completedAt ?? b.createdAt).getTime() -
            new Date(a.completedAt ?? a.createdAt).getTime()
          );
        setSessions(completed);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  const counts: Record<FilterKey, number> = {
    all:    sessions.length,
    hire:   sessions.filter((s) => s.recommendation === 'hire').length,
    hold:   sessions.filter((s) => s.recommendation === 'hold').length,
    reject: sessions.filter((s) => s.recommendation === 'reject').length,
  };

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.recommendation === filter);

  const navItems: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
    {
      key: 'all',
      label: 'All Candidates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'hire',
      label: 'Selected',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'hold',
      label: 'Potential',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'reject',
      label: 'Rejected',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#F0FDFA' }}>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #042F2E 0%, #0D3D36 100%)' }}>

        {/* Logo */}
        <div className="px-5 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-black text-xl tracking-tight">cue</span>
            <span className="font-black text-xl tracking-tight" style={{ color: '#F97316' }}>math</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(94,234,212,0.6)' }}>
            Admin Dashboard
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[12px] font-black uppercase tracking-widest px-3 mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Filter by Status
          </p>
          {navItems.map(({ key, label, icon }) => (
            <NavItem
              key={key}
              icon={icon}
              label={label}
              active={filter === key}
              count={counts[key]}
              onClick={() => { setFilter(key); setSidebarOpen(false); }}
            />
          ))}
        </nav>

        {/* Back to screener */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <a href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5 group w-full">
            <svg className="w-4 h-4 text-white/30 group-hover:text-white/60 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold text-white/40 group-hover:text-white/70 transition">Back to Screener</span>
          </a>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-cue-pale px-5 py-4 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-cue-pale hover:bg-cue-pale transition"
          >
            <svg className="w-5 h-5 text-cue-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-gray-900 tracking-tight">
              {filter === 'all' ? 'All Interviews' :
               filter === 'hire' ? 'Selected Candidates' :
               filter === 'hold' ? 'Potential Candidates' : 'Rejected Candidates'}
            </h1>
            <p className="text-xs text-gray-400 font-medium">Sorted by date · newest first</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-cue-teal bg-cue-pale px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cue-teal" />
            {counts.all} completed
          </div>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          {([ 'all', 'hire', 'hold', 'reject' ] as FilterKey[]).map((key) => {
            const labels = { all: 'Total', hire: 'Selected', hold: 'Potential', reject: 'Rejected' };
            const colors = {
              all:    { bg: '#F0FDFA', border: '#CCFBF1', num: '#0F766E' },
              hire:   { bg: '#ECFDF5', border: '#A7F3D0', num: '#059669' },
              hold:   { bg: '#FFFBEB', border: '#FDE68A', num: '#D97706' },
              reject: { bg: '#FEF2F2', border: '#FECACA', num: '#DC2626' },
            };
            const c = colors[key];
            return (
              <button key={key} onClick={() => setFilter(key)}
                className="text-left p-4 rounded-2xl transition-all hover:shadow-md"
                style={{
                  background: c.bg,
                  border: `2px solid ${filter === key ? c.num : c.border}`,
                  boxShadow: filter === key ? `0 0 0 3px ${c.num}20` : undefined,
                }}>
                <p className="text-3xl font-black" style={{ color: c.num }}>{counts[key]}</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-0.5">{labels[key]}</p>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="px-5 pb-10">
          <div className="bg-white rounded-2xl shadow-sm border border-cue-pale overflow-hidden">
            {error ? (
              <div className="p-12 text-center">
                <p className="text-red-500 font-bold text-sm">{error}</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">Make sure the backend server is running.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #CCFBF1', background: '#F0FDFA' }}>
                      {['Candidate', 'Email', 'Date', 'Score', 'Recommendation', 'Report'].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left">
                          <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cue-pale/50">
                    {loading && [1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}

                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-cue-pale flex items-center justify-center mb-1">
                              <svg className="w-6 h-6 text-cue-teal/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-sm font-semibold">
                              {sessions.length === 0 ? 'No completed interviews yet' : 'No results for this filter'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!loading && filtered.map((s) => {
                      const rec = s.recommendation;
                      const rcfg = rec ? REC_CFG[rec] : null;
                      const scoreColor =
                        (s.overallScore ?? 0) >= 8 ? '#059669' :
                        (s.overallScore ?? 0) >= 6 ? '#0F766E' :
                        (s.overallScore ?? 0) >= 4 ? '#D97706' :
                        '#DC2626';

                      return (
                        <tr key={s.id} className="group hover:bg-cue-bg/60 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #0F766E, #134E4A)' }}>
                                {s.tutorName[0]?.toUpperCase()}
                              </div>
                              <span className="font-bold text-gray-800">{s.tutorName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-500 font-medium">{s.email}</td>
                          <td className="px-5 py-4 text-gray-400 text-xs font-medium whitespace-nowrap">
                            {formatDate(s.completedAt ?? s.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {s.overallScore != null ? (
                              <span className="text-base font-black" style={{ color: scoreColor }}>
                                {s.overallScore}
                                <span className="text-xs text-gray-400 font-normal">/10</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 font-bold">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {rcfg ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ background: rcfg.bg, color: rcfg.text }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rcfg.dot }} />
                                {rcfg.label}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs font-bold">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => setSelectedId(s.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition hover:shadow-sm"
                              style={{ color: '#0F766E', borderColor: '#CCFBF1', background: '#F0FDFA' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0F766E'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CCFBF1'; }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View Report
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-4 font-medium">
              Showing {filtered.length} of {sessions.length} interviews
            </p>
          )}
        </div>
      </div>

      {selectedId && <ReportModal sessionId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
