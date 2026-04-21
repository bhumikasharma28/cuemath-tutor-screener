import { useState, useEffect } from 'react';
import { EvaluationReport, TutorProfile } from '../types';

interface Props {
  evaluation: EvaluationReport;
  tutorProfile: TutorProfile;
  onRestart: () => void;
}

// ── Circular score ring ───────────────────────────────────────────────────────
function CircularScore({ score }: { score: number }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 150); return () => clearTimeout(t); }, []);

  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = filled ? circ * (1 - score / 10) : circ;
  const strokeColor =
    score >= 8 ? '#10B981' :
    score >= 6 ? '#0F766E' :
    score >= 4 ? '#F59E0B' :
    '#EF4444';

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#CCFBF1" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color: strokeColor, lineHeight: 1 }}>{score}</span>
        <span className="text-xs text-gray-400 font-semibold mt-0.5">/10</span>
      </div>
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, icon, description, score }: { label: string; icon: string; description: string; score: number }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 300); return () => clearTimeout(t); }, []);

  const pct = filled ? (score / 10) * 100 : 0;
  const barColor =
    score >= 8 ? '#10B981' :
    score >= 6 ? '#0F766E' :
    score >= 4 ? '#F59E0B' :
    '#EF4444';
  const textColor =
    score >= 8 ? 'text-emerald-600' :
    score >= 6 ? 'text-cue-teal' :
    score >= 4 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <span className="text-sm font-bold text-gray-700">{label}</span>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">{description}</span>
          </div>
        </div>
        <span className={`text-sm font-black ${textColor}`}>
          {score}<span className="text-gray-400 font-normal text-xs">/10</span>
        </span>
      </div>
      <div className="w-full bg-cue-pale rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  );
}

// ── Recommendation config ─────────────────────────────────────────────────────
const REC = {
  hire: {
    label: 'Recommended for Hire',
    gradient: 'from-emerald-600 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
    text: 'text-emerald-700',
    icon: '✓',
  },
  hold: {
    label: 'Hold — Needs Development',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-500',
    text: 'text-amber-700',
    icon: '~',
  },
  reject: {
    label: 'Not Recommended',
    gradient: 'from-red-500 to-rose-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-500',
    text: 'text-red-700',
    icon: '✗',
  },
};

const SCORE_META = [
  { key: 'clarity',    icon: '🗣️', label: 'Clarity',    description: 'How clearly ideas are expressed' },
  { key: 'warmth',     icon: '🤝', label: 'Warmth',     description: 'Friendliness of teaching style' },
  { key: 'simplicity', icon: '💡', label: 'Simplicity', description: 'Ability to simplify concepts' },
  { key: 'patience',   icon: '⏳', label: 'Patience',   description: 'Empathy for struggling students' },
  { key: 'fluency',    icon: '🌊', label: 'Fluency',    description: 'Confidence and flow in speech' },
] as const;

