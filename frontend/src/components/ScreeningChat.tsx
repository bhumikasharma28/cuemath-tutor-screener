import { useState, useRef, useEffect } from 'react';
import { ConfidenceLevel, ConfidenceSummary, EvaluationReport, FillerWordStats, TutorProfile } from '../types';
import { sendMessage } from '../api';

// ── Web Speech API types ───────────────────────────────────────────────────────
interface IRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

function getSR(): (new () => IRecognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as new () => IRecognition) ||
    (w['webkitSpeechRecognition'] as new () => IRecognition) ||
    null
  );
}

function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.name === 'Microsoft Zira - English (United States)') ?? null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripEvalBlock(text: string): string {
  return text.replace(/<evaluation>[\s\S]*?<\/evaluation>/g, '').trim();
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MicState = 'ai-speaking' | 'waiting' | 'recording' | 'processing' | 'done';

interface Props {
  sessionId: string;
  initialMessage: string;
  tutorProfile: TutorProfile;
  onComplete: (evaluation: EvaluationReport) => void;
}

const TOTAL_QUESTIONS = 5;
const SILENCE_MSG_DELAY = 8000;
const SPEECH_END_DELAY = 2500;
const MIN_WORDS = 15;
const MAX_RECORD_MS = 120_000;

// ── Filler word detection ─────────────────────────────────────────────────────
const FILLER_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'like',      pattern: /\blike\b/gi },
  { label: 'so',        pattern: /\bso\b/gi },
  { label: 'yeah',      pattern: /\byeah\b/gi },
  { label: 'actually',  pattern: /\bactually\b/gi },
  { label: 'basically', pattern: /\bbasically\b/gi },
  { label: 'you know',  pattern: /\byou\s+know\b/gi },
  { label: 'i mean',    pattern: /\bi\s+mean\b/gi },
  { label: 'right',     pattern: /\bright\b/gi },
  { label: 'okay',      pattern: /\bokay\b/gi },
];

function countFillers(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { label, pattern } of FILLER_PATTERNS) {
    pattern.lastIndex = 0;
    counts[label] = (text.match(pattern) ?? []).length;
  }
  return counts;
}

function mergeFillers(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const result = { ...a };
  for (const key of Object.keys(b)) result[key] = (result[key] ?? 0) + b[key];
  return result;
}

function buildFillerStats(counts: Record<string, number>, totalWords: number): FillerWordStats {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const topWord = Object.entries(counts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0)?.[0] ?? null;
  const percentage = totalWords > 0 ? Math.round((total / totalWords) * 100) : 0;
  return { total, counts, topWord, percentage };
}

// ── Confidence scoring ────────────────────────────────────────────────────────
interface AnswerConfidenceData {
  score: number;
  responseDelay: number;
  fillerRate: number;
  words: number;
}

function computeConfidenceScore(words: number, fillerTotal: number, responseDelaySec: number): number {
  let score = 0;
  if (words >= 50) score += 2;
  else if (words >= 30) score += 1;
  else if (words >= 15) score += 0;
  else if (words >= 5) score -= 1;
  else score -= 2;

  const fillerRate = words > 0 ? (fillerTotal / words) * 100 : 0;
  if (fillerRate === 0) score += 2;
  else if (fillerRate < 2) score += 1;
  else if (fillerRate < 4) score += 0;
  else if (fillerRate < 8) score -= 1;
  else score -= 2;

  if (responseDelaySec < 1) score += 1;
  else if (responseDelaySec < 3) score += 0;
  else if (responseDelaySec < 6) score -= 1;
  else score -= 2;

  return score; // range: -6 to +5
}

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 2) return 'confident';
  if (score >= -1) return 'neutral';
  return 'nervous';
}

function scoreToBarPct(score: number): number {
  return Math.round(((score + 6) / 11) * 100);
}

function buildConfidenceSummary(data: AnswerConfidenceData[]): ConfidenceSummary {
  if (data.length === 0) {
    return { overall: 'neutral', avgScore: 0, avgResponseDelay: 0, avgFillerRate: 0, avgAnswerLength: 0 };
  }
  const avg = (fn: (d: AnswerConfidenceData) => number) =>
    Math.round((data.reduce((s, d) => s + fn(d), 0) / data.length) * 10) / 10;
  const avgScore = avg((d) => d.score);
  return {
    overall: scoreToLevel(avgScore),
    avgScore,
    avgResponseDelay: avg((d) => d.responseDelay),
    avgFillerRate: avg((d) => d.fillerRate),
    avgAnswerLength: avg((d) => d.words),
  };
}

// ── Browser-not-supported screen ──────────────────────────────────────────────
function BrowserNotSupported() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #042F2E 0%, #134E4A 100%)' }}>
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-2xl p-10">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9.293 5.293A7 7 0 0119 11" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-3 tracking-tight">Voice Not Available</h2>
        <p className="text-gray-500 leading-relaxed mb-2 text-sm">This screening uses your microphone and voice recognition.</p>
        <p className="text-gray-800 font-semibold mb-6 text-sm">
          Please use <span className="text-cue-teal font-black">Google Chrome</span> for the voice feature.
        </p>
        <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer"
          className="inline-block text-white font-bold px-6 py-3 rounded-xl transition hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
          Download Google Chrome →
        </a>
        <p className="text-xs text-gray-400 mt-5">Microsoft Edge also supports voice features.</p>
      </div>
    </div>
  );
}

// ── Sound wave shown while AI is speaking ─────────────────────────────────────
function SoundWave() {
  const heights = [4, 10, 16, 10, 6, 14, 8, 12, 6, 10];
  return (
    <div className="flex items-center gap-0.5 h-5">
      {heights.map((h, i) => (
        <div key={i} className="w-1 rounded-full animate-bounce"
          style={{ height: `${h}px`, background: 'linear-gradient(180deg, #7C3AED, #A855F7)', animationDelay: `${i * 70}ms`, animationDuration: '0.7s' }} />
      ))}
    </div>
  );
}