// ── Main component ────────────────────────────────────────────────────────────
export default function ResultsPage({ evaluation, tutorProfile, onRestart }: Props) {
  const { scores, recommendation, strengths, improvements, quotes, detailedFeedback, summary } = evaluation;
  const cfg = REC[recommendation];

  return (
    <div className="min-h-screen bg-cue-bg">

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between print:hidden"
        style={{ background: 'linear-gradient(135deg, #042F2E 0%, #134E4A 100%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-xl tracking-tight">cue</span>
          <span className="text-cue-orange font-black text-xl tracking-tight">math</span>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => window.print()}
            className="text-sm text-white/60 hover:text-white border border-white/20 px-4 py-2 rounded-lg transition font-semibold"
          >
            Print
          </button>
          <button
            onClick={onRestart}
            className="text-sm font-bold text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
          >
            New Screening
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5 space-y-5">

        {/* ── Hero card ── */}
        <div className={`rounded-3xl border-2 ${cfg.border} ${cfg.bg} p-6 animate-fade-up`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Screening Report</p>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{tutorProfile.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">{tutorProfile.email}</p>
              <span className={`inline-flex items-center gap-1.5 ${cfg.badge} text-white rounded-full px-4 py-1.5 text-xs font-black mt-3 shadow-md`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <CircularScore score={scores.overall} />
          </div>
          <p className="text-gray-600 text-sm mt-5 leading-relaxed font-medium border-t border-gray-200/50 pt-4">{summary}</p>
        </div>

        {/* ── Score breakdown ── */}
        <div className="glass-sm rounded-2xl p-6 space-y-5">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Performance Scores</h2>
          {SCORE_META.map(({ key, icon, label, description }) => (
            <ScoreBar key={key} label={label} icon={icon} description={description} score={scores[key]} />
          ))}
          <p className="text-xs text-gray-400 pt-1 font-medium">Each dimension scored 0–10 based on voice interview responses</p>
        </div>

        {/* ── Notable quotes ── */}
        {quotes && quotes.length > 0 && (
          <div className="glass-sm rounded-2xl p-6">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Notable Quotes</h2>
            <div className="space-y-4">
              {quotes.map((q, i) => (
                <div key={i} className="flex gap-3 items-start bg-cue-pale/40 rounded-xl px-4 py-3">
                  <span className="text-cue-teal text-2xl font-black leading-none mt-0.5 flex-shrink-0">"</span>
                  <p className="text-sm text-gray-700 leading-relaxed italic pt-1 font-medium">{q}</p>
                  <span className="text-cue-teal text-2xl font-black leading-none self-end flex-shrink-0">"</span>
                </div>
              ))}
              <p className="text-xs text-gray-400 font-medium">— {tutorProfile.name}</p>
            </div>
          </div>
        )}

        {/* ── Strengths & Improvements ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-sm rounded-2xl p-5">
            <h2 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4">Strengths</h2>
            <ul className="space-y-3">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 font-medium">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-[12px] font-black">✓</span>
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-sm rounded-2xl p-5">
            <h2 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-4">Areas to Improve</h2>
            <ul className="space-y-3">
              {improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 font-medium">
                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-[12px] font-black">→</span>
                  </span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Detailed feedback ── */}
        <div className="glass-sm rounded-2xl p-6 space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Detailed Feedback</h2>
          <div className="rounded-2xl border border-cue-pale p-4"
            style={{ background: 'linear-gradient(135deg, rgba(15,118,110,0.04), rgba(13,148,136,0.06))' }}>
            <p className="text-xs font-black text-cue-teal uppercase tracking-wider mb-2">Teaching Ability</p>
            <p className="text-sm text-gray-700 leading-relaxed font-medium">{detailedFeedback.teaching}</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-black text-sky-600 uppercase tracking-wider mb-2">Communication</p>
            <p className="text-sm text-gray-700 leading-relaxed font-medium">{detailedFeedback.communication}</p>
          </div>
        </div>

        {/* ── Confidence analysis ── */}
        {evaluation.confidence && (() => {
          const c = evaluation.confidence!;
          const barPct = Math.round(((c.avgScore + 6) / 11) * 100);
          const barColor =
            c.overall === 'confident' ? '#10B981' :
            c.overall === 'neutral'   ? '#F59E0B' :
            '#EF4444';
          const badgeColor =
            c.overall === 'confident' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            c.overall === 'neutral'   ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-red-100 text-red-700 border-red-200';
          return (
            <div className="glass-sm rounded-2xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Confidence Analysis</h2>
                <span className={`text-xs font-black uppercase tracking-wider border px-3 py-1 rounded-full ${badgeColor}`}>
                  {c.overall}
                </span>
              </div>

              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[12px] text-red-400 font-bold">Nervous</span>
                  <span className="text-[12px] text-amber-400 font-bold">Neutral</span>
                  <span className="text-[12px] text-emerald-500 font-bold">Confident</span>
                </div>
                <div className="w-full bg-cue-pale rounded-full h-3 overflow-hidden">
                  <div className="h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${barPct}%`, background: barColor }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: c.avgAnswerLength, label: 'Avg words/answer' },
                  { val: `${c.avgResponseDelay}s`, label: 'Avg response delay' },
                  { val: `${c.avgFillerRate}%`, label: 'Avg filler rate' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center bg-white rounded-2xl p-3 border border-cue-pale/60 shadow-sm">
                    <p className="text-2xl font-black text-cue-teal">{val}</p>
                    <p className="text-[12px] text-gray-400 font-bold uppercase mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 leading-relaxed mt-4 font-medium">
                {c.overall === 'confident'
                  ? 'Strong confidence — well-structured answers, quick responses, and minimal hesitation.'
                  : c.overall === 'neutral'
                  ? 'Moderate confidence. Some answers were brief or delayed, but overall communication was adequate.'
                  : 'The candidate appeared nervous — short responses, longer pauses, or frequent filler usage.'}
              </p>
            </div>
          );
        })()}

        {/* ── Filler word stats ── */}
        {evaluation.fillerWords && evaluation.fillerWords.total > 0 && (
          <div className="glass-sm rounded-2xl p-6 border border-amber-100">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-xs font-black text-amber-600 uppercase tracking-widest">Filler Words</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-amber-700">{evaluation.fillerWords.total} total</span>
                <span className="text-xs text-gray-400 font-medium">{evaluation.fillerWords.percentage}% of words spoken</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(evaluation.fillerWords.counts)
                .filter(([, n]) => n > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([label, n]) => (
                  <div key={label}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${
                      label === evaluation.fillerWords!.topWord
                        ? 'bg-amber-100 border-amber-300'
                        : 'bg-white border-gray-200'
                    }`}>
                    <span className="text-xs font-bold text-gray-700">"{label}"</span>
                    <span className={`text-lg font-black ${label === evaluation.fillerWords!.topWord ? 'text-amber-700' : 'text-gray-600'}`}>
                      {n}×
                    </span>
                    {label === evaluation.fillerWords!.topWord && (
                      <span className="text-[12px] font-black text-amber-600 uppercase bg-amber-200 px-1.5 py-0.5 rounded-full">
                        most used
                      </span>
                    )}
                  </div>
                ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-medium">
              Under 2% is considered fluent speech.
              {evaluation.fillerWords.percentage >= 5
                ? ' This candidate would benefit from mindful speech practice.'
                : evaluation.fillerWords.percentage >= 2
                ? ' Moderate usage — minor coaching may help.'
                : ' Good filler word discipline overall.'}
            </p>
          </div>
        )}

        {evaluation.fillerWords && evaluation.fillerWords.total === 0 && (
          <div className="glass-sm rounded-2xl p-5 flex items-center gap-4 border border-emerald-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 font-black text-sm">✓</span>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">Zero filler words detected</p>
              <p className="text-xs text-gray-400 font-medium">Excellent speech discipline throughout the interview.</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-6 font-medium">
          Generated by Cuemath AI Tutor Screener · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