// ── Horizontal waveform bars flanking the mic button ──────────────────────────
function HorizontalWave({ active, flip = false }: { active: boolean; flip?: boolean }) {
  const bars = [5, 10, 18, 13, 22, 16, 20, 11, 17, 9, 14, 7, 11, 16, 9];
  const ordered = flip ? [...bars].reverse() : bars;
  return (
    <div className="flex items-center gap-1 h-24 flex-shrink-0">
      {ordered.map((h, i) => (
        <div key={i} className="w-1.5 rounded-full"
          style={{
            height: active ? `${h * 2.8}px` : '5px',
            background: active
              ? `linear-gradient(180deg, #F97316, #EC4899)`
              : 'rgba(124,58,237,0.2)',
            transition: 'height 0.15s ease',
            animation: active ? `soundbar 0.75s ease-in-out ${i * 55}ms infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScreeningChat({ sessionId, initialMessage, tutorProfile, onComplete }: Props) {
  const [micState, setMicState] = useState<MicState>('ai-speaking');
  const [aiMessage, setAiMessage] = useState(stripEvalBlock(initialMessage));
  const [promptMsg, setPromptMsg] = useState<string | null>(null);
  const [liveText, setLiveText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showRetry, setShowRetry] = useState(false);
  const [hasSpeechSupport] = useState(() => !!getSR());

  const recRef = useRef<IRecognition | null>(null);
  const accRef = useRef('');
  const followUpRef = useRef(0);
  const interruptedRef = useRef(false);
  const silTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // TTS fallback refs
  const ttsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsHardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsFiredRef = useRef(false);
  // Voice ref — loaded async by voiceschanged
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // false until effect confirms mount (survives React StrictMode double-invoke)
  const mountRef = useRef(false);

  // Filler word tracking
  const fillerTotalRef = useRef<Record<string, number>>({}); // accumulated across all answers
  const fillerTotalWordsRef = useRef(0);                     // total words spoken across interview
  const [liveFillers, setLiveFillers] = useState<Record<string, number>>({}); // current answer live counts

  // Confidence tracking
  const listenStartRef = useRef(0);                         // Date.now() when listen() is called
  const responseDelayRef = useRef(0);                       // seconds until first speech detected
  const confidenceDataRef = useRef<AnswerConfidenceData[]>([]); // per-answer confidence history
  const [liveConfidenceScore, setLiveConfidenceScore] = useState(0);
  const currentFinalRef = useRef('');    // running final transcript for the current answer

  // Chat history (right panel)
  const [chatHistory, setChatHistory] = useState<Array<{
    id: number; role: 'ai' | 'user'; content: string; time: string;
  }>>([]);
  const chatIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pace tracking
  const speechStartTimeRef = useRef(0);
  const [livePaceWPM, setLivePaceWPM] = useState(0);

  const fns = useRef({
    speak: (_text: string, _onDone: () => void) => {},
    listen: () => {},
    finalize: (_text: string) => {},
    send: (_answer: string) => {},
  });

  // Load preferred TTS voice (Chrome delivers voices async)
  useEffect(() => {
    const load = () => { voiceRef.current = getPreferredVoice(); };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // ── TTS helpers ───────────────────────────────────────────────────────────

  function clearTtsTimers() {
    if (ttsPollRef.current) { clearInterval(ttsPollRef.current); ttsPollRef.current = null; }
    if (ttsHardRef.current) { clearTimeout(ttsHardRef.current); ttsHardRef.current = null; }
  }

  function speak(text: string, onDone: () => void) {
    speechSynthesis.cancel();
    clearTtsTimers();
    ttsFiredRef.current = false;

    const clean = stripEvalBlock(text).trim();
    if (!clean) { onDone(); return; }

    const fire = () => {
      if (ttsFiredRef.current) return;
      ttsFiredRef.current = true;
      clearTtsTimers();
      if (mountRef.current) onDone();
    };

    // Resolve voice at speak-time so the introduction never misses it due to async load
    if (!voiceRef.current) voiceRef.current = getPreferredVoice();

    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = fire;
    u.onerror = fire;

    // Fallback 1 — poll every 500ms; delay 200ms before first check to skip pre-start gap
    setTimeout(() => {
      if (ttsFiredRef.current) return;
      ttsPollRef.current = setInterval(() => {
        if (!speechSynthesis.speaking) fire();
      }, 500);
    }, 200);

    // Fallback 2 — hard timeout (rate-adjusted: divide by 1.15 to match actual duration)
    ttsHardRef.current = setTimeout(fire, Math.ceil((clean.length * 60) / 1.1) + 400);

    speechSynthesis.speak(u);
  }

  // ── Mic helpers ───────────────────────────────────────────────────────────

  function clearMicTimers() {
    if (silTimerRef.current) { clearTimeout(silTimerRef.current); silTimerRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (maxDurTimerRef.current) { clearTimeout(maxDurTimerRef.current); maxDurTimerRef.current = null; }
  }

  function stopRecording() {
    if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
  }

  function listen() {
    console.log('listen() called, mounted:', mountRef.current);
    if (!mountRef.current) return;
    clearMicTimers();

    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      recRef.current = null;
    }

    setShowRetry(false);
    setMicState('waiting');
    setLiveText('');
    setInterimText('');
    setStatusMsg(null);
    setLiveConfidenceScore(0);
    currentFinalRef.current = '';
    listenStartRef.current = Date.now();
    responseDelayRef.current = 0;

    const SR = getSR();
    if (!SR) return;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((t) => t.stop());
      if (!mountRef.current) return;

      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      recRef.current = rec;

      console.log('SR created:', rec);
      rec.onstart = () => console.log('recognition started');

      let final = '';
      let gotAnyResult = false;

      silTimerRef.current = setTimeout(() => {
        if (!gotAnyResult && mountRef.current)
          setStatusMsg("Take your time… I'm listening. Speak clearly into your microphone.");
      }, SILENCE_MSG_DELAY);

      maxDurTimerRef.current = setTimeout(() => {
        if (mountRef.current) {
          interruptedRef.current = true;
          try { rec.stop(); } catch { /* ignore */ }
        }
      }, MAX_RECORD_MS);

      rec.onspeechstart = () => {
        if (silTimerRef.current) { clearTimeout(silTimerRef.current); silTimerRef.current = null; }
        responseDelayRef.current = (Date.now() - listenStartRef.current) / 1000;
        speechStartTimeRef.current = Date.now();
        setMicState('recording');
        setStatusMsg(null);
      };

      rec.onresult = (e) => {
        console.log('got result', e);
        const { resultIndex, results } = e;
        gotAnyResult = true;
        if (silTimerRef.current) { clearTimeout(silTimerRef.current); silTimerRef.current = null; }
        setMicState('recording');
        setStatusMsg(null);
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

        let interim = '';
        for (let i = resultIndex; i < results.length; i++) {
          const t = results[i][0].transcript;
          if (results[i].isFinal) final += t + ' ';
          else interim += t;
        }
        setLiveText(final);
        setInterimText(interim);

        // Count fillers in accumulated final transcript for this answer
        const currentCounts = countFillers(final + ' ' + interim);
        setLiveFillers(currentCounts);
        currentFinalRef.current = final;

        // Live confidence score
        const liveWords = wordCount(final + ' ' + interim);
        const liveFillerTotal = Object.values(currentCounts).reduce((s, n) => s + n, 0);
        setLiveConfidenceScore(
          computeConfidenceScore(liveWords, liveFillerTotal, responseDelayRef.current)
        );

        // Live pace (WPM)
        if (speechStartTimeRef.current > 0) {
          const elapsedMin = (Date.now() - speechStartTimeRef.current) / 60000;
          if (elapsedMin > 0.05) setLivePaceWPM(Math.round(liveWords / elapsedMin));
        }

        stopTimerRef.current = setTimeout(() => {
          if (mountRef.current) { try { rec.stop(); } catch { /* ignore */ } }
        }, SPEECH_END_DELAY);
      };

      rec.onspeechend = () => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
          if (mountRef.current) { try { rec.stop(); } catch { /* ignore */ } }
        }, SPEECH_END_DELAY);

        // Recompute confidence on pause using confirmed final text only
        const pausedText = currentFinalRef.current;
        const pausedCounts = countFillers(pausedText);
        const pausedWords = wordCount(pausedText);
        const pausedFillerTotal = Object.values(pausedCounts).reduce((s, n) => s + n, 0);
        setLiveConfidenceScore(
          computeConfidenceScore(pausedWords, pausedFillerTotal, responseDelayRef.current)
        );
      };

      rec.onerror = (e) => {
        console.log('error', e.error);
        const { error } = e;
        if (error === 'no-speech' || error === 'aborted') return;
        if (mountRef.current) {
          clearMicTimers();
          setStatusMsg(`Microphone error: "${error}". Check mic permissions then click Try Again.`);
          setShowRetry(true);
          setMicState('waiting');
        }
      };

      rec.onend = () => {
        console.log('recognition ended');
        clearMicTimers();
        if (!mountRef.current) return;
        fns.current.finalize(final.trim());
      };

      try {
        console.log('starting recognition');
        rec.start();
      } catch (err) {
        clearMicTimers();
        if (mountRef.current) {
          setStatusMsg(`Could not start microphone: ${err instanceof Error ? err.message : String(err)}`);
          setShowRetry(true);
          setMicState('waiting');
        }
      }
    }).catch((err: unknown) => {
      if (!mountRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg(`Mic permission denied — ${msg}. Click the lock icon in Chrome's address bar to allow microphone, then click Try Again.`);
      setShowRetry(true);
      setMicState('waiting');
    });
  }

  // ── Answer processing ─────────────────────────────────────────────────────

  function accumulateAndSend(text: string) {
    const counts = countFillers(text);
    fillerTotalRef.current = mergeFillers(fillerTotalRef.current, counts);
    const words = wordCount(text);
    fillerTotalWordsRef.current += words;
    setLiveFillers({});
    setLivePaceWPM(0);

    // Push user answer to chat history
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatHistory(prev => [...prev, { id: ++chatIdRef.current, role: 'user', content: text, time: now }]);

    const fillerTotal = Object.values(counts).reduce((s, n) => s + n, 0);
    const fillerRate = words > 0 ? Math.round((fillerTotal / words) * 1000) / 10 : 0;
    confidenceDataRef.current.push({
      score: computeConfidenceScore(words, fillerTotal, responseDelayRef.current),
      responseDelay: responseDelayRef.current,
      fillerRate,
      words,
    });

    fns.current.send(text);
  }

  function finalize(raw: string) {
    const full = (accRef.current + ' ' + raw).trim();
    const words = wordCount(full);

    if (interruptedRef.current) {
      interruptedRef.current = false;
      accRef.current = '';
      followUpRef.current = 0;
      setLiveText(''); setInterimText(''); setStatusMsg(null); setPromptMsg(null);
      accumulateAndSend(full || 'I have shared my thoughts.');
      return;
    }

    if (words < 2) {
      accRef.current = '';
      setLiveText(''); setInterimText(''); setStatusMsg(null);
      setPromptMsg("I didn't catch that — please speak your answer clearly and try again.");
      fns.current.listen();
      return;
    }

    if (followUpRef.current >= 1) {
      accRef.current = '';
      followUpRef.current = 0;
      setLiveText(''); setInterimText(''); setStatusMsg(null); setPromptMsg(null);
      accumulateAndSend(full);
      return;
    }

    if (words === 1) {
      followUpRef.current += 1;
      accRef.current = full;
      setLiveText(''); setInterimText(''); setStatusMsg(null);
      setPromptMsg("That's a start! Could you give a bit more detail?");
      fns.current.listen();
      return;
    }

    if (words < MIN_WORDS) {
      followUpRef.current += 1;
      accRef.current = full;
      setLiveText(''); setInterimText(''); setStatusMsg(null);
      setPromptMsg('Could you tell me a little more about that?');
      fns.current.listen();
      return;
    }

    accRef.current = '';
    followUpRef.current = 0;
    setLiveText(''); setInterimText(''); setStatusMsg(null); setPromptMsg(null);
    accumulateAndSend(full);
  }

  async function send(answer: string) {
    followUpRef.current = 0;
    setMicState('processing');
    setStatusMsg('Processing your response…');
    setPromptMsg(null);

    try {
      const result = await sendMessage(sessionId, answer);
      if (!mountRef.current) return;

      const displayMsg = stripEvalBlock(result.message);
      setAiMessage(displayMsg);
      setAnsweredCount((c) => c + 1);
      setStatusMsg(null);
      const nowAi = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory(prev => [...prev, { id: ++chatIdRef.current, role: 'ai', content: displayMsg, time: nowAi }]);

      if (result.isComplete && result.evaluation) {
        setMicState('done');
        const fillerStats = buildFillerStats(fillerTotalRef.current, fillerTotalWordsRef.current);
        const confidenceStats = buildConfidenceSummary(confidenceDataRef.current);
        const evaluation = { ...result.evaluation, fillerWords: fillerStats, confidence: confidenceStats };
        fns.current.speak(displayMsg, () => {
          setTimeout(() => { if (mountRef.current) onComplete(evaluation); }, 800);
        });
      } else {
        setMicState('ai-speaking');
        fns.current.speak(displayMsg, () => fns.current.listen());
      }
    } catch {
      if (mountRef.current) {
        setStatusMsg('Connection error. Please check your internet and try again.');
        setShowRetry(true);
        setMicState('waiting');
      }
    }
  }

  fns.current = { speak, listen, finalize, send };

  // Scroll chat to bottom when history updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Single effect: sets mountRef true, speaks initial message, cleans up on unmount
  useEffect(() => {
    mountRef.current = true;
    // Seed chat history with initial AI message
    const t0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatHistory([{ id: ++chatIdRef.current, role: 'ai', content: stripEvalBlock(initialMessage), time: t0 }]);
    // Wait 300ms for Chrome to finish loading voices before the first utterance
    const t = setTimeout(() => {
      voiceRef.current = getPreferredVoice();
      fns.current.speak(stripEvalBlock(initialMessage), () => fns.current.listen());
    }, 300);
    return () => {
      clearTimeout(t);
      mountRef.current = false;
      clearTtsTimers();
      clearMicTimers();
      speechSynthesis.cancel();
      if (recRef.current) { try { recRef.current.abort(); } catch { /* ignore */ } }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early return ─────────────────────────────────────────────────────────
  if (!hasSpeechSupport) return <BrowserNotSupported />;

  // ── Derived ──────────────────────────────────────────────────────────────
  const qNum = Math.min(answeredCount + 1, TOTAL_QUESTIONS);
  const pct = Math.min((answeredCount / TOTAL_QUESTIONS) * 100, 100);
  const isAiSpeaking = micState === 'ai-speaking';
  const isRecording = micState === 'recording';
  const isProcessing = micState === 'processing';
  const isWaiting = micState === 'waiting';
  const isDone = micState === 'done';
  const showMic = !isAiSpeaking && !isDone;

  const paceLabel = livePaceWPM === 0 ? '—' : livePaceWPM < 100 ? 'Slow' : livePaceWPM <= 170 ? 'Good' : 'Slightly Fast';
  const paceColor = livePaceWPM === 0 ? '#9CA3AF' : livePaceWPM < 100 ? '#EF4444' : livePaceWPM <= 170 ? '#10B981' : '#F59E0B';
  const pauseLabel = responseDelayRef.current === 0 ? '—' : responseDelayRef.current < 2 ? 'Good' : responseDelayRef.current < 5 ? 'Brief' : 'Slow';
  const pauseColor = responseDelayRef.current === 0 ? '#9CA3AF' : responseDelayRef.current < 2 ? '#10B981' : responseDelayRef.current < 5 ? '#F59E0B' : '#EF4444';
  const totalFillers = Object.values(liveFillers).reduce((s, n) => s + n, 0);

  const liveConfidenceLevel = scoreToLevel(liveConfidenceScore);
  const liveConfidenceBarPct = scoreToBarPct(liveConfidenceScore);
  const confidenceBarColor =
    liveConfidenceLevel === 'confident' ? 'bg-emerald-500' :
    liveConfidenceLevel === 'neutral'   ? 'bg-amber-400' :
    'bg-red-500';
  const confidenceLabelColor =
    liveConfidenceLevel === 'confident' ? 'text-emerald-700' :
    liveConfidenceLevel === 'neutral'   ? 'text-amber-700' :
    'text-red-700';
  const confidenceBgColor =
    liveConfidenceLevel === 'confident' ? 'bg-emerald-50 border-emerald-200' :
    liveConfidenceLevel === 'neutral'   ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200';

  const statusColor = (msg: string) => {
    if (msg.startsWith('Processing')) return 'bg-blue-50 text-blue-600 border-blue-100';
    if (msg.startsWith('Take your time') || msg.startsWith('Could you') || msg.startsWith("That's"))
      return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-red-50 text-red-600 border-red-100';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex overflow-hidden">

      {/* ── Icon Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-16 flex-shrink-0 flex flex-col items-center py-5 gap-5 z-10"
        style={{ background: 'linear-gradient(180deg, #3B0764 0%, #5B21B6 100%)' }}>
        {/* Logo mark */}
        <div className="flex flex-col items-center leading-none mb-2">
          <span className="text-white font-black text-[13px]">cue</span>
          <span className="font-black text-[13px]" style={{ color: '#F97316' }}>math</span>
        </div>
        <div className="w-7 h-px bg-white/15" />
        {/* Home */}
        <button className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,255,255,0.15)' }} title="Interview">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        {/* Interviews */}
        <button className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all" title="Interviews">
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {/* Avatar at bottom */}
        <div className="mt-auto w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black border-2 border-white/20"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
          {tutorProfile.name[0]?.toUpperCase()}
        </div>
      </aside>

      {/* ── Main Mic Panel ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0"
        style={{ background: 'linear-gradient(160deg, #F9F5FF 0%, #F3E8FF 50%, #EEF2FF 100%)' }}>

        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-purple-100/60 bg-white/40 backdrop-blur-sm flex-shrink-0">
          <div>
            <p className="text-[12px] font-black text-purple-400 uppercase tracking-widest">Interview in Progress</p>
            <p className="text-sm font-black text-gray-700 tracking-tight">Question {qNum} of {TOTAL_QUESTIONS}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{
                    width: i === answeredCount ? '18px' : '7px',
                    height: '7px',
                    background: i < answeredCount
                      ? 'linear-gradient(90deg,#7C3AED,#A855F7)'
                      : i === answeredCount ? '#A855F7' : '#E5E7EB',
                  }} />
              ))}
            </div>
            <span className="text-xs text-gray-400 font-bold ml-1">{Math.round(pct)}%</span>
          </div>
        </div>

        {/* Hero content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-5 overflow-y-auto">

          {/* Heading */}
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-tight">
              Hey there,{' '}
              <span style={{
                background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>future tutor!</span>
            </h2>
            <p className="text-gray-500 font-medium text-sm mt-1.5">
              {isAiSpeaking ? 'Listen carefully to the question…'
               : isRecording ? "We're listening — speak naturally!"
               : isProcessing ? 'Analysing your response…'
               : isDone ? 'Interview complete! Generating your report…'
               : "Let's get to know the real you"}
            </p>
          </div>

          {/* Current question bubble */}
          {(isAiSpeaking || isWaiting) && (
            <div className="max-w-sm w-full bg-white/80 backdrop-blur-sm rounded-2xl border border-purple-100 shadow-lg px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>B</div>
                <div>
                  <p className="text-xs font-black text-purple-700">Bhumi</p>
                  <p className="text-[12px] text-gray-400 font-medium">AI Interviewer</p>
                </div>
                {isAiSpeaking && <div className="ml-auto"><SoundWave /></div>}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed font-medium">{aiMessage}</p>
              {isAiSpeaking && (
                <button
                  onClick={() => { speechSynthesis.cancel(); clearTtsTimers(); if (!ttsFiredRef.current) { ttsFiredRef.current = true; fns.current.listen(); } }}
                  className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  Start Speaking Now
                </button>
              )}
            </div>
          )}

          {/* Mic + waveforms */}
          {showMic && (
            <div className="flex items-center gap-6">
              <HorizontalWave active={isRecording} />

              {/* Mic button */}
              <div className="relative flex items-center justify-center w-40 h-40 flex-shrink-0">
                {/* Pulse rings */}
                {(isRecording || isWaiting) && (
                  <>
                    {[0, 0.73, 1.46].map((delay) => (
                      <span key={delay} className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background: isRecording ? 'rgba(249,115,22,0.2)' : 'rgba(124,58,237,0.12)',
                          animation: `mic-ring 2.2s cubic-bezier(0.2,0.6,0.35,1) ${delay}s infinite`,
                        }} />
                    ))}
                  </>
                )}
                <button
                  onClick={() => { if (isProcessing || isDone) return; if (isRecording) stopRecording(); else fns.current.listen(); }}
                  disabled={isProcessing}
                  className="relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none"
                  style={{
                    background: isRecording
                      ? 'linear-gradient(135deg, #F97316, #EC4899)'
                      : isProcessing ? '#9CA3AF'
                      : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                    transform: isRecording ? 'scale(1.06)' : 'scale(1)',
                    boxShadow: isRecording
                      ? '0 20px 70px rgba(249,115,22,0.45)'
                      : '0 20px 70px rgba(124,58,237,0.4)',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                  }}>
                  {isProcessing ? (
                    <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  )}
                </button>
              </div>

              <HorizontalWave active={isRecording} flip />
            </div>
          )}

          {/* Listening / status indicator */}
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-sm font-bold text-gray-700">Listening…</span>
            </div>
          )}
          {isWaiting && !isProcessing && (
            <p className="text-xs text-purple-400 font-semibold">Tap mic to start speaking</p>
          )}

          {/* Done Speaking button */}
          {isRecording && (
            <button onClick={stopRecording}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-black text-sm shadow-xl hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', boxShadow: '0 12px 40px rgba(124,58,237,0.35)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Done Speaking
            </button>
          )}

          {/* Tap mic or click Done hint */}
          {isRecording && (
            <p className="text-xs text-gray-400 font-medium -mt-2">Tap mic or click Done when finished</p>
          )}

          {/* Prompt / retry */}
          {promptMsg && (
            <div className="max-w-sm w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-semibold text-amber-700 text-center">
              {promptMsg}
            </div>
          )}
          {statusMsg && (
            <div className={`max-w-sm w-full text-center px-4 py-3 rounded-xl text-sm font-semibold border ${statusColor(statusMsg)}`}>
              {statusMsg}
            </div>
          )}
          {showRetry && !isProcessing && (
            <button onClick={() => { setShowRetry(false); setStatusMsg(null); fns.current.listen(); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 text-sm font-bold rounded-xl transition hover:bg-purple-50"
              style={{ borderColor: '#7C3AED', color: '#7C3AED' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Try Again
            </button>
          )}

          {/* Tip card */}
          <div className="max-w-sm w-full mt-auto bg-white/60 backdrop-blur-sm rounded-2xl border border-purple-100 px-5 py-3 flex items-center gap-3">
            <span className="text-xl flex-shrink-0">💡</span>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              Speak clearly, take natural pauses and be yourself
            </p>
          </div>
        </div>
      </main>

      {/* ── Right Chat + Analytics Panel ─────────────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-white border-l border-gray-100">

        {/* Chat header */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-gray-800 tracking-tight">Interview Transcript</p>
              <p className="text-[12px] text-gray-400 font-medium mt-0.5">{answeredCount} of {TOTAL_QUESTIONS} answered</p>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i < answeredCount ? '#7C3AED' : i === answeredCount ? '#C084FC' : '#E5E7EB' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin min-h-0">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-black flex-shrink-0 mt-0.5 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>B</div>
              )}
              <div className="max-w-[78%]">
                <div className={`rounded-2xl px-4 py-2.5 ${msg.role === 'ai' ? 'bg-purple-50 border border-purple-100 rounded-tl-sm' : 'rounded-tr-sm text-white'}`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #7C3AED, #A855F7)' } : undefined}>
                  <p className="text-xs leading-relaxed font-medium" style={{ color: msg.role === 'ai' ? '#374151' : 'white' }}>
                    {msg.content}
                  </p>
                </div>
                <p className="text-[12px] text-gray-400 mt-1 font-medium px-1">{msg.time}</p>
              </div>
            </div>
          ))}
          {/* Live transcript bubble */}
          {(liveText || interimText) && (
            <div className="flex justify-end gap-2">
              <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-2.5 opacity-75"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.65), rgba(168,85,247,0.65))' }}>
                <p className="text-xs text-white leading-relaxed font-medium">
                  {liveText}<span className="italic opacity-70">{interimText}</span>
                </p>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Feature cards: Confidence Meter + Filler Word Detection */}
        <div className="px-4 pt-3 pb-2 space-y-2.5 border-t border-gray-100 flex-shrink-0">

          {/* Live Confidence Meter */}
          <div className={`rounded-xl px-4 py-3 border ${confidenceBgColor}`}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-black text-gray-600 uppercase tracking-widest">Live Confidence Meter</p>
              <span className={`text-[12px] font-black uppercase px-2 py-0.5 rounded-full ${
                liveConfidenceLevel === 'confident' ? 'bg-emerald-100 text-emerald-700' :
                liveConfidenceLevel === 'neutral'   ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'}`}>
                {liveConfidenceLevel}
              </span>
            </div>
            <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
              <div className={`${confidenceBarColor} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${liveConfidenceBarPct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-red-400 font-bold">Nervous</span>
              <span className="text-[11px] text-amber-400 font-bold">Neutral</span>
              <span className="text-[11px] text-emerald-500 font-bold">Confident</span>
            </div>
          </div>

          {/* Filler Word Detection */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-black text-orange-700 uppercase tracking-widest">Filler Word Detection</p>
              <span className="text-xs font-black" style={{ color: totalFillers > 0 ? '#F97316' : '#9CA3AF' }}>
                {totalFillers} detected
              </span>
            </div>
            {totalFillers > 0 ? (
              <div className="flex flex-wrap gap-1">
                {Object.entries(liveFillers).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([label, n]) => (
                  <span key={label} className="text-[12px] font-bold text-orange-800 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                    "{label}" ×{n}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-orange-400 font-medium">None detected yet</p>
            )}
          </div>
        </div>

        {/* Speech Analytics bar */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/80 flex-shrink-0">
          <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-2">Speech Analytics</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              {
                label: 'Clarity',
                value: liveConfidenceLevel === 'confident' ? 'Good' : liveConfidenceLevel === 'neutral' ? 'Fair' : 'Needs Work',
                color: liveConfidenceLevel === 'confident' ? '#10B981' : liveConfidenceLevel === 'neutral' ? '#F59E0B' : '#EF4444',
              },
              { label: 'Pace', value: paceLabel, color: paceColor },
              { label: 'Pause', value: pauseLabel, color: pauseColor },
              {
                label: 'Fillers',
                value: String(totalFillers),
                color: totalFillers === 0 ? '#10B981' : totalFillers < 3 ? '#F59E0B' : '#F97316',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-white rounded-xl py-2 px-1 border border-gray-100 shadow-sm">
                <p className="text-xs font-black leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
